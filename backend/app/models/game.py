import uuid
from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, Integer, String, Text, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class Game(Base):
    __tablename__ = "games"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), index=True
    )

    # Raw input
    pgn_raw: Mapped[str] = mapped_column(Text, nullable=False)
    source: Mapped[str] = mapped_column(String(20), nullable=False)  # chess_com | lichess | manual_pgn
    chess_com_game_id: Mapped[str | None] = mapped_column(String, unique=True, index=True)
    lichess_game_id: Mapped[str | None] = mapped_column(String, index=True)

    # Game metadata parsed from PGN headers
    white_player: Mapped[str | None] = mapped_column(String)
    black_player: Mapped[str | None] = mapped_column(String)
    user_color: Mapped[str | None] = mapped_column(String(5))  # white | black
    result: Mapped[str | None] = mapped_column(String(10))    # 1-0 | 0-1 | 1/2-1/2 | *
    time_control: Mapped[str | None] = mapped_column(String(20))
    eco_code: Mapped[str | None] = mapped_column(String(10))
    opening_name: Mapped[str | None] = mapped_column(String)
    white_elo: Mapped[int | None] = mapped_column(Integer)
    black_elo: Mapped[int | None] = mapped_column(Integer)
    played_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))

    # Pipeline state
    status: Mapped[str] = mapped_column(
        String(20), nullable=False, default="pending"
    )  # pending | processing | done | failed
    error_message: Mapped[str | None] = mapped_column(Text)

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )

    # Relationships
    user: Mapped["User"] = relationship(back_populates="games")  # noqa: F821
    moves: Mapped[list["Move"]] = relationship(  # noqa: F821
        back_populates="game", order_by="Move.ply_number"
    )
    summary: Mapped["GameSummary | None"] = relationship(  # noqa: F821
        back_populates="game", uselist=False
    )
