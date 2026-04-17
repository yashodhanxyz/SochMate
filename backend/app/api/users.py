"""
Users API router.

Endpoints:
  GET /api/users/me/games  — list all games for the authenticated user
"""

from __future__ import annotations

from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user
from app.database import get_db
from app.models.game import Game
from app.models.user import User
from app.schemas.game import GameListItemResponse

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
    )
    games = result.scalars().all()

    return [
        GameListItemResponse(
            game_id=g.id,
            status=g.status,
            source=g.source,
            white_player=g.white_player,
            black_player=g.black_player,
            user_color=g.user_color,
            result=g.result,
            opening_name=g.opening_name,
            eco_code=g.eco_code,
            played_at=g.played_at,
            created_at=g.created_at,
        )
        for g in games
    ]
