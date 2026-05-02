"""Create player_admin_actions table

Revision ID: player_admin_actions_001
Revises: None
Create Date: 2026-04-24 00:00:00.000000

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import mysql

# revision identifiers, used by Alembic.
revision = 'player_admin_actions_001'
down_revision = '20260424_add_player_posicao_pe'
branch_labels = None
depends_on = None


def upgrade():
    # Create player_admin_actions table
    op.create_table(
        'player_admin_actions',
        sa.Column('id_action', sa.Integer(), nullable=False, autoincrement=True),
        sa.Column('player_id', sa.Integer(), nullable=False),
        sa.Column('admin_id', sa.Integer(), nullable=False),
        sa.Column('action_type', sa.String(50), nullable=False),
        sa.Column('description', sa.Text(), nullable=True),
        sa.Column('suspension_days', sa.Integer(), nullable=True),
        sa.Column('suspension_until', sa.DateTime(), nullable=True),
        sa.Column('fine_amount', sa.Float(), nullable=True),
        sa.Column('observations', sa.Text(), nullable=True),
        sa.Column('is_active', sa.Boolean(), default=True),
        sa.Column('created_at', sa.DateTime(), nullable=True, server_default=sa.func.now()),
        sa.Column('updated_at', sa.DateTime(), nullable=True, server_default=sa.func.now(), onupdate=sa.func.now()),
        sa.Column('deleted_at', sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(['player_id'], ['players.id_player']),
        sa.ForeignKeyConstraint(['admin_id'], ['users.id_user']),
        sa.PrimaryKeyConstraint('id_action'),
        sa.Index('ix_player_admin_actions_player_id', 'player_id'),
        sa.Index('ix_player_admin_actions_admin_id', 'admin_id'),
        sa.Index('ix_player_admin_actions_action_type', 'action_type'),
    )


def downgrade():
    op.drop_table('player_admin_actions')
