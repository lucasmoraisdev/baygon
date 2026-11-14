"""Add is_finished and finished_at to matches

Revision ID: match_is_finished_001
Revises: 3b372a5a0f80
Create Date: 2026-11-13 13:20:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'match_is_finished_001'
down_revision: Union[str, None] = '3b372a5a0f80'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        'matches',
        sa.Column('is_finished', sa.Boolean(), nullable=False, server_default=sa.text('0')),
    )
    op.add_column(
        'matches',
        sa.Column('finished_at', sa.DateTime(timezone=True), nullable=True),
    )


def downgrade() -> None:
    op.drop_column('matches', 'finished_at')
    op.drop_column('matches', 'is_finished')

