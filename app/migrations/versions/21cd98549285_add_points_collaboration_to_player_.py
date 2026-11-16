"""add_points_collaboration_to_player_scores

Revision ID: 21cd98549285
Revises: cc321803d181
Create Date: 2026-11-16 09:37:16.950400

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '21cd98549285'
down_revision: Union[str, None] = 'cc321803d181'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('player_scores', sa.Column('points_collaboration', sa.Integer(), nullable=False, server_default='0'))


def downgrade() -> None:
    op.drop_column('player_scores', 'points_collaboration')
