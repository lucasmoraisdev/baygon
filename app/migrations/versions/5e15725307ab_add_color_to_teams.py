"""add color to teams

Revision ID: 5e15725307ab
Revises: 21cd98549285
Create Date: 2026-11-16 10:06:31.643830

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '5e15725307ab'
down_revision: Union[str, None] = '21cd98549285'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('teams', sa.Column('color', sa.String(50), nullable=True))


def downgrade() -> None:
    op.drop_column('teams', 'color')
