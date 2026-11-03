"""Add suspension types

Revision ID: 3b372a5a0f80
Revises: 4367d373ab57
Create Date: 2026-05-01 22:21:16.013949

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '3b372a5a0f80'
down_revision: Union[str, None] = '4367d373ab57'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Add suspension_matches and is_indefinite columns required by PlayerAdminAction model
    # (In MySQL, ix_player_admin_actions_admin_id and ix_player_admin_actions_player_id
    # cannot be dropped because they back foreign key constraints.)
    op.add_column('player_admin_actions', sa.Column('suspension_matches', sa.Integer(), nullable=True))
    op.add_column('player_admin_actions', sa.Column('is_indefinite', sa.Boolean(), nullable=False, server_default=sa.text('0')))


def downgrade() -> None:
    op.drop_column('player_admin_actions', 'is_indefinite')
    op.drop_column('player_admin_actions', 'suspension_matches')
