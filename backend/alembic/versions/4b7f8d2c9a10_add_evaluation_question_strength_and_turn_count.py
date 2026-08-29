"""add evaluation question strength and turn count

Revision ID: 4b7f8d2c9a10
Revises: ac90a1a923cd
Create Date: 2026-08-29 20:15:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "4b7f8d2c9a10"
down_revision: Union[str, Sequence[str], None] = "ac90a1a923cd"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Add nullable metadata without changing existing evaluation rows."""
    op.add_column("evaluations", sa.Column("question_strength", sa.String(), nullable=True))
    op.add_column("evaluations", sa.Column("turn_count", sa.Integer(), nullable=True))


def downgrade() -> None:
    """Remove evaluation metadata columns."""
    op.drop_column("evaluations", "turn_count")
    op.drop_column("evaluations", "question_strength")
