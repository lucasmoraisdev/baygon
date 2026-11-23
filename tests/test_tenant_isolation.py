import os
import unittest
import uuid
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

os.environ.setdefault("PYTHONUTF8", "1")

from app.db.base import engine
from app.db.models.tenant import Tenant
from app.db.models.player import Player
from app.db.models.season import Seasons
from app.core.tenant_context import (
    set_current_tenant_id,
    get_current_tenant_id,
    clear_tenant_context,
    set_tenant_bypass,
)


class TestTenantIsolation(unittest.IsolatedAsyncioTestCase):
    async def asyncSetUp(self):
        clear_tenant_context()

    async def asyncTearDown(self):
        clear_tenant_context()
        await engine.dispose()

    async def test_cross_tenant_isolation_and_auto_injection(self):
        """
        Valida que o interceptor de segurança do SQLAlchemy:
        1. Injeta automaticamente o tenant_id ativo na criação de entidades;
        2. Impede que o Tenant A enxergue dados criados no Tenant B;
        3. Impede que o Tenant B enxergue dados da Baygon (Tenant A).
        """
        conn = await engine.connect()
        trans = await conn.begin()
        session = AsyncSession(bind=conn, expire_on_commit=False, join_transaction_mode="create_savepoint")

        try:
            # 1. Cria dois tenants isolados para o teste
            tenant_a_id = f"test-tenant-a-{uuid.uuid4().hex[:8]}"
            tenant_b_id = f"test-tenant-b-{uuid.uuid4().hex[:8]}"

            # Usamos bypass momentâneo para cadastrar os tenants sem filtro
            set_tenant_bypass(True)
            tenant_a = Tenant(id_tenant=tenant_a_id, name="Associação A (Alfa)", slug=f"alfa-{uuid.uuid4().hex[:6]}")
            tenant_b = Tenant(id_tenant=tenant_b_id, name="Associação B (Beta)", slug=f"beta-{uuid.uuid4().hex[:6]}")
            session.add_all([tenant_a, tenant_b])
            await session.flush()
            set_tenant_bypass(False)

            # 2. Ativa o contexto do Tenant A e cadastra um jogador sem passar tenant_id
            set_current_tenant_id(tenant_a_id)
            player_a = Player(
                nome="Jogador Exclusivo Alfa",
                apelido="Alfa1",
                potes=1,
                is_associate=True,
                is_guest=False,
            )
            session.add(player_a)
            await session.flush()

            # Validação 1: O tenant_id foi injetado automaticamente pelo interceptor
            self.assertEqual(player_a.tenant_id, tenant_a_id, "O interceptor deve auto-injetar o tenant_id ativo.")

            # 3. Ativa o contexto do Tenant B e cadastra um jogador no Tenant B
            set_current_tenant_id(tenant_b_id)
            player_b = Player(
                nome="Jogador Exclusivo Beta",
                apelido="Beta1",
                potes=2,
                is_associate=True,
                is_guest=False,
            )
            session.add(player_b)
            await session.flush()

            # Validação 2: O tenant_id de B foi injetado corretamente
            self.assertEqual(player_b.tenant_id, tenant_b_id)

            # 4. Consulta no contexto do Tenant B: NÃO pode ver player_a
            result_b = await session.execute(select(Player).where(Player.id_player.in_([player_a.id_player, player_b.id_player])))
            players_visible_to_b = result_b.scalars().all()

            self.assertEqual(len(players_visible_to_b), 1, "Tenant B deve enxergar exatamente 1 jogador.")
            self.assertEqual(players_visible_to_b[0].id_player, player_b.id_player, "Tenant B só pode ver o seu próprio jogador.")
            self.assertEqual(players_visible_to_b[0].nome, "Jogador Exclusivo Beta")

            # 5. Muda o contexto de volta para o Tenant A: NÃO pode ver player_b
            set_current_tenant_id(tenant_a_id)
            result_a = await session.execute(select(Player).where(Player.id_player.in_([player_a.id_player, player_b.id_player])))
            players_visible_to_a = result_a.scalars().all()

            self.assertEqual(len(players_visible_to_a), 1, "Tenant A deve enxergar exatamente 1 jogador.")
            self.assertEqual(players_visible_to_a[0].id_player, player_a.id_player, "Tenant A só pode ver o seu próprio jogador.")
            self.assertEqual(players_visible_to_a[0].nome, "Jogador Exclusivo Alfa")

            # 6. Validação cruzada com Seasons
            from datetime import datetime, timezone
            season_a = Seasons(number=991, initial_date=datetime.now(timezone.utc), is_active=True)
            session.add(season_a)
            await session.flush()
            self.assertEqual(season_a.tenant_id, tenant_a_id)

            set_current_tenant_id(tenant_b_id)
            season_b = Seasons(number=992, initial_date=datetime.now(timezone.utc), is_active=True)
            session.add(season_b)
            await session.flush()
            self.assertEqual(season_b.tenant_id, tenant_b_id)

            # Consulta seasons no Tenant B: não pode enxergar season_a
            seasons_b = (await session.execute(select(Seasons).where(Seasons.id_season.in_([season_a.id_season, season_b.id_season])))).scalars().all()
            self.assertEqual(len(seasons_b), 1)
            self.assertEqual(seasons_b[0].id_season, season_b.id_season)

            # 7. Validação cruzada com Round (Blindagem de ID direto)
            from app.db.models.round import Round
            set_current_tenant_id(tenant_a_id)
            round_a = Round(
                round_number=1,
                season_id=season_a.id_season,
                location="Arena Alfa",
                referee="Juiz Alfa",
                date=datetime.now(timezone.utc),
            )
            session.add(round_a)
            await session.flush()
            self.assertEqual(round_a.tenant_id, tenant_a_id, "O tenant_id da rodada deve ser auto-injetado como Tenant A.")

            # Tenant B tenta consultar DIRETAMENTE a rodada de A por ID (como em GET /rounds/{id})
            set_current_tenant_id(tenant_b_id)
            round_leak_attempt = (await session.execute(select(Round).where(Round.id_round == round_a.id_round))).scalars().first()
            self.assertIsNone(round_leak_attempt, "Tenant B NÃO pode carregar a rodada do Tenant A mesmo passando o ID exato!")

        finally:
            clear_tenant_context()
            await trans.rollback()
            await conn.close()


if __name__ == "__main__":
    unittest.main()
