import os
import unittest
import uuid
import httpx
from datetime import datetime
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

os.environ.setdefault("PYTHONUTF8", "1")

from app.db.base import engine
from app.db.models.tenant import Tenant
from app.db.models.tenant_module import TenantModule
from app.db.models.user import User
from app.db.models.season import Seasons
from app.db.models.team import Teams
from app.db.models.match import Match
from app.db.models.round import Round
from app.core.tenant_context import set_tenant_bypass, clear_tenant_context
from app.core.jwt_manager import JWTManager
from app.core.services.tenant_service import TenantService
from app.schemas.tournament_schema import TournamentFormatEnum
from app.main import app

BAYGON_TENANT_ID = "00000000-0000-0000-0000-000000000001"


class TestAdvancedTournaments(unittest.IsolatedAsyncioTestCase):
    """
    Testes integrados para formatos avançados de campeonatos:
    - Pontos Corridos com Equipes Fixas
    - Fase de Grupos com Classificação Particionada
    - Mata-Mata Eliminatório (Playoffs com Pênaltis e Avanço de Fases)
    - Retrocompatibilidade com Baba / Pelada Individual
    """

    async def asyncSetUp(self):
        clear_tenant_context()
        self.tenant_id = BAYGON_TENANT_ID
        self.tenant_slug = "baygon"
        self.created_season_ids = []

        set_tenant_bypass(True)
        try:
            async with AsyncSession(engine) as session:
                self.admin_email = f"gestor_{uuid.uuid4().hex[:6]}@baygon.local"
                admin_user = User(
                    name="Gestor de Torneios",
                    email=self.admin_email,
                    username=f"gestor_{uuid.uuid4().hex[:6]}",
                    password="fakehash",
                    phone_number="11999998888",
                    is_admin=True,
                    is_active=True,
                    tenant_id=self.tenant_id,
                )
                session.add(admin_user)
                await session.flush()
                self.admin_id = admin_user.id_user
                await session.commit()
        finally:
            set_tenant_bypass(False)

        self.token = JWTManager.create_access_token({
            "sub": self.admin_email,
            "user_id": self.admin_id,
            "tenant_id": self.tenant_id,
        })
        self.headers = {
            "x-tenant-slug": self.tenant_slug,
            "Authorization": f"Bearer {self.token}",
        }

    async def asyncTearDown(self):
        clear_tenant_context()
        set_tenant_bypass(True)
        try:
            async with AsyncSession(engine) as session:
                # Remove torneios criados
                for s_id in self.created_season_ids:
                    stmt = select(Seasons).where(Seasons.id_season == s_id)
                    s = (await session.execute(stmt)).scalar_one_or_none()
                    if s:
                        await session.delete(s)

                stmt_user = select(User).where(User.id_user == self.admin_id)
                u = (await session.execute(stmt_user)).scalar_one_or_none()
                if u:
                    await session.delete(u)

                await session.commit()
        finally:
            set_tenant_bypass(False)
            await engine.dispose()

    async def test_01_pontos_corridos_fixtures_and_standings(self):
        """
        Valida a criação de um campeonato de Pontos Corridos com 4 times fixos,
        geração da tabela todos-contra-todos e cálculo completo da classificação.
        """
        transport = httpx.ASGITransport(app=app)
        async with httpx.AsyncClient(transport=transport, base_url="http://testserver") as client:
            # 1. Cria campeonato de pontos corridos
            payload_tourn = {
                "name": "Superliga de Pontos Corridos 2026",
                "tournament_format": "pontos_corridos",
            }
            res_tourn = await client.post("/api/v1/tournaments/", json=payload_tourn, headers=self.headers)
            self.assertEqual(res_tourn.status_code, 201)
            tourn_data = res_tourn.json()
            tourn_id = tourn_data["id_season"]
            self.created_season_ids.append(tourn_id)
            self.assertEqual(tourn_data["tournament_format"], "pontos_corridos")

            # 2. Inscreve 4 equipes
            teams_payload = [
                {"name": "Flamengo FC", "color": "#FF0000"},
                {"name": "Palmeiras SE", "color": "#008000"},
                {"name": "São Paulo FC", "color": "#FFFFFF"},
                {"name": "Corinthians SC", "color": "#000000"},
            ]
            res_teams = await client.post(f"/api/v1/tournaments/{tourn_id}/teams", json=teams_payload, headers=self.headers)
            self.assertEqual(res_teams.status_code, 201)
            enrolled_teams = res_teams.json()["teams"]
            self.assertEqual(len(enrolled_teams), 4)

            # 3. Gera a tabela de confrontos (Round-Robin: 3 rodadas para 4 times)
            res_fix = await client.post(f"/api/v1/tournaments/{tourn_id}/generate-fixtures", headers=self.headers)
            self.assertEqual(res_fix.status_code, 201)
            self.assertEqual(res_fix.json()["rounds_count"], 3)

            # 4. Simula resultados das partidas no banco mapeando por ID
            team_map = {t["name"]: t["id_team"] for t in enrolled_teams}
            fla_id = team_map["Flamengo FC"]
            pal_id = team_map["Palmeiras SE"]
            sp_id = team_map["São Paulo FC"]
            cor_id = team_map["Corinthians SC"]

            set_tenant_bypass(True)
            try:
                async with AsyncSession(engine) as session:
                    stmt_matches = (
                        select(Match)
                        .join(Round, Match.round_id == Round.id_round)
                        .where(Round.season_id == tourn_id)
                        .order_by(Match.id_match.asc())
                    )
                    matches = list((await session.execute(stmt_matches)).scalars().all())
                    self.assertEqual(len(matches), 6, "4 times em turno único devem gerar 6 jogos")

                    for m in matches:
                        # Flamengo vence todos os seus 3 jogos
                        if m.home_team_id == fla_id and m.away_team_id == pal_id:
                            m.score_home = 3; m.score_away = 1; m.is_finished = True
                        elif m.home_team_id == pal_id and m.away_team_id == fla_id:
                            m.score_home = 1; m.score_away = 3; m.is_finished = True
                        elif m.home_team_id == fla_id and m.away_team_id == sp_id:
                            m.score_home = 2; m.score_away = 0; m.is_finished = True
                        elif m.home_team_id == sp_id and m.away_team_id == fla_id:
                            m.score_home = 0; m.score_away = 2; m.is_finished = True
                        elif m.home_team_id == fla_id and m.away_team_id == cor_id:
                            m.score_home = 2; m.score_away = 1; m.is_finished = True
                        elif m.home_team_id == cor_id and m.away_team_id == fla_id:
                            m.score_home = 1; m.score_away = 2; m.is_finished = True
                        else:
                            # Demais confrontos empatam 1x1
                            m.score_home = 1; m.score_away = 1; m.is_finished = True

                    await session.commit()
            finally:
                set_tenant_bypass(False)

            # 5. Consulta tabela de classificação
            res_standings = await client.get(f"/api/v1/tournaments/{tourn_id}/standings", headers=self.headers)
            self.assertEqual(res_standings.status_code, 200)
            standings_data = res_standings.json()
            table = standings_data["standings"]

            # Flamengo deve liderar com 9 pontos (3 jogos, 3 vitórias, GP 7, GC 2, SG +5)
            leader = table[0]
            self.assertEqual(leader["position"], 1)
            self.assertEqual(leader["team_id"], fla_id)
            self.assertEqual(leader["points"], 9)
            self.assertEqual(leader["wins"], 3)
            self.assertEqual(leader["matches_played"], 3)
            self.assertEqual(leader["goals_for"], 7)
            self.assertEqual(leader["goals_against"], 2)
            self.assertEqual(leader["goal_difference"], 5)
            self.assertEqual(leader["win_percentage"], 100.0)

    async def test_02_group_stage_partitioned_standings(self):
        """
        Valida a fase de grupos em formato grupos_e_mata_mata,
        com cálculo de classificação particionada por grupo.
        """
        transport = httpx.ASGITransport(app=app)
        async with httpx.AsyncClient(transport=transport, base_url="http://testserver") as client:
            # 1. Cria torneio de grupos
            payload_tourn = {
                "name": "Copa Internacional dos Campeões",
                "tournament_format": "grupos_e_mata_mata",
                "teams_per_group": 2,
                "advancing_per_group": 1,
            }
            res_tourn = await client.post("/api/v1/tournaments/", json=payload_tourn, headers=self.headers)
            self.assertEqual(res_tourn.status_code, 201)
            tourn_id = res_tourn.json()["id_season"]
            self.created_season_ids.append(tourn_id)

            # 2. Inscreve times em 2 grupos
            teams_payload = [
                {"name": "Real Madrid", "group_name": "Grupo A"},
                {"name": "Barcelona", "group_name": "Grupo A"},
                {"name": "Bayern Munique", "group_name": "Grupo B"},
                {"name": "Borussia Dortmund", "group_name": "Grupo B"},
            ]
            res_teams = await client.post(f"/api/v1/tournaments/{tourn_id}/teams", json=teams_payload, headers=self.headers)
            self.assertEqual(res_teams.status_code, 201)

            # 3. Gera jogos da fase de grupos
            res_fix = await client.post(f"/api/v1/tournaments/{tourn_id}/generate-fixtures", headers=self.headers)
            self.assertEqual(res_fix.status_code, 201)

            # 4. Registra resultados
            set_tenant_bypass(True)
            try:
                async with AsyncSession(engine) as session:
                    stmt_matches = (
                        select(Match)
                        .join(Round, Match.round_id == Round.id_round)
                        .where(Round.season_id == tourn_id)
                    )
                    matches = list((await session.execute(stmt_matches)).scalars().all())
                    for m in matches:
                        # Time da casa vence por 3x0
                        m.score_home = 3
                        m.score_away = 0
                        m.is_finished = True
                    await session.commit()
            finally:
                set_tenant_bypass(False)

            # 5. Consulta tabela por grupos
            res_standings = await client.get(f"/api/v1/tournaments/{tourn_id}/standings", headers=self.headers)
            self.assertEqual(res_standings.status_code, 200)
            data = res_standings.json()
            self.assertIsNotNone(data["groups"])
            self.assertIn("Grupo A", data["groups"])
            self.assertIn("Grupo B", data["groups"])
            self.assertEqual(data["groups"]["Grupo A"][0]["points"], 3)
            self.assertEqual(data["groups"]["Grupo B"][0]["points"], 3)

    async def test_03_knockout_bracket_and_stage_advancement(self):
        """
        Valida torneio de Mata-Mata puro:
        - Chaveamento de semifinais
        - Desempate nos pênaltis
        - Avanço automático dos vencedores para a Grande Final
        """
        transport = httpx.ASGITransport(app=app)
        async with httpx.AsyncClient(transport=transport, base_url="http://testserver") as client:
            # 1. Cria torneio de Mata-Mata
            payload_tourn = {
                "name": "Copa Ouro Mata-Mata",
                "tournament_format": "mata_mata",
                "has_legs": False,
            }
            res_tourn = await client.post("/api/v1/tournaments/", json=payload_tourn, headers=self.headers)
            self.assertEqual(res_tourn.status_code, 201)
            tourn_id = res_tourn.json()["id_season"]
            self.created_season_ids.append(tourn_id)

            # 2. Inscreve 4 times (Semifinais diretas)
            teams_payload = [
                {"name": "Arsenal"},
                {"name": "Chelsea"},
                {"name": "Liverpool"},
                {"name": "Manchester City"},
            ]
            await client.post(f"/api/v1/tournaments/{tourn_id}/teams", json=teams_payload, headers=self.headers)

            # 3. Gera chaveamento inicial (Semifinais)
            res_fix = await client.post(f"/api/v1/tournaments/{tourn_id}/generate-fixtures", headers=self.headers)
            self.assertEqual(res_fix.status_code, 201)

            # 4. Finaliza semifinais com 1 jogo normal e 1 decidido nos pênaltis
            set_tenant_bypass(True)
            try:
                async with AsyncSession(engine) as session:
                    stmt_matches = (
                        select(Match)
                        .join(Round, Match.round_id == Round.id_round)
                        .where(Round.season_id == tourn_id)
                        .order_by(Match.bracket_position.asc())
                    )
                    semi_matches = list((await session.execute(stmt_matches)).scalars().all())
                    self.assertEqual(len(semi_matches), 2)

                    # Semi 1: Time mandante vence no tempo normal (2x1)
                    semi_matches[0].score_home = 2
                    semi_matches[0].score_away = 1
                    semi_matches[0].is_finished = True

                    # Semi 2: Empate 1x1, mandante vence nos pênaltis (5x4)
                    semi_matches[1].score_home = 1
                    semi_matches[1].score_away = 1
                    semi_matches[1].penalties_home = 5
                    semi_matches[1].penalties_away = 4
                    semi_matches[1].is_finished = True

                    await session.commit()
            finally:
                set_tenant_bypass(False)

            # 5. Consulta árvore do chaveamento
            res_bracket = await client.get(f"/api/v1/tournaments/{tourn_id}/bracket", headers=self.headers)
            self.assertEqual(res_bracket.status_code, 200)
            bracket_data = res_bracket.json()
            self.assertIn("semifinals", bracket_data["stages"])
            self.assertEqual(len(bracket_data["stages"]["semifinals"]), 2)
            self.assertIsNotNone(bracket_data["stages"]["semifinals"][0]["winner_team_id"])
            self.assertIsNotNone(bracket_data["stages"]["semifinals"][1]["winner_team_id"])

            # 6. Dispara avanço de fase: Semifinais -> Final
            advance_payload = {
                "current_stage": "semifinals",
                "next_stage": "final",
            }
            res_advance = await client.post(f"/api/v1/tournaments/{tourn_id}/advance-stage", json=advance_payload, headers=self.headers)
            self.assertEqual(res_advance.status_code, 201)
            self.assertIn("Confrontos da fase final gerados", res_advance.json()["message"])

            # 7. Verifica chaveamento final gerado
            res_bracket_updated = await client.get(f"/api/v1/tournaments/{tourn_id}/bracket", headers=self.headers)
            stages = res_bracket_updated.json()["stages"]
            self.assertIn("final", stages)
            self.assertEqual(len(stages["final"]), 1, "A grande final deve conter exatamente 1 confronto")

    async def test_04_legacy_individual_points_compatibility(self):
        """
        Valida que o formato legado (individual_points) continua funcionando
        sem quebras nas rotas originais de temporadas (/api/v1/seasons).
        """
        transport = httpx.ASGITransport(app=app)
        async with httpx.AsyncClient(transport=transport, base_url="http://testserver") as client:
            # 1. Consulta temporadas pela rota tradicional
            res_seasons = await client.get("/api/v1/seasons/", headers=self.headers)
            self.assertEqual(res_seasons.status_code, 200)
            seasons_list = res_seasons.json()
            self.assertIsInstance(seasons_list, list)

            # 2. Cria torneio com formato individual_points
            payload_tourn = {
                "name": "Baba Tradicional de Quarta",
                "tournament_format": "individual_points",
            }
            res_tourn = await client.post("/api/v1/tournaments/", json=payload_tourn, headers=self.headers)
            self.assertEqual(res_tourn.status_code, 201)
            t_data = res_tourn.json()
            self.created_season_ids.append(t_data["id_season"])
            self.assertEqual(t_data["tournament_format"], "individual_points")

