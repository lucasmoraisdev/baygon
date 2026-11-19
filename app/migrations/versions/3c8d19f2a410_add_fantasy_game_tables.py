"""add_fantasy_game_tables

Revision ID: 3c8d19f2a410
Revises: 2f7be20d8e42
Create Date: 2026-11-18 20:54:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '3c8d19f2a410'
down_revision: Union[str, None] = '2f7be20d8e42'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # 1. Configurações gerais do Fantasy por temporada
    op.create_table(
        'fantasy_settings',
        sa.Column('id_fantasy_setting', sa.Integer(), autoincrement=True, nullable=False),
        sa.Column('season_id', sa.Integer(), nullable=False),
        sa.Column('is_enabled', sa.Boolean(), server_default='1', nullable=False),
        sa.Column('initial_budget', sa.Numeric(precision=10, scale=2), server_default='100.00', nullable=False),
        sa.Column('min_player_price', sa.Numeric(precision=10, scale=2), server_default='1.00', nullable=False),
        sa.Column('max_price_variation', sa.Numeric(precision=10, scale=2), server_default='5.00', nullable=False),
        sa.Column('appreciation_factor', sa.Numeric(precision=10, scale=4), server_default='0.5000', nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=True),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=True),
        sa.Column('deleted_at', sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(['season_id'], ['seasons.id_season'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id_fantasy_setting'),
        sa.UniqueConstraint('season_id')
    )

    # 2. Configurações da Rodada do Fantasy
    op.create_table(
        'fantasy_round_configs',
        sa.Column('id_round_config', sa.Integer(), autoincrement=True, nullable=False),
        sa.Column('round_id', sa.Integer(), nullable=False),
        sa.Column('total_slots', sa.Integer(), server_default='5', nullable=False),
        sa.Column('is_market_open', sa.Boolean(), server_default='1', nullable=False),
        sa.Column('market_closes_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('status', sa.String(length=20), server_default='OPEN', nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=True),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=True),
        sa.Column('deleted_at', sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(['round_id'], ['round.id_round'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id_round_config'),
        sa.UniqueConstraint('round_id')
    )

    # 3. Regras de Slots por Posição ou Pote na Rodada
    op.create_table(
        'fantasy_round_slot_rules',
        sa.Column('id_slot_rule', sa.Integer(), autoincrement=True, nullable=False),
        sa.Column('round_config_id', sa.Integer(), nullable=False),
        sa.Column('slot_type', sa.String(length=20), server_default='POSITION', nullable=False),
        sa.Column('target_value', sa.String(length=50), nullable=False),
        sa.Column('required_quantity', sa.Integer(), server_default='1', nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=True),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=True),
        sa.Column('deleted_at', sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(['round_config_id'], ['fantasy_round_configs.id_round_config'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id_slot_rule')
    )

    # 4. Jogador no Mercado Fantasy
    op.create_table(
        'fantasy_players',
        sa.Column('id_fantasy_player', sa.Integer(), autoincrement=True, nullable=False),
        sa.Column('player_id', sa.Integer(), nullable=False),
        sa.Column('season_id', sa.Integer(), nullable=False),
        sa.Column('current_price', sa.Numeric(precision=10, scale=2), server_default='10.00', nullable=False),
        sa.Column('last_variation', sa.Numeric(precision=10, scale=2), server_default='0.00', nullable=False),
        sa.Column('status', sa.String(length=20), server_default='PROBABLE', nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=True),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=True),
        sa.Column('deleted_at', sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(['player_id'], ['players.id_player'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['season_id'], ['seasons.id_season'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id_fantasy_player'),
        sa.UniqueConstraint('player_id', 'season_id', name='uq_fantasy_player_season')
    )

    # 5. Times dos Usuários no Fantasy
    op.create_table(
        'fantasy_teams',
        sa.Column('id_fantasy_team', sa.Integer(), autoincrement=True, nullable=False),
        sa.Column('user_id', sa.Integer(), nullable=False),
        sa.Column('season_id', sa.Integer(), nullable=False),
        sa.Column('name', sa.String(length=100), server_default='Meu Time Fantasy', nullable=False),
        sa.Column('budget', sa.Numeric(precision=10, scale=2), server_default='100.00', nullable=False),
        sa.Column('total_wealth', sa.Numeric(precision=10, scale=2), server_default='100.00', nullable=False),
        sa.Column('total_points', sa.Numeric(precision=10, scale=2), server_default='0.00', nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=True),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=True),
        sa.Column('deleted_at', sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(['season_id'], ['seasons.id_season'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['user_id'], ['users.id_user'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id_fantasy_team'),
        sa.UniqueConstraint('user_id', 'season_id', name='uq_fantasy_team_user_season')
    )

    # 6. Escalações por Rodada
    op.create_table(
        'fantasy_lineups',
        sa.Column('id_fantasy_lineup', sa.Integer(), autoincrement=True, nullable=False),
        sa.Column('fantasy_team_id', sa.Integer(), nullable=False),
        sa.Column('round_id', sa.Integer(), nullable=False),
        sa.Column('total_spent', sa.Numeric(precision=10, scale=2), server_default='0.00', nullable=False),
        sa.Column('cash_remaining', sa.Numeric(precision=10, scale=2), server_default='0.00', nullable=False),
        sa.Column('points_scored', sa.Numeric(precision=10, scale=2), server_default='0.00', nullable=False),
        sa.Column('wealth_variation', sa.Numeric(precision=10, scale=2), server_default='0.00', nullable=False),
        sa.Column('is_finalized', sa.Boolean(), server_default='0', nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=True),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=True),
        sa.Column('deleted_at', sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(['fantasy_team_id'], ['fantasy_teams.id_fantasy_team'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['round_id'], ['round.id_round'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id_fantasy_lineup'),
        sa.UniqueConstraint('fantasy_team_id', 'round_id', name='uq_fantasy_lineup_team_round')
    )

    # 7. Jogadores na Escalação da Rodada
    op.create_table(
        'fantasy_lineup_players',
        sa.Column('id_lineup_player', sa.Integer(), autoincrement=True, nullable=False),
        sa.Column('lineup_id', sa.Integer(), nullable=False),
        sa.Column('player_id', sa.Integer(), nullable=False),
        sa.Column('slot_label', sa.String(length=50), nullable=False),
        sa.Column('purchase_price', sa.Numeric(precision=10, scale=2), server_default='0.00', nullable=False),
        sa.Column('points_earned', sa.Numeric(precision=10, scale=2), server_default='0.00', nullable=False),
        sa.Column('price_variation', sa.Numeric(precision=10, scale=2), server_default='0.00', nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=True),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=True),
        sa.Column('deleted_at', sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(['lineup_id'], ['fantasy_lineups.id_fantasy_lineup'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['player_id'], ['players.id_player'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id_lineup_player'),
        sa.UniqueConstraint('lineup_id', 'player_id', name='uq_fantasy_lineup_player_unique')
    )


def downgrade() -> None:
    op.drop_table('fantasy_lineup_players')
    op.drop_table('fantasy_lineups')
    op.drop_table('fantasy_teams')
    op.drop_table('fantasy_players')
    op.drop_table('fantasy_round_slot_rules')
    op.drop_table('fantasy_round_configs')
    op.drop_table('fantasy_settings')
