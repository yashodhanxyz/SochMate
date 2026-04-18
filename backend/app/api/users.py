"""
Users API router.

Endpoints:
  GET /api/users/me/games  — list all games for the authenticated user
"""

from __future__ import annotations

from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.api.deps import get_current_user
from app.database import get_db
from app.models.game import Game
from app.models.user import User
from app.schemas.game import GameListItemResponse, OpeningStatsItem

router = APIRouter()


@router.get("/me/games", response_model=list[GameListItemResponse])
async def list_my_games(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Return all games for the authenticated user, newest first."""
    result = await db.execute(
        select(Game)
        .where(Game.user_id == current_user.id)
        .order_by(Game.created_at.desc())
        .limit(50)
        .options(selectinload(Game.summary))
    )
    games = result.scalars().all()

    items = []
    for g in games:
        s = g.summary  # may be None if analysis not done yet

        items.append(GameListItemResponse(
            game_id=g.id,
            status=g.status,
            source=g.source,
            white_player=g.white_player,
            black_player=g.black_player,
            user_color=g.user_color,
            result=g.result,
            opening_name=g.opening_name,
            eco_code=g.eco_code,
            time_control=g.time_control,
            white_elo=g.white_elo,
            black_elo=g.black_elo,
            played_at=g.played_at,
            created_at=g.created_at,
            accuracy_white=s.accuracy_white if s else None,
            accuracy_black=s.accuracy_black if s else None,
            blunders_white=s.blunders_white if s else None,
            blunders_black=s.blunders_black if s else None,
            mistakes_white=s.mistakes_white if s else None,
            mistakes_black=s.mistakes_black if s else None,
            inaccuracies_white=s.inaccuracies_white if s else None,
            inaccuracies_black=s.inaccuracies_black if s else None,
        ))

    return items


@router.get("/me/openings", response_model=list[OpeningStatsItem])
async def get_opening_stats(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Return per-opening performance stats for the authenticated user."""
    result = await db.execute(
        select(Game)
        .where(Game.user_id == current_user.id, Game.status == "done")
        .order_by(Game.created_at.desc())
        .limit(200)
        .options(selectinload(Game.summary))
    )
    games = result.scalars().all()

    # Aggregate in Python — group by (opening_name, eco_code)
    from collections import defaultdict

    buckets: dict[tuple, dict] = defaultdict(lambda: {
        "wins": 0, "draws": 0, "losses": 0, "accuracy_sum": 0.0, "accuracy_count": 0
    })

    for g in games:
        key = (g.opening_name, g.eco_code)
        b = buckets[key]

        # Result from user's perspective
        if g.result == "1/2-1/2":
            b["draws"] += 1
        elif (g.result == "1-0" and g.user_color == "white") or \
             (g.result == "0-1" and g.user_color == "black"):
            b["wins"] += 1
        else:
            b["losses"] += 1

        # Accuracy for the user's color
        if g.summary:
            acc = (
                g.summary.accuracy_white
                if g.user_color == "white"
                else g.summary.accuracy_black
            )
            if acc is not None:
                b["accuracy_sum"] += float(acc)
                b["accuracy_count"] += 1

    items = []
    for (opening_name, eco_code), b in buckets.items():
        games_played = b["wins"] + b["draws"] + b["losses"]
        avg_accuracy = (
            round(b["accuracy_sum"] / b["accuracy_count"], 1)
            if b["accuracy_count"] > 0
            else None
        )
        items.append(OpeningStatsItem(
            opening_name=opening_name,
            eco_code=eco_code,
            games_played=games_played,
            wins=b["wins"],
            draws=b["draws"],
            losses=b["losses"],
            avg_accuracy=avg_accuracy,
        ))

    # Sort by games played descending
    items.sort(key=lambda x: x.games_played, reverse=True)
    return items
