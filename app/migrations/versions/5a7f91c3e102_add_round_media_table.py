"""add_round_media_table

Revision ID: 5a7f91c3e102
Revises: 4d9e28a1c521
Create Date: 2026-11-19 09:35:00.000000

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '5a7f91c3e102'
down_revision: Union[str, None] = '4d9e28a1c521'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        'round_media',
        sa.Column('id_round_media', sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column('round_id', sa.Integer(), sa.ForeignKey('round.id_round', ondelete='CASCADE'), nullable=False),
        sa.Column('media_type', sa.String(50), nullable=False),
        sa.Column('url', sa.String(1000), nullable=False),
        sa.Column('title', sa.String(255), nullable=True),
        sa.Column('description', sa.Text(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('CURRENT_TIMESTAMP'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('deleted_at', sa.DateTime(timezone=True), nullable=True),
    )


def downgrade() -> None:
    op.drop_table('round_media')
