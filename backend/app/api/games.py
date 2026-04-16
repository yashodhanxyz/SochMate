"""
Games API router.

Endpoints:
  POST /api/games           — submit a game for analysis
  GET  /api/games/{id}      — get full analysis result
  GET  /api/games/{id}/status — lightweight status poll
"""

from __future__ import annotations

import uuid

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.database import get_db
from app.models.game import Game
from app.models.user import User
from app.schemas.game import (
    GameResponse,
    GameStatusResponse,
    GameSubmitRequest,
    GameSubmitResponse,
)
from app.services.chess_com import ChessComError, fetch_pgn_from_url, is_chess_com_url
from app.services.pgn_parser import PGNParseError, parse_pgn
from app.tasks.analysis import analyze_game

router = APIRouter()


# ---------------------------------------------------------------------------
# POST /api/games
# ---------------------------------------------------------------------------

@router.post("", response_model=GameSubmitResponse, status_code=202)
async def submit_game(
    body: GameSubmitRequest,
    db: AsyncSession = Depends(get_db),
):
    """
    Accept a Chess.com URL or raw PGN, create a Game row, and enqueue analysis.

    Returns the game_id and status='pending' immediately.
    The client should poll GET /api/games/{id}/status until status='done'.
    """
    user = await _get_or_create_user(db, body.session_token)

    # --- Resolve PGN ---
    chess_com_game_id: str | None = None

    if is_chess_com_url(body.input):
        try:
            pgn_raw, chess_com_game_id = fetch_pgn_from_url(body.input)
        except ChessComError as exc:
            raise HTTPException(status_code=422, detail=str(exc))
        source = "chess_com"
    else:
        pgn_raw = body.input.strip()
        source = "manual_pgn"

    # --- Quick PGN validation before queuing ---
    try:
        parsed = parse_pgn(pgn_raw)
    except PGNParseError as exc:
        raise HTTPException(status_code=422, detail=f"Invalid PGN: {exc}")

    # --- Deduplication ---
    if chess_com_game_id:
        existing = await db.scalar(
            select(Game).where(
                Game.chess_com_game_id == chess_com_game_id,
                Game.user_id == user.id,
            )
        )
        if existing and existing.status == "done":
            return GameSubmitResponse(game_id=existing.id, status=existing.status)

    # Infer user_color from Chess.com username if not provided
    user_color = body.user_color
    if user_color is None and user.chess_com_username:
        username = user.chess_com_username.lower()
        if parsed.white_player and parsed.white_player.lower() == username:
            user_color = "white"
        elif parsed.black_player and parsed.black_player.lower() == username:
            user_color = "black"

    # --- Create Game row ---
    game = Game(
        user_id=user.id,
        pgn_raw=pgn_raw,
        source=source,
        chess_com_game_id=chess_com_game_id,
        white_player=parsed.white_player,
        black_player=parsed.black_player,
        user_color=user_color,
        result=parsed.result,
        time_control=parsed.time_control,
        eco_code=parsed.eco_code,
        opening_name=parsed.opening_name,
        white_elo=parsed.white_elo,
        black_elo=parsed.black_elo,
        played_at=parsed.played_at,
        status="pending",
    )
    db.add(game)
    await db.commit()
    await db.refresh(game)

    # --- Enqueue Celery task ---
    analyze_game.delay(str(game.id))

    return GameSubmitResponse(game_id=game.id, status="pending")


# ---------------------------------------------------------------------------
# GET /api/games/{game_id}/status
# ---------------------------------------------------------------------------

@router.get("/{game_id}/status", response_model=GameStatusResponse)
async def get_game_status(
    game_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
):
    """Lightweight status check. Clients poll this every 2s during analysis."""
    game = await db.get(Game, game_id)
    if game is None:
        raise HTTPException(status_code=404, detail="Game not found")

    return GameStatusResponse(
        game_id=game.id,
        status=game.status,
        error_message=game.error_message,
    )


# ---------------------------------------------------------------------------
# GET /api/games/{game_id}
# ---------------------------------------------------------------------------

@router.get("/{game_id}", response_model=GameResponse)
async def get_game(
    game_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
):
    """Return the full analysis result including all moves and summary."""
    result = await db.execute(
        select(Game)
        .where(Game.id == game_id)
        .options(
            selectinload(Game.moves),
            selectinload(Game.summary),
        )
    )
    game = result.scalar_one_or_none()

    if game is None:
        raise HTTPException(status_code=404, detail="Game not found")

    if game.status not in ("done", "failed"):
        raise HTTPException(
            status_code=202,
            detail=f"Analysis is {game.status}. Poll /status for updates.",
        )

    return GameResponse(
        game_id=game.id,
        status=game.status,
        source=game.source,
        white_player=game.white_player,
        black_player=game.black_player,
        user_color=game.user_color,
        result=game.result,
        time_control=game.time_control,
        eco_code=game.eco_code,
        opening_name=game.opening_name,
        white_elo=game.white_elo,
        black_elo=game.black_elo,
        played_at=game.played_at,
        created_at=game.created_at,
        moves=game.moves,
        summary=game.summary,
    )


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

async def _get_or_create_user(db: AsyncSession, session_token: str | None) -> User:
    """
    Find an existing user by session token, or create a new anonymous one.
    In V2, this will be replaced by JWT-based auth middleware.
    """
    if session_token:
        user = await db.scalar(
            select(User).where(User.session_token == session_token)
        )
        if user:
            return user

    # Create a new anonymous user
    import secrets
    token = session_token or secrets.token_urlsafe(32)
    user = User(session_token=token)
    db.add(user)
    await db.commit()
    await db.refresh(user)
    return user
