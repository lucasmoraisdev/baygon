"""add_polls_and_round_award_voting

Revision ID: 15b54a1eaef9
Revises: 0839e4b13207
Create Date: 2026-11-18 08:56:11.442666

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '15b54a1eaef9'
down_revision: Union[str, None] = '0839e4b13207'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # 1. Tabela de Enquetes da Temporada
    op.create_table('season_polls',
        sa.Column('id_poll', sa.Integer(), autoincrement=True, nullable=False),
        sa.Column('season_id', sa.Integer(), nullable=False),
        sa.Column('title', sa.String(length=255), nullable=False),
        sa.Column('description', sa.Text(), nullable=True),
        sa.Column('is_active', sa.Boolean(), server_default='1', nullable=False),
        sa.Column('multiple_choices', sa.Boolean(), server_default='0', nullable=False),
        sa.Column('starts_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('ends_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('created_by_user_id', sa.Integer(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=True),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=True),
        sa.Column('deleted_at', sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(['created_by_user_id'], ['users.id_user'], ondelete='SET NULL'),
        sa.ForeignKeyConstraint(['season_id'], ['seasons.id_season'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id_poll')
    )

    # 2. Tabela de Opções da Enquete
    op.create_table('season_poll_options',
        sa.Column('id_option', sa.Integer(), autoincrement=True, nullable=False),
        sa.Column('poll_id', sa.Integer(), nullable=False),
        sa.Column('title', sa.String(length=255), nullable=False),
        sa.Column('description', sa.String(length=500), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=True),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=True),
        sa.Column('deleted_at', sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(['poll_id'], ['season_polls.id_poll'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id_option')
    )

    # 3. Tabela de Votos da Enquete
    op.create_table('season_poll_votes',
        sa.Column('id_vote', sa.Integer(), autoincrement=True, nullable=False),
        sa.Column('poll_id', sa.Integer(), nullable=False),
        sa.Column('option_id', sa.Integer(), nullable=False),
        sa.Column('user_id', sa.Integer(), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=True),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=True),
        sa.Column('deleted_at', sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(['option_id'], ['season_poll_options.id_option'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['poll_id'], ['season_polls.id_poll'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['user_id'], ['users.id_user'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id_vote'),
        sa.UniqueConstraint('poll_id', 'user_id', 'option_id', name='uq_season_poll_user_option')
    )

    # 4. Coluna para abrir/fechar votação na rodada
    op.add_column('round', sa.Column('is_voting_open', sa.Boolean(), server_default='0', nullable=False))

    # 5. Tabela de Eleitores Designados da Rodada
    op.create_table('round_award_voters',
        sa.Column('id_voter', sa.Integer(), autoincrement=True, nullable=False),
        sa.Column('round_id', sa.Integer(), nullable=False),
        sa.Column('user_id', sa.Integer(), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=True),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=True),
        sa.Column('deleted_at', sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(['round_id'], ['round.id_round'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['user_id'], ['users.id_user'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id_voter'),
        sa.UniqueConstraint('round_id', 'user_id', name='uq_round_award_voter')
    )

    # 6. Tabela de Votos de Premiações da Rodada
    op.create_table('round_award_votes',
        sa.Column('id_vote', sa.Integer(), autoincrement=True, nullable=False),
        sa.Column('round_id', sa.Integer(), nullable=False),
        sa.Column('user_id', sa.Integer(), nullable=False),
        sa.Column('award_type', sa.String(length=50), nullable=False),
        sa.Column('player_id', sa.Integer(), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=True),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=True),
        sa.Column('deleted_at', sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(['player_id'], ['players.id_player'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['round_id'], ['round.id_round'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['user_id'], ['users.id_user'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id_vote'),
        sa.UniqueConstraint('round_id', 'user_id', 'award_type', name='uq_round_user_award_type')
    )


def downgrade() -> None:
    op.drop_table('round_award_votes')
    op.drop_table('round_award_voters')
    op.drop_column('round', 'is_voting_open')
    op.drop_table('season_poll_votes')
    op.drop_table('season_poll_options')
    op.drop_table('season_polls')
