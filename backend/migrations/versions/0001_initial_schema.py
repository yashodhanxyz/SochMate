"""Initial schema

Revision ID: 0001
Revises:
Create Date: 2026-04-16
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = "0001"
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    # users
    op.create_table(
        "users",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("session_token", sa.String(), nullable=True),
        sa.Column("email", sa.String(), nullable=True),
        sa.Column("username", sa.String(), nullable=True),
        sa.Column("chess_com_username", sa.String(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_users_session_token", "users", ["session_token"], unique=True)
    op.create_index("ix_users_email", "users", ["email"], unique=True)

    # games
    op.create_table(
        "games",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("pgn_raw", sa.Text(), nullable=False),
        sa.Column("source", sa.String(20), nullable=False),
        sa.Column("chess_com_game_id", sa.String(), nullable=True),
        sa.Column("white_player", sa.String(), nullable=True),
        sa.Column("black_player", sa.String(), nullable=True),
        sa.Column("user_color", sa.String(5), nullable=True),
        sa.Column("result", sa.String(10), nullable=True),
        sa.Column("time_control", sa.String(20), nullable=True),
        sa.Column("eco_code", sa.String(10), nullable=True),
        sa.Column("opening_name", sa.String(), nullable=True),
        sa.Column("white_elo", sa.Integer(), nullable=True),
        sa.Column("black_elo", sa.Integer(), nullable=True),
        sa.Column("played_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("status", sa.String(20), nullable=False, server_default="pending"),
        sa.Column("error_message", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_games_user_id", "games", ["user_id"])
    op.create_index("ix_games_chess_com_game_id", "games", ["chess_com_game_id"], unique=True)

    # moves
    op.create_table(
        "moves",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("game_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("ply_number", sa.Integer(), nullable=False),
        sa.Column("move_number", sa.Integer(), nullable=False),
        sa.Column("color", sa.String(5), nullable=False),
        sa.Column("san", sa.String(10), nullable=False),
        sa.Column("uci", sa.String(10), nullable=False),
        sa.Column("fen_before", sa.Text(), nullable=False),
        sa.Column("fen_after", sa.Text(), nullable=False),
        sa.Column("eval_before_cp", sa.Integer(), nullable=True),
        sa.Column("eval_after_cp", sa.Integer(), nullable=True),
        sa.Column("eval_before_mate", sa.Integer(), nullable=True),
        sa.Column("eval_after_mate", sa.Integer(), nullable=True),
        sa.Column("eval_delta_cp", sa.Integer(), nullable=True),
        sa.Column("best_move_san", sa.String(10), nullable=True),
        sa.Column("best_move_uci", sa.String(10), nullable=True),
        sa.Column("classification", sa.String(15), nullable=True),
        sa.Column("explanation", sa.Text(), nullable=True),
        sa.Column("pattern_tag", sa.String(50), nullable=True),
        sa.ForeignKeyConstraint(["game_id"], ["games.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("game_id", "ply_number"),
    )
    op.create_index("ix_moves_game_id", "moves", ["game_id"])
    op.create_index("ix_moves_classification", "moves", ["game_id", "classification"])

    # game_summaries
    op.create_table(
        "game_summaries",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("game_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("accuracy_white", sa.Numeric(5, 2), nullable=True),
        sa.Column("accuracy_black", sa.Numeric(5, 2), nullable=True),
        sa.Column("blunders_white", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("blunders_black", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("mistakes_white", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("mistakes_black", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("inaccuracies_white", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("inaccuracies_black", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("critical_moment_ply", sa.Integer(), nullable=True),
        sa.Column("summary_text", sa.Text(), nullable=True),
        sa.Column("stockfish_version", sa.String(20), nullable=True),
        sa.Column("analysis_depth", sa.Integer(), nullable=True),
        sa.Column("analysis_time_ms", sa.Integer(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(["game_id"], ["games.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("game_id"),
    )
    op.create_index("ix_game_summaries_game_id", "game_summaries", ["game_id"])


def downgrade() -> None:
    op.drop_table("game_summaries")
    op.drop_table("moves")
    op.drop_table("games")
    op.drop_table("users")
