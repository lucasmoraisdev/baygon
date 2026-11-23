"""add_tournament_quota_and_plans

Revision ID: c5d6e7f8a9b0
Revises: b4c5d6e7f8a9
Create Date: 2026-11-21 10:30:00.000000

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'c5d6e7f8a9b0'
down_revision: Union[str, None] = 'b4c5d6e7f8a9'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # 1. Adiciona coluna custom_max_tournaments em tenants para permitir cotas avulsas/personalizadas
    op.add_column(
        'tenants',
        sa.Column('custom_max_tournaments', sa.Integer(), nullable=True)
    )

    # 2. Insere/garante o plano 'free' na tabela plans com cota padrao de 2 torneios
    op.execute("""
        INSERT INTO plans (name, code, price_monthly_cents, max_players, max_seasons, is_active, created_at, updated_at)
        VALUES ('Plano Gratuito', 'free', 0, 50, 2, 1, NOW(), NOW())
        ON DUPLICATE KEY UPDATE max_seasons=2, is_active=1, updated_at=NOW()
    """)

    # 3. Atualiza os limites de temporadas/torneios dos planos pagos existentes
    # Basic = 3 torneios
    op.execute("UPDATE plans SET max_seasons=3, updated_at=NOW() WHERE code='basic'")
    # Pro = -1 (ilimitado)
    op.execute("UPDATE plans SET max_seasons=-1, updated_at=NOW() WHERE code='pro_all_inclusive'")


def downgrade() -> None:
    op.drop_column('tenants', 'custom_max_tournaments')
    op.execute("UPDATE plans SET max_seasons=2 WHERE code='basic'")
    op.execute("UPDATE plans SET max_seasons=10 WHERE code='pro_all_inclusive'")
    op.execute("DELETE FROM plans WHERE code='free'")
