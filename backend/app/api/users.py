"""
Users API router.

Endpoints:
  GET /api/users/me/games  — list all games for the current session token
"""

from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models.game import Game
from app.models.user import User
from app.schemas.game import GameStatusResponse

router = APIRouter()


@router.get("/me/games", response_model=list[GameStatusResponse])
async def list_my_games(
    session_token: str = Query(..., description="Anonymous session token"),
    db: AsyncSession = Depends(get_db),
):
    """Return all games submitted under this session token, newest first."""
    user = await db.scalar(
        select(User).where(User.session_token == session_token)
    )
    if user is None:
        raise HTTPException(status_code=404, detail="Session not found")

    result = await db.execute(
        select(Game)
        .where(Game.user_id == user.id)
        .order_by(Game.created_at.desc())
        .limit(50)
    )
    games = result.scalars().all()

    return [
        GameStatusResponse(
            game_id=g.id,
            status=g.status,
            error_message=g.error_message,
        )
        for g in games
    ]
