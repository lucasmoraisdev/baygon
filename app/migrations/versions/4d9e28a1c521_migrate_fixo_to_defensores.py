"""migrate_fixo_to_defensores

Revision ID: 4d9e28a1c521
Revises: 3c8d19f2a410
Create Date: 2026-11-18 21:31:00.000000

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = '4d9e28a1c521'
down_revision: Union[str, None] = '3c8d19f2a410'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # 1. Migra jogadores com posição fixo para defensores
    op.execute("UPDATE players SET posicao = 'defensores' WHERE LOWER(posicao) IN ('fixo', 'fixos')")
    # 2. Atualiza regras de slot do fantasy que mencionavam Fixo
    op.execute("UPDATE fantasy_round_slot_rules SET target_value = 'Defensores' WHERE LOWER(target_value) LIKE '%fixo%'")


def downgrade() -> None:
    pass
