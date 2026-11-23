"""add_webhook_events_table

Revision ID: a3b4c5d6e7f8
Revises: f2b3c4d5e6f7
Create Date: 2026-11-20 22:15:00.000000

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = 'a3b4c5d6e7f8'
down_revision: Union[str, None] = 'f2b3c4d5e6f7'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        'webhook_events',
        sa.Column('id_webhook_event', sa.Integer(), autoincrement=True, nullable=False),
        sa.Column('event_id', sa.String(length=100), nullable=False),
        sa.Column('gateway', sa.String(length=50), nullable=False, server_default='stripe'),
        sa.Column('event_type', sa.String(length=100), nullable=False),
        sa.Column('status', sa.String(length=30), nullable=False, server_default='processed'),
        sa.Column('payload', sa.Text(), nullable=True),
        sa.Column('error_message', sa.Text(), nullable=True),
        sa.Column('created_at', sa.DateTime(), server_default=sa.func.now(), nullable=False),
        sa.Column('updated_at', sa.DateTime(), server_default=sa.func.now(), onupdate=sa.func.now(), nullable=False),
        sa.Column('deleted_at', sa.DateTime(), nullable=True),
        sa.PrimaryKeyConstraint('id_webhook_event'),
    )
    op.create_index('ix_webhook_events_event_id', 'webhook_events', ['event_id'], unique=True)
    op.create_index('ix_webhook_events_event_type', 'webhook_events', ['event_type'])


def downgrade() -> None:
    op.drop_index('ix_webhook_events_event_type', table_name='webhook_events')
    op.drop_index('ix_webhook_events_event_id', table_name='webhook_events')
    op.drop_table('webhook_events')
