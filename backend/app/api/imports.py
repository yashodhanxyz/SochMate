"""
Import router.

Endpoints:
  POST /api/imports/chess-com  — bulk-import games from a Chess.com account
"""

from __future__ import annotations

import uuid

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user
from app.database import get_db
from app.models.game import Game
from app.models.user import User
from app.schemas.game import ImportChessComRequest, ImportChessComResponse
from app.services.chess_com import (
    ChessComError,
    extract_game_id,
    fetch_archive_games,
    fetch_archives,
)
from app.services.pgn_parser import PGNParseError, parse_pgn
from app.tasks.analysis import analyze_game

router = APIRouter()

_MAX_GAMES_CAP = 100   # hard server-side limit


@router.post("/chess-com", response_model=ImportChessComResponse)
async def import_chess_com(
    body: ImportChessComRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Fetch a player's recent games from Chess.com and queue them for analysis.

    Walks monthly archives newest-first until `max_games` new games have been
    queued or all archives are exhausted.  Already-imported games are skipped.
    Saves the Chess.com username to the user's profile.
    """
    username = body.username.strip()
    if not username:
        raise HTTPException(status_code=422, detail="Username must not be empty.")

    max_games = min(body.max_games, _MAX_GAMES_CAP)

    # --- Validate username + fetch archive list ---
    try:
        archives = fetch_archives(username)
    except ChessComError as exc:
        raise HTTPException(status_code=422, detail=str(exc))

    if not archives:
        raise HTTPException(
            status_code=422,
            detail=f"No game archives found for '{username}'. "
                   "The account may be new or have no completed games.",
        )

    # Save (or update) the Chess.com username on the user profile
    current_user.chess_com_username = username
    await db.commit()

    # --- Walk archives, collect new games ---
    game_rows: list[Game] = []
    game_ids_to_queue: list[str] = []
    queued = 0
    skipped = 0

    for archive_url in archives:
        if queued >= max_games:
            break

        raw_games = fetch_archive_games(archive_url)
        # Newest games are at the end of the month list — reverse for newest-first
        for game_data in reversed(raw_games):
            if queued >= max_games:
                break

            url = game_data.get("url", "")
            pgn = game_data.get("pgn", "")
            if not url or not pgn:
                continue

            # Extract the numeric game ID
            try:
                _, chess_com_game_id = extract_game_id(url)
            except ChessComError:
                continue

            # Deduplication — skip if already in this user's library
            existing = await db.scalar(
                select(Game).where(
                    Game.chess_com_game_id == chess_com_game_id,
                    Game.user_id == current_user.id,
                )
            )
            if existing:
                skipped += 1
                continue

            # Detect which color the importing user played
            white_name = game_data.get("white", {}).get("username", "").lower()
            black_name = game_data.get("black", {}).get("username", "").lower()
            uname_lower = username.lower()
            if white_name == uname_lower:
                user_color: str | None = "white"
            elif black_name == uname_lower:
                user_color = "black"
            else:
                user_color = None

            # Parse PGN for metadata (headers only — engine runs later in Celery)
            try:
                parsed = parse_pgn(pgn)
            except PGNParseError:
                continue

            game_id = uuid.uuid4()
            game = Game(
                id=game_id,
                user_id=current_user.id,
                pgn_raw=pgn,
                source="chess_com",
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
            game_rows.append(game)
            game_ids_to_queue.append(str(game_id))
            queued += 1

    # Persist all new game rows in one transaction
    if game_rows:
        db.add_all(game_rows)
        await db.commit()

        # Enqueue analysis tasks only after DB is committed
        for gid in game_ids_to_queue:
            analyze_game.delay(gid)

    return ImportChessComResponse(
        username=username,
        queued=queued,
        skipped=skipped,
    )
