"""add user_id to evaluations

Revision ID: ba6e9699d14a
Revises: 1bad0da8867c
Create Date: 2026-08-19 15:22:18.066769

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'ba6e9699d14a'
down_revision: Union[str, Sequence[str], None] = '1bad0da8867c'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    # 既存行は user_id を持たない開発用シードのみなので消してから NOT NULL カラムを足す
    # （テーブルが空になれば起動時の seed_evaluations が user_id 付きで再投入する）
    op.execute("DELETE FROM evaluations")
    op.add_column('evaluations', sa.Column('user_id', sa.Integer(), nullable=False))
    op.create_index(op.f('ix_evaluations_user_id'), 'evaluations', ['user_id'], unique=False)
    op.create_foreign_key('fk_evaluations_user_id_users', 'evaluations', 'users', ['user_id'], ['id'])


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_constraint('fk_evaluations_user_id_users', 'evaluations', type_='foreignkey')
    op.drop_index(op.f('ix_evaluations_user_id'), table_name='evaluations')
    op.drop_column('evaluations', 'user_id')
