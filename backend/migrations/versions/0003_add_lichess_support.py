"""Add lichess_game_id to games

Revision ID: 0003
Revises: 0002
Create Date: 2026-04-18
"""

from alembic import op
import sqlalchemy as sa

revision = "0003"
down_revision = "0002"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "games",
        sa.Column("lichess_game_id", sa.String(), nullable=True),
    )
    op.create_index(
        "ix_games_lichess_game_id",
        "games",
        ["lichess_game_id"],
    )


def downgrade() -> None:
    op.drop_index("ix_games_lichess_game_id", table_name="games")
    op.drop_column("games", "lichess_game_id")
