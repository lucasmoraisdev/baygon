"""add_extra_matches_to_player_scores

Revision ID: d013b55582e8
Revises: 5e15725307ab
Create Date: 2026-11-16 11:59:21.634043

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'd013b55582e8'
down_revision: Union[str, None] = '5e15725307ab'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('player_scores', sa.Column('extra_matches_won', sa.Integer(), nullable=False, server_default='0'))
    op.add_column('player_scores', sa.Column('extra_matches_drawn', sa.Integer(), nullable=False, server_default='0'))
    op.add_column('player_scores', sa.Column('extra_matches_lost', sa.Integer(), nullable=False, server_default='0'))


def downgrade() -> None:
    op.drop_column('player_scores', 'extra_matches_lost')
    op.drop_column('player_scores', 'extra_matches_drawn')
    op.drop_column('player_scores', 'extra_matches_won')
