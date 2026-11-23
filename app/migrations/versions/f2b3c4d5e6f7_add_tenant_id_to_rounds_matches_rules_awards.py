"""add_tenant_id_to_rounds_matches_rules_awards

Revision ID: f2b3c4d5e6f7
Revises: e1a2b3c4d5e6
Create Date: 2026-11-19 22:40:00.000000

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = 'f2b3c4d5e6f7'
down_revision: Union[str, None] = 'e1a2b3c4d5e6'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

DEFAULT_BAYGON_TENANT_ID = '00000000-0000-0000-0000-000000000001'

TABLES = [
    ('round', 'ix_round_tenant_id'),
    ('matches', 'ix_matches_tenant_id'),
    ('event_score_rules', 'ix_event_score_rules_tenant_id'),
    ('awards', 'ix_awards_tenant_id'),
]


def upgrade() -> None:
    for table_name, index_name in TABLES:
        op.add_column(
            table_name,
            sa.Column('tenant_id', sa.String(36), sa.ForeignKey('tenants.id_tenant', ondelete='CASCADE'), nullable=True)
        )
        op.create_index(index_name, table_name, ['tenant_id'])
        op.execute(
            sa.text(f"UPDATE {table_name} SET tenant_id = '{DEFAULT_BAYGON_TENANT_ID}' WHERE tenant_id IS NULL")
        )


def downgrade() -> None:
    for table_name, index_name in reversed(TABLES):
        op.drop_index(index_name, table_name=table_name)
        op.drop_column(table_name, 'tenant_id')
