import uuid
from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, Integer, Numeric, String, Text, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class GameSummary(Base):
    __tablename__ = "game_summaries"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    game_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("games.id", ondelete="CASCADE"),
        unique=True,
        index=True,
    )

    # Per-player accuracy (0.00 – 100.00)
    accuracy_white: Mapped[float | None] = mapped_column(Numeric(5, 2))
    accuracy_black: Mapped[float | None] = mapped_column(Numeric(5, 2))

    # Classification counts
    blunders_white: Mapped[int] = mapped_column(Integer, default=0)
    blunders_black: Mapped[int] = mapped_column(Integer, default=0)
    mistakes_white: Mapped[int] = mapped_column(Integer, default=0)
    mistakes_black: Mapped[int] = mapped_column(Integer, default=0)
    inaccuracies_white: Mapped[int] = mapped_column(Integer, default=0)
    inaccuracies_black: Mapped[int] = mapped_column(Integer, default=0)

    # Key moments
    critical_moment_ply: Mapped[int | None] = mapped_column(Integer)   # ply with biggest swing

    # Narrative
    summary_text: Mapped[str | None] = mapped_column(Text)

    # Analysis metadata
    stockfish_version: Mapped[str | None] = mapped_column(String(20))
    analysis_depth: Mapped[int | None] = mapped_column(Integer)
    analysis_time_ms: Mapped[int | None] = mapped_column(Integer)

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )

    game: Mapped["Game"] = relationship(back_populates="summary")  # noqa: F821
