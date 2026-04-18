from __future__ import annotations

import uuid
from datetime import datetime

from pydantic import BaseModel, field_validator


# ---------------------------------------------------------------------------
# Request schemas
# ---------------------------------------------------------------------------

class GameSubmitRequest(BaseModel):
    """
    Submitted by the user when they want to analyze a game.
    The input field accepts either a Chess.com URL or raw PGN text.
    """
    input: str                          # Chess.com URL or raw PGN
    user_color: str | None = None       # 'white' | 'black' | None (auto-detect)

    @field_validator("user_color")
    @classmethod
    def validate_color(cls, v: str | None) -> str | None:
        if v is not None and v not in ("white", "black"):
            raise ValueError("user_color must be 'white', 'black', or null")
        return v


# ---------------------------------------------------------------------------
# Response schemas
# ---------------------------------------------------------------------------

class MoveResponse(BaseModel):
    ply_number: int
    move_number: int
    color: str
    san: str
    uci: str
    fen_before: str
    fen_after: str
    eval_before_cp: int | None
    eval_after_cp: int | None
    eval_before_mate: int | None
    eval_after_mate: int | None
    eval_delta_cp: int | None
    best_move_san: str | None
    best_move_uci: str | None
    classification: str | None
    explanation: str | None
    pattern_tag: str | None  # fork | hanging | pin | skewer | discovered_attack | back_rank

    model_config = {"from_attributes": True}


class GameSummaryResponse(BaseModel):
    accuracy_white: float | None
    accuracy_black: float | None
    blunders_white: int
    blunders_black: int
    mistakes_white: int
    mistakes_black: int
    inaccuracies_white: int
    inaccuracies_black: int
    critical_moment_ply: int | None
    summary_text: str | None

    model_config = {"from_attributes": True}


class GameStatusResponse(BaseModel):
    """Lightweight response for polling the analysis status."""
    game_id: uuid.UUID
    status: str          # pending | processing | done | failed
    error_message: str | None = None


class GameResponse(BaseModel):
    """Full game response including moves and summary (only available when done)."""
    game_id: uuid.UUID
    status: str
    source: str
    white_player: str | None
    black_player: str | None
    user_color: str | None
    result: str | None
    time_control: str | None
    eco_code: str | None
    opening_name: str | None
    white_elo: int | None
    black_elo: int | None
    played_at: datetime | None
    created_at: datetime
    moves: list[MoveResponse] = []
    summary: GameSummaryResponse | None = None

    model_config = {"from_attributes": True}


class GameSubmitResponse(BaseModel):
    """Returned immediately after submitting a game for analysis."""
    game_id: uuid.UUID
    status: str


class OpeningStatsItem(BaseModel):
    """Aggregated performance stats for a single opening."""
    opening_name: str | None
    eco_code: str | None
    games_played: int
    wins: int
    draws: int
    losses: int
    avg_accuracy: float | None


class GameListItemResponse(BaseModel):
    """Lightweight game summary for the dashboard list."""
    game_id: uuid.UUID
    status: str
    source: str
    white_player: str | None
    black_player: str | None
    user_color: str | None
    result: str | None
    opening_name: str | None
    eco_code: str | None
    time_control: str | None
    white_elo: int | None
    black_elo: int | None
    played_at: datetime | None
    created_at: datetime
    # Flattened from GameSummary (None when analysis not done)
    accuracy_white: float | None = None
    accuracy_black: float | None = None
    blunders_white: int | None = None
    blunders_black: int | None = None
    mistakes_white: int | None = None
    mistakes_black: int | None = None
    inaccuracies_white: int | None = None
    inaccuracies_black: int | None = None

    model_config = {"from_attributes": True}
