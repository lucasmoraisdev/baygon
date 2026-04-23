"""Allow end_date to be null in seasons table

Revision ID: allow_end_date_null
Revises: a1b2c3d4e5f6
Create Date: 2026-04-05 12:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'allow_end_date_null'
down_revision: Union[str, None] = 'a1b2c3d4e5f6'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Alterar a coluna end_date para permitir NULL
    op.alter_column('seasons', 'end_date',
               existing_type=sa.DateTime(timezone=True),
               nullable=True)


def downgrade() -> None:
    # Reverter a alteração - tornar end_date NOT NULL novamente
    op.alter_column('seasons', 'end_date',
               existing_type=sa.DateTime(timezone=True),
               nullable=False)