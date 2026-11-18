"""add_financial_module_tables

Revision ID: 2f7be20d8e42
Revises: 15b54a1eaef9
Create Date: 2026-11-18 17:49:20.598617

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '2f7be20d8e42'
down_revision: Union[str, None] = '15b54a1eaef9'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table('financial_costs',
        sa.Column('id_cost', sa.Integer(), autoincrement=True, nullable=False),
        sa.Column('description', sa.String(length=255), nullable=False),
        sa.Column('category', sa.String(length=100), nullable=False),
        sa.Column('amount', sa.Numeric(precision=10, scale=2), nullable=False),
        sa.Column('cost_date', sa.DateTime(timezone=True), nullable=False),
        sa.Column('status', sa.String(length=20), nullable=False),
        sa.Column('paid_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('payment_method', sa.String(length=50), nullable=True),
        sa.Column('notes', sa.String(length=500), nullable=True),
        sa.Column('season_id', sa.Integer(), nullable=True),
        sa.Column('created_by_user_id', sa.Integer(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=True),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=True),
        sa.Column('deleted_at', sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(['created_by_user_id'], ['users.id_user'], ondelete='SET NULL'),
        sa.ForeignKeyConstraint(['season_id'], ['seasons.id_season'], ondelete='SET NULL'),
        sa.PrimaryKeyConstraint('id_cost')
    )

    op.create_table('financial_monthly_fees',
        sa.Column('id_fee', sa.Integer(), autoincrement=True, nullable=False),
        sa.Column('player_id', sa.Integer(), nullable=False),
        sa.Column('year', sa.Integer(), nullable=False),
        sa.Column('month', sa.Integer(), nullable=False),
        sa.Column('amount', sa.Numeric(precision=10, scale=2), nullable=False),
        sa.Column('status', sa.String(length=20), nullable=False),
        sa.Column('paid_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('payment_method', sa.String(length=50), nullable=True),
        sa.Column('notes', sa.String(length=500), nullable=True),
        sa.Column('season_id', sa.Integer(), nullable=True),
        sa.Column('created_by_user_id', sa.Integer(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=True),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=True),
        sa.Column('deleted_at', sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(['created_by_user_id'], ['users.id_user'], ondelete='SET NULL'),
        sa.ForeignKeyConstraint(['player_id'], ['players.id_player'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['season_id'], ['seasons.id_season'], ondelete='SET NULL'),
        sa.PrimaryKeyConstraint('id_fee'),
        sa.UniqueConstraint('player_id', 'year', 'month', name='uq_player_month_fee')
    )


def downgrade() -> None:
    op.drop_table('financial_monthly_fees')
    op.drop_table('financial_costs')
