import os
import sys
import unittest
from decimal import Decimal

os.environ.setdefault("PYTHONUTF8", "1")
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

import httpx
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.dependencies.auth_dependencies import get_current_user, user_has_permission
from app.db.base import engine, get_db
from app.db.models.player import Player
from app.db.models.round import Round
from app.db.models.season import Seasons
from app.db.models.user import User
from app.main import app


class TestFantasyModule(unittest.IsolatedAsyncioTestCase):
    async def test_fantasy_full_lifecycle(self):
        conn = await engine.connect()
        trans = await conn.begin()
        session = AsyncSession(bind=conn, expire_on_commit=False, join_transaction_mode="create_savepoint")

        try:
            # 1. Admin & regular user
            admin = (await session.execute(select(User).where(User.is_admin.is_(True)))).scalars().first()
            self.assertIsNotNone(admin, "Deve existir ao menos um admin no banco.")

            # 2. Season & Round
            season = (await session.execute(select(Seasons).order_by(Seasons.id_season.desc()))).scalars().first()
            self.assertIsNotNone(season, "Deve existir uma temporada cadastrada.")

            round_obj = (await session.execute(select(Round).where(Round.season_id == season.id_season))).scalars().first()
            self.assertIsNotNone(round_obj, "Deve existir ao menos uma rodada cadastrada.")

            # Override FastAPI dependencies for local tests
            async def override_get_db():
                yield session

            async def override_get_current_user():
                return admin

            async def override_user_has_permission():
                return admin

            app.dependency_overrides[get_db] = override_get_db
            app.dependency_overrides[get_current_user] = override_get_current_user
            app.dependency_overrides[user_has_permission] = override_user_has_permission

            transport = httpx.ASGITransport(app=app)
            async with httpx.AsyncClient(transport=transport, base_url="http://test") as client:
                # 3. Status
                res = await client.get(f"/api/v1/fantasy/status?season_id={season.id_season}")
                self.assertEqual(res.status_code, 200)
                status_data = res.json()
                self.assertTrue(status_data["is_enabled"])

                # 4. Round Config
                res_cfg = await client.get(f"/api/v1/fantasy/rounds/{round_obj.id_round}/config")
                self.assertEqual(res_cfg.status_code, 200)
                cfg = res_cfg.json()
                self.assertIn("total_slots", cfg)
                self.assertIn("slot_rules", cfg)

                # 5. Market
                res_mkt = await client.get(f"/api/v1/fantasy/market?season_id={season.id_season}&round_id={round_obj.id_round}")
                self.assertEqual(res_mkt.status_code, 200)
                market = res_mkt.json()
                self.assertIsInstance(market, list)
                self.assertGreater(len(market), 0)

                # 6. My Team
                res_team = await client.get(f"/api/v1/fantasy/my-team?season_id={season.id_season}")
                self.assertEqual(res_team.status_code, 200)
                team = res_team.json()
                self.assertGreaterEqual(float(team["budget"]), 0)
                self.assertGreaterEqual(float(team["total_wealth"]), 0)

                # 7. Update Team Name
                res_upd = await client.put(f"/api/v1/fantasy/my-team?season_id={season.id_season}", json={"name": "Mito FC"})
                self.assertEqual(res_upd.status_code, 200)
                self.assertEqual(res_upd.json()["name"], "Mito FC")

                # 8. Rankings
                res_rk = await client.get(f"/api/v1/fantasy/rankings/round/{round_obj.id_round}")
                self.assertEqual(res_rk.status_code, 200)

                res_srk = await client.get(f"/api/v1/fantasy/rankings/season?season_id={season.id_season}")
                self.assertEqual(res_srk.status_code, 200)

                # 9. Lineups (Self & Inspected)
                res_my_lineup = await client.get(f"/api/v1/fantasy/rounds/{round_obj.id_round}/lineup")
                self.assertEqual(res_my_lineup.status_code, 200)

                team_id = team["id_fantasy_team"]
                res_inspect_lineup = await client.get(f"/api/v1/fantasy/rounds/{round_obj.id_round}/lineup?team_id={team_id}")
                self.assertEqual(res_inspect_lineup.status_code, 200)

        finally:
            app.dependency_overrides.clear()
            await trans.rollback()
            await conn.close()


if __name__ == "__main__":
    unittest.main()
