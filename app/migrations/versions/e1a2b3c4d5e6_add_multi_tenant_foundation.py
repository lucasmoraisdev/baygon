"""add_multi_tenant_foundation

Revision ID: e1a2b3c4d5e6
Revises: 5a7f91c3e102
Create Date: 2026-11-19 22:15:00.000000

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = 'e1a2b3c4d5e6'
down_revision: Union[str, None] = '5a7f91c3e102'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

DEFAULT_BAYGON_TENANT_ID = '00000000-0000-0000-0000-000000000001'


def upgrade() -> None:
    # 1. Cria tabela de planos
    op.create_table(
        'plans',
        sa.Column('id_plan', sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column('name', sa.String(100), nullable=False),
        sa.Column('code', sa.String(50), unique=True, nullable=False),
        sa.Column('price_monthly_cents', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('max_players', sa.Integer(), nullable=False, server_default='100'),
        sa.Column('max_seasons', sa.Integer(), nullable=False, server_default='2'),
        sa.Column('is_active', sa.Boolean(), nullable=False, server_default=sa.text('1')),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('CURRENT_TIMESTAMP'), nullable=True),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('CURRENT_TIMESTAMP'), nullable=True),
        sa.Column('deleted_at', sa.DateTime(timezone=True), nullable=True),
    )
    op.create_index('ix_plans_code', 'plans', ['code'])

    # 2. Cria tabela de tenants
    op.create_table(
        'tenants',
        sa.Column('id_tenant', sa.String(36), primary_key=True),
        sa.Column('name', sa.String(150), nullable=False),
        sa.Column('slug', sa.String(63), unique=True, nullable=False),
        sa.Column('custom_domain', sa.String(255), unique=True, nullable=True),
        sa.Column('logo_url', sa.String(500), nullable=True),
        sa.Column('primary_color', sa.String(10), nullable=False, server_default='#059669'),
        sa.Column('secondary_color', sa.String(10), nullable=False, server_default='#10b981'),
        sa.Column('status', sa.String(20), nullable=False, server_default='active'),
        sa.Column('plan_id', sa.Integer(), sa.ForeignKey('plans.id_plan', ondelete='SET NULL'), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('CURRENT_TIMESTAMP'), nullable=True),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('CURRENT_TIMESTAMP'), nullable=True),
        sa.Column('deleted_at', sa.DateTime(timezone=True), nullable=True),
    )
    op.create_index('ix_tenants_slug', 'tenants', ['slug'])
    op.create_index('ix_tenants_custom_domain', 'tenants', ['custom_domain'])

    # 3. Cria tabela de tenant_modules (entitlements)
    op.create_table(
        'tenant_modules',
        sa.Column('id_tenant_module', sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column('tenant_id', sa.String(36), sa.ForeignKey('tenants.id_tenant', ondelete='CASCADE'), nullable=False),
        sa.Column('module_code', sa.String(50), nullable=False),
        sa.Column('is_active', sa.Boolean(), nullable=False, server_default=sa.text('1')),
        sa.Column('expires_at', sa.DateTime(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('CURRENT_TIMESTAMP'), nullable=True),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('CURRENT_TIMESTAMP'), nullable=True),
        sa.Column('deleted_at', sa.DateTime(timezone=True), nullable=True),
        sa.UniqueConstraint('tenant_id', 'module_code', name='uq_tenant_module'),
    )
    op.create_index('ix_tenant_modules_tenant_id', 'tenant_modules', ['tenant_id'])
    op.create_index('ix_tenant_modules_module_code', 'tenant_modules', ['module_code'])

    # 4. Cria tabela de auditoria multi-tenant
    op.create_table(
        'tenant_audit_logs',
        sa.Column('id_audit', sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column('tenant_id', sa.String(36), nullable=False),
        sa.Column('user_id', sa.Integer(), nullable=True),
        sa.Column('action', sa.String(100), nullable=False),
        sa.Column('entity', sa.String(100), nullable=True),
        sa.Column('entity_id', sa.String(100), nullable=True),
        sa.Column('ip_address', sa.String(45), nullable=True),
        sa.Column('details', sa.Text(), nullable=True),
        sa.Column('created_at', sa.DateTime(), server_default=sa.text('CURRENT_TIMESTAMP'), nullable=False),
    )
    op.create_index('ix_tenant_audit_logs_tenant_id', 'tenant_audit_logs', ['tenant_id'])

    # 5. Insere Plano e Tenant inicial da Baygon
    op.execute(
        sa.text(
            "INSERT INTO plans (id_plan, name, code, price_monthly_cents, max_players, max_seasons, is_active) "
            "VALUES (1, 'Plano Completo Pro', 'pro_all_inclusive', 9900, 200, 10, 1)"
        )
    )
    op.execute(
        sa.text(
            f"INSERT INTO tenants (id_tenant, name, slug, primary_color, secondary_color, status, plan_id) "
            f"VALUES ('{DEFAULT_BAYGON_TENANT_ID}', 'Associação Baygon', 'baygon', '#059669', '#10b981', 'active', 1)"
        )
    )
    # Ativa todos os módulos para a Baygon
    for mod in ['competitions', 'financial', 'fantasy', 'gamification']:
        op.execute(
            sa.text(
                f"INSERT INTO tenant_modules (tenant_id, module_code, is_active) "
                f"VALUES ('{DEFAULT_BAYGON_TENANT_ID}', '{mod}', 1)"
            )
        )

    # 6. Adiciona tenant_id nas tabelas de domínio
    tables_to_update = [
        ('users', 'ix_users_tenant_id'),
        ('seasons', 'ix_seasons_tenant_id'),
        ('teams', 'ix_teams_tenant_id'),
        ('players', 'ix_players_tenant_id'),
        ('financial_monthly_fees', 'ix_financial_monthly_fees_tenant_id'),
        ('financial_costs', 'ix_financial_costs_tenant_id'),
        ('fantasy_settings', 'ix_fantasy_settings_tenant_id'),
        ('fantasy_round_configs', 'ix_fantasy_round_configs_tenant_id'),
        ('fantasy_teams', 'ix_fantasy_teams_tenant_id'),
        ('fantasy_lineups', 'ix_fantasy_lineups_tenant_id'),
        ('roulette_prizes', 'ix_roulette_prizes_tenant_id'),
        ('season_polls', 'ix_season_polls_tenant_id'),
        ('round_media', 'ix_round_media_tenant_id'),
    ]

    for table_name, index_name in tables_to_update:
        op.add_column(
            table_name,
            sa.Column('tenant_id', sa.String(36), sa.ForeignKey('tenants.id_tenant', ondelete='CASCADE'), nullable=True)
        )
        op.create_index(index_name, table_name, ['tenant_id'])
        # Migra dados legados da Baygon
        op.execute(
            sa.text(f"UPDATE {table_name} SET tenant_id = '{DEFAULT_BAYGON_TENANT_ID}' WHERE tenant_id IS NULL")
        )


def downgrade() -> None:
    tables_to_downgrade = [
        ('round_media', 'ix_round_media_tenant_id'),
        ('season_polls', 'ix_season_polls_tenant_id'),
        ('roulette_prizes', 'ix_roulette_prizes_tenant_id'),
        ('fantasy_lineups', 'ix_fantasy_lineups_tenant_id'),
        ('fantasy_teams', 'ix_fantasy_teams_tenant_id'),
        ('fantasy_round_configs', 'ix_fantasy_round_configs_tenant_id'),
        ('fantasy_settings', 'ix_fantasy_settings_tenant_id'),
        ('financial_costs', 'ix_financial_costs_tenant_id'),
        ('financial_monthly_fees', 'ix_financial_monthly_fees_tenant_id'),
        ('players', 'ix_players_tenant_id'),
        ('teams', 'ix_teams_tenant_id'),
        ('seasons', 'ix_seasons_tenant_id'),
        ('users', 'ix_users_tenant_id'),
    ]

    for table_name, index_name in tables_to_downgrade:
        op.drop_index(index_name, table_name=table_name)
        op.drop_column(table_name, 'tenant_id')

    op.drop_index('ix_tenant_audit_logs_tenant_id', table_name='tenant_audit_logs')
    op.drop_table('tenant_audit_logs')

    op.drop_index('ix_tenant_modules_module_code', table_name='tenant_modules')
    op.drop_index('ix_tenant_modules_tenant_id', table_name='tenant_modules')
    op.drop_table('tenant_modules')

    op.drop_index('ix_tenants_custom_domain', table_name='tenants')
    op.drop_index('ix_tenants_slug', table_name='tenants')
    op.drop_table('tenants')

    op.drop_index('ix_plans_code', table_name='plans')
    op.drop_table('plans')
