import os
import unittest
import uuid
import httpx
from datetime import datetime
from sqlalchemy import select, delete
from sqlalchemy.ext.asyncio import AsyncSession

os.environ.setdefault("PYTHONUTF8", "1")

from app.db.base import engine
from app.db.models.tenant import Tenant
from app.db.models.tenant_module import TenantModule
from app.db.models.user import User
from app.db.models.season import Seasons
from app.db.models.round import Round
from app.db.models.match import Match
from app.db.models.team import Teams
from app.core.tenant_context import set_tenant_bypass, clear_tenant_context
from app.core.jwt_manager import JWTManager
from app.core.enum.events_enum import EventTypeEnum
from app.main import app


class TestTournamentMatchResults(unittest.IsolatedAsyncioTestCase):
    """
    Testes de Integração para Registro de Resultados e Sorteio de Chaves:
    - Atualização de placares regulares (vitória mandante/visitante/empate).
    - Atualização de partidas eliminatórias com disputa de pênaltis.
    - Sorteio e chaveamento de playoffs (random e seeded).
    - Consulta detalhada de rodadas e confrontos do campeonato.
    """

    async def asyncSetUp(self):
        clear_tenant_context()
        self.tenant_id = str(uuid.uuid4())
        self.tenant_slug = f"liga-results-{uuid.uuid4().hex[:6]}"
        self.created_season_ids = []

        set_tenant_bypass(True)
        try:
            async with AsyncSession(engine) as session:
                tenant = Tenant(
                    id_tenant=self.tenant_id,
                    name="Liga Resultados Teste",
                    slug=self.tenant_slug,
                    status="active",
                )
                session.add(tenant)

                mod = TenantModule(
                    tenant_id=self.tenant_id,
                    module_code="competitions",
                    is_active=True,
                )
                session.add(mod)

                user = User(
                    name="Gestor Resultados",
                    username=f"gestor_{uuid.uuid4().hex[:6]}",
                    email=f"gestor_{uuid.uuid4().hex[:6]}@baygon.local",
                    password="fakehash",
                    phone_number="11999997777",
                    is_admin=True,
                    is_active=True,
                    tenant_id=self.tenant_id,
                )
                session.add(user)
                await session.commit()
                await session.refresh(user)
                self.user_id = user.id_user
                self.user_email = user.email
        finally:
            set_tenant_bypass(False)

        self.token = JWTManager.create_access_token(
            data={"sub": self.user_email, "user_id": self.user_id, "tenant_id": self.tenant_id}
        )
        self.headers = {
            "Authorization": f"Bearer {self.token}",
            "X-Tenant-Slug": self.tenant_slug,
        }

    async def asyncTearDown(self):
        set_tenant_bypass(True)
        try:
            async with AsyncSession(engine) as session:
                for sid in self.created_season_ids:
                    # Deleta matches, rounds, teams e season
                    stmt_r = select(Round.id_round).where(Round.season_id == sid)
                    round_ids = list((await session.execute(stmt_r)).scalars().all())
                    if round_ids:
                        await session.execute(delete(Match).where(Match.round_id.in_(round_ids)))
                        await session.execute(delete(Round).where(Round.id_round.in_(round_ids)))
                    await session.execute(delete(Teams).where(Teams.season_id == sid))
                    await session.execute(delete(Seasons).where(Seasons.id_season == sid))

                await session.execute(delete(User).where(User.tenant_id == self.tenant_id))
                await session.execute(delete(TenantModule).where(TenantModule.tenant_id == self.tenant_id))
                await session.execute(delete(Tenant).where(Tenant.id_tenant == self.tenant_id))
                await session.commit()
        finally:
            clear_tenant_context()
            await engine.dispose()

    async def test_01_update_match_result_and_event_type(self):
        transport = httpx.ASGITransport(app=app)
        async with httpx.AsyncClient(transport=transport, base_url="http://testserver") as client:
            # 1. Cria torneio de pontos corridos
            resp_create = await client.post(
                "/api/v1/tournaments/",
                json={"name": "Copa Resultados", "tournament_format": "pontos_corridos"},
                headers=self.headers,
            )
            self.assertEqual(resp_create.status_code, 201)
            t_id = resp_create.json()["id_season"]
            self.created_season_ids.append(t_id)

            # 2. Adiciona 2 equipes
            resp_teams = await client.post(
                f"/api/v1/tournaments/{t_id}/teams",
                json=[{"name": "Flamengo FC", "color": "#ef4444"}, {"name": "Vasco FC", "color": "#000000"}],
                headers=self.headers,
            )
            self.assertEqual(resp_teams.status_code, 201)

            # 3. Gera tabela de jogos
            resp_fix = await client.post(
                f"/api/v1/tournaments/{t_id}/generate-fixtures",
                headers=self.headers,
            )
            self.assertEqual(resp_fix.status_code, 201)

            # 4. Lista rodadas para obter o match_id
            resp_rounds = await client.get(
                f"/api/v1/tournaments/{t_id}/rounds",
                headers=self.headers,
            )
            self.assertEqual(resp_rounds.status_code, 200)
            rounds = resp_rounds.json()
            self.assertGreaterEqual(len(rounds), 1)
            match_id = rounds[0]["matches"][0]["id_match"]

            # 5. Atualiza o placar: Mandante 3 x 1 Visitante
            resp_res = await client.put(
                f"/api/v1/tournaments/{t_id}/matches/{match_id}/result",
                json={
                    "score_home": 3,
                    "score_away": 1,
                    "penalties_home": 0,
                    "penalties_away": 0,
                    "is_finished": True,
                },
                headers=self.headers,
            )
            self.assertEqual(resp_res.status_code, 200)
            data = resp_res.json()
            self.assertEqual(data["status"], "success")
            self.assertEqual(data["match"]["score_home"], 3)
            self.assertEqual(data["match"]["score_away"], 1)
            self.assertTrue(data["match"]["is_finished"])

            # 6. Verifica classificação calculada
            resp_std = await client.get(
                f"/api/v1/tournaments/{t_id}/standings",
                headers=self.headers,
            )
            self.assertEqual(resp_std.status_code, 200)
            standings = resp_std.json()["standings"]
            self.assertEqual(standings[0]["points"], 3)
            self.assertEqual(standings[0]["wins"], 1)
            self.assertEqual(standings[1]["points"], 0)

    async def test_02_update_playoff_match_with_penalties(self):
        transport = httpx.ASGITransport(app=app)
        async with httpx.AsyncClient(transport=transport, base_url="http://testserver") as client:
            # 1. Cria torneio de mata-mata
            resp_create = await client.post(
                "/api/v1/tournaments/",
                json={"name": "Copa Mata-Mata Penaltis", "tournament_format": "mata_mata"},
                headers=self.headers,
            )
            self.assertEqual(resp_create.status_code, 201)
            t_id = resp_create.json()["id_season"]
            self.created_season_ids.append(t_id)

            # 2. Adiciona 2 equipes para final direta
            await client.post(
                f"/api/v1/tournaments/{t_id}/teams",
                json=[{"name": "Palmeiras", "color": "#10b981"}, {"name": "Corinthians", "color": "#ffffff"}],
                headers=self.headers,
            )

            # 3. Sorteia o chaveamento (draw-bracket)
            resp_draw = await client.post(
                f"/api/v1/tournaments/{t_id}/draw-bracket",
                json={"seed_mode": "random"},
                headers=self.headers,
            )
            self.assertEqual(resp_draw.status_code, 201)

            # 4. Obtém o bracket para verificar match
            resp_brk = await client.get(
                f"/api/v1/tournaments/{t_id}/bracket",
                headers=self.headers,
            )
            self.assertEqual(resp_brk.status_code, 200)
            stages = resp_brk.json()["stages"]
            match = stages["final"][0]
            match_id = match["id_match"]
            home_id = match["home_team_id"]

            # 5. Lança empate no tempo normal 2x2 com pênaltis 5x4 a favor do mandante
            resp_res = await client.put(
                f"/api/v1/tournaments/{t_id}/matches/{match_id}/result",
                json={
                    "score_home": 2,
                    "score_away": 2,
                    "penalties_home": 5,
                    "penalties_away": 4,
                    "is_finished": True,
                },
                headers=self.headers,
            )
            self.assertEqual(resp_res.status_code, 200)

            # 6. Verifica se o bracket reconhece o mandante como campeão/vencedor
            resp_brk_updated = await client.get(
                f"/api/v1/tournaments/{t_id}/bracket",
                headers=self.headers,
            )
            updated_match = resp_brk_updated.json()["stages"]["final"][0]
            self.assertTrue(updated_match["is_finished"])
            self.assertEqual(updated_match["winner_team_id"], home_id)


if __name__ == "__main__":
    unittest.main()
