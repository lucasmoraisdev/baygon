import os
import unittest
from datetime import datetime, timezone
from types import SimpleNamespace

os.environ.setdefault("PYTHONUTF8", "1")

import httpx
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.dependencies.auth_dependencies import user_has_permission
from app.db.base import engine, get_db
from app.db.models.player import Player
from app.db.models.player_score import PlayerScore
from app.db.models.player_season_score import PlayerSeasonScore
from app.db.models.round import Round
from app.db.models.season import Seasons
from app.db.models.user import User
from app.main import app


class TestMatchesTeamsAndRulesFlows(unittest.IsolatedAsyncioTestCase):
    async def test_live_match_and_rules_calculation_flow(self):
        conn = await engine.connect()
        trans = await conn.begin()
        session = AsyncSession(bind=conn, expire_on_commit=False, join_transaction_mode="create_savepoint")

        try:
            admin = (await session.execute(select(User).where(User.is_admin.is_(True)))).scalars().first()
            if not admin:
                admin = User(
                    name="Test Admin",
                    email="test_admin2@baygon.local",
                    username="test_admin2",
                    password="x",
                    is_admin=True,
                    phone_number="00000000000",
                    is_active=True,
                )
                session.add(admin)
                await session.flush()

            season = Seasons(
                number=998,
                initial_date=datetime(2026, 1, 1, tzinfo=timezone.utc),
                end_date=None,
                is_active=True,
            )
            session.add(season)
            await session.flush()
            season_id = int(season.id_season)
            admin_id = int(admin.id_user)
            admin_username = admin.username

            rnd = Round(
                date=datetime(2026, 11, 12, tzinfo=timezone.utc),
                location="Arena Baygon",
                referee="Cruz",
                round_number=1,
                season_id=season_id,
            )
            session.add(rnd)

            p1 = Player(nome="JOGADOR A", apelido="JOGADOR A", potes=1, is_associate=True, is_guest=False)
            p2 = Player(nome="JOGADOR B", apelido="JOGADOR B", potes=2, is_associate=True, is_guest=False)
            p3 = Player(nome="JOGADOR C", apelido="JOGADOR C", potes=1, is_associate=True, is_guest=False)
            session.add_all([p1, p2, p3])
            await session.flush()

            round_id = int(rnd.id_round)
            p1_id, p2_id, p3_id = int(p1.id_player), int(p2.id_player), int(p3.id_player)

            async def _override_get_db():
                yield session

            async def _override_admin():
                return SimpleNamespace(id_user=admin_id, is_admin=True, username=admin_username)

            app.dependency_overrides[get_db] = _override_get_db
            app.dependency_overrides[user_has_permission] = _override_admin

            transport = httpx.ASGITransport(app=app)
            async with httpx.AsyncClient(transport=transport, base_url="http://testserver") as client:
                # 1. Seed default rules for season
                r_seed = await client.post(f"/api/v1/rules/season/{season_id}/seed-defaults")
                self.assertEqual(r_seed.status_code, 201, r_seed.text)
                self.assertGreaterEqual(len(r_seed.json()), 10)

                # 2. Create 2 teams with players
                r_t1 = await client.post("/api/v1/teams/", json={"name": "TIME A", "round_id": round_id, "player_ids": [p1_id, p2_id]})
                self.assertEqual(r_t1.status_code, 201, r_t1.text)
                t1_id = r_t1.json()["id_team"]

                r_t2 = await client.post("/api/v1/teams/", json={"name": "TIME C", "round_id": round_id, "player_ids": [p3_id]})
                self.assertEqual(r_t2.status_code, 201, r_t2.text)
                t2_id = r_t2.json()["id_team"]

                # GET /teams/{id} returns nested players
                r_get_t1 = await client.get(f"/api/v1/teams/{t1_id}")
                self.assertEqual(r_get_t1.status_code, 200, r_get_t1.text)
                self.assertEqual(len(r_get_t1.json()["players"]), 2)

                # 3. Create match using frontend fields (home_score/away_score, without filmed_by or event_type)
                r_m = await client.post(
                    "/api/v1/matches/",
                    json={
                        "round_id": round_id,
                        "home_team_id": t1_id,
                        "away_team_id": t2_id,
                        "home_score": 0,
                        "away_score": 0,
                    },
                )
                self.assertEqual(r_m.status_code, 201, r_m.text)
                m_json = r_m.json()
                match_id = m_json["id_match"]
                self.assertEqual(m_json["id"], match_id)
                self.assertEqual(m_json["event_type"], "empate")

                # GET /matches/season/{season_id} works (joined via Round)
                r_ms = await client.get(f"/api/v1/matches/season/{season_id}")
                self.assertEqual(r_ms.status_code, 200, r_ms.text)
                self.assertEqual(len(r_ms.json()), 1)

                # 4. Record goal + assist + update score
                r_ev1 = await client.post("/api/v1/events/", json={"match_id": match_id, "player_id": p1_id, "event_type": "gol", "play_id": 1})
                self.assertEqual(r_ev1.status_code, 201, r_ev1.text)
                r_ev2 = await client.post("/api/v1/events/", json={"match_id": match_id, "player_id": p2_id, "event_type": "assistencia", "play_id": 1})
                self.assertEqual(r_ev2.status_code, 201, r_ev2.text)
                r_upd = await client.put(f"/api/v1/matches/{match_id}", json={"score_home": 1})
                self.assertEqual(r_upd.status_code, 200, r_upd.text)
                self.assertEqual(r_upd.json()["home_score"], 1)
                self.assertEqual(r_upd.json()["event_type"], "vitoria_mandante")

                # 5. Calculate round scores from season rules
                r_calc = await client.post(f"/api/v1/rules/round/{round_id}/calculate-scores")
                self.assertEqual(r_calc.status_code, 200, r_calc.text)
                self.assertEqual(r_calc.json()["players_scored"], 3)

                # Verify p1: 1 goal (1) + home win (3) = 4 pts
                ps1 = (await session.execute(
                    select(PlayerScore).where(PlayerScore.round_id == round_id, PlayerScore.player_id == p1_id)
                )).scalar_one()
                self.assertEqual(ps1.points_individual, 1)
                self.assertEqual(ps1.points_team, 3)
                self.assertEqual(ps1.total_points, 4)

                ss1 = (await session.execute(
                    select(PlayerSeasonScore).where(PlayerSeasonScore.season_id == season_id, PlayerSeasonScore.player_id == p1_id)
                )).scalar_one()
                self.assertEqual(ss1.total_points, 4)
        finally:
            app.dependency_overrides.clear()
            await session.close()
            await trans.rollback()
            await conn.close()
            await engine.dispose()


if __name__ == "__main__":
    unittest.main(verbosity=2)
