"""add_advanced_tournament_formats

Revision ID: b4c5d6e7f8a9
Revises: a3b4c5d6e7f8
Create Date: 2026-11-20 23:15:00.000000

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = 'b4c5d6e7f8a9'
down_revision: Union[str, None] = 'a3b4c5d6e7f8'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # 1. Novas colunas em seasons para suportar múltiplos formatos de campeonato
    op.add_column('seasons', sa.Column('name', sa.String(length=150), nullable=True))
    op.add_column('seasons', sa.Column('tournament_format', sa.String(length=30), server_default='individual_points', nullable=False))
    op.add_column('seasons', sa.Column('has_legs', sa.Boolean(), server_default='0', nullable=False))
    op.add_column('seasons', sa.Column('teams_per_group', sa.Integer(), nullable=True))
    op.add_column('seasons', sa.Column('advancing_per_group', sa.Integer(), nullable=True))

    # 2. Novas colunas e flexibilização em teams para equipes fixas do campeonato e grupos
    op.add_column('teams', sa.Column('season_id', sa.Integer(), nullable=True))
    op.create_foreign_key('fk_teams_season_id', 'teams', 'seasons', ['season_id'], ['id_season'], ondelete='CASCADE')
    op.add_column('teams', sa.Column('group_name', sa.String(length=20), nullable=True))
    op.alter_column('teams', 'round_id', existing_type=sa.Integer(), nullable=True)

    # 3. Novas colunas em matches para estágios de mata-mata, chaveamento e penalidades
    op.add_column('matches', sa.Column('stage', sa.String(length=30), server_default='regular', nullable=False))
    op.add_column('matches', sa.Column('bracket_position', sa.Integer(), nullable=True))
    op.add_column('matches', sa.Column('leg', sa.Integer(), server_default='1', nullable=False))
    op.add_column('matches', sa.Column('penalties_home', sa.Integer(), server_default='0', nullable=False))
    op.add_column('matches', sa.Column('penalties_away', sa.Integer(), server_default='0', nullable=False))


def downgrade() -> None:
    # Reverte matches
    op.drop_column('matches', 'penalties_away')
    op.drop_column('matches', 'penalties_home')
    op.drop_column('matches', 'leg')
    op.drop_column('matches', 'bracket_position')
    op.drop_column('matches', 'stage')

    # Reverte teams
    op.alter_column('teams', 'round_id', existing_type=sa.Integer(), nullable=False)
    op.drop_column('teams', 'group_name')
    op.drop_constraint('fk_teams_season_id', 'teams', type_='foreignkey')
    op.drop_column('teams', 'season_id')

    # Reverte seasons
    op.drop_column('seasons', 'advancing_per_group')
    op.drop_column('seasons', 'teams_per_group')
    op.drop_column('seasons', 'has_legs')
    op.drop_column('seasons', 'tournament_format')
    op.drop_column('seasons', 'name')
