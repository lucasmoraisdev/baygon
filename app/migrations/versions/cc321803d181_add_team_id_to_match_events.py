"""add_team_id_to_match_events

Revision ID: cc321803d181
Revises: match_is_finished_001
Create Date: 2026-11-15 17:39:00.546626

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'cc321803d181'
down_revision: Union[str, None] = 'match_is_finished_001'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('match_events', sa.Column('team_id', sa.Integer(), nullable=True))
    op.create_foreign_key('fk_match_events_team', 'match_events', 'teams', ['team_id'], ['id_team'], ondelete='SET NULL')


def downgrade() -> None:
    op.drop_constraint('fk_match_events_team', 'match_events', type_='foreignkey')
    op.drop_column('match_events', 'team_id')
