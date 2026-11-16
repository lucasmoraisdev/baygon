"""add_roulette_prizes_and_winners

Revision ID: 0839e4b13207
Revises: d013b55582e8
Create Date: 2026-11-16 12:10:08.361788

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '0839e4b13207'
down_revision: Union[str, None] = 'd013b55582e8'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        'roulette_prizes',
        sa.Column('id_roulette_prize', sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column('name', sa.String(100), nullable=False),
        sa.Column('description', sa.String(255), nullable=True),
        sa.Column('is_active', sa.Boolean(), nullable=False, server_default='1'),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('CURRENT_TIMESTAMP'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('deleted_at', sa.DateTime(timezone=True), nullable=True),
    )

    op.create_table(
        'round_roulette_winners',
        sa.Column('id_round_roulette', sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column('round_id', sa.Integer(), sa.ForeignKey('round.id_round', ondelete='CASCADE'), nullable=False),
        sa.Column('player_id', sa.Integer(), sa.ForeignKey('players.id_player', ondelete='CASCADE'), nullable=False),
        sa.Column('prize_id', sa.Integer(), sa.ForeignKey('roulette_prizes.id_roulette_prize', ondelete='SET NULL'), nullable=True),
        sa.Column('roulette_number', sa.Integer(), nullable=False, server_default='1'),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('CURRENT_TIMESTAMP'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('deleted_at', sa.DateTime(timezone=True), nullable=True),
    )


def downgrade() -> None:
    op.drop_table('round_roulette_winners')
    op.drop_table('roulette_prizes')
