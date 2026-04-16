import uuid

from sqlalchemy import ForeignKey, Integer, String, Text, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class Move(Base):
    __tablename__ = "moves"
    __table_args__ = (UniqueConstraint("game_id", "ply_number"),)

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    game_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("games.id", ondelete="CASCADE"), index=True
    )

    # Position in the game
    ply_number: Mapped[int] = mapped_column(Integer, nullable=False)   # 1-indexed half-moves
    move_number: Mapped[int] = mapped_column(Integer, nullable=False)  # chess move number
    color: Mapped[str] = mapped_column(String(5), nullable=False)      # white | black

    # The move itself
    san: Mapped[str] = mapped_column(String(10), nullable=False)       # e.g. Nxe5
    uci: Mapped[str] = mapped_column(String(10), nullable=False)       # e.g. g1f3

    # Board states
    fen_before: Mapped[str] = mapped_column(Text, nullable=False)
    fen_after: Mapped[str] = mapped_column(Text, nullable=False)

    # Engine evaluation (all from white's absolute perspective in centipawns)
    eval_before_cp: Mapped[int | None] = mapped_column(Integer)
    eval_after_cp: Mapped[int | None] = mapped_column(Integer)
    eval_before_mate: Mapped[int | None] = mapped_column(Integer)      # mate-in-N, negative = being mated
    eval_after_mate: Mapped[int | None] = mapped_column(Integer)

    # Derived fields (from moving player's perspective)
    eval_delta_cp: Mapped[int | None] = mapped_column(Integer)         # centipawn loss (positive = worse)

    # Best move at this position
    best_move_san: Mapped[str | None] = mapped_column(String(10))
    best_move_uci: Mapped[str | None] = mapped_column(String(10))

    # Classification and feedback
    classification: Mapped[str | None] = mapped_column(String(15))
    # best | excellent | good | inaccuracy | mistake | blunder
    explanation: Mapped[str | None] = mapped_column(Text)
    pattern_tag: Mapped[str | None] = mapped_column(String(50))        # V2: pattern detection

    # Relationships
    game: Mapped["Game"] = relationship(back_populates="moves")  # noqa: F821
