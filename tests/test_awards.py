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
from app.db.models.round import Round
from app.db.models.season import Seasons
from app.db.models.team import Teams
from app.db.models.user import User
from app.main import app


class TestAwardsFlow(unittest.IsolatedAsyncioTestCase):
    async def test_awards_create_batch_and_recalculate_scores(self):
        conn = await engine.connect()
        trans = await conn.begin()
        session = AsyncSession(bind=conn, expire_on_commit=False, join_transaction_mode="create_savepoint")

        try:
            admin = (await session.execute(select(User).where(User.is_admin.is_(True)))).scalars().first()
            if not admin:
                admin = User(
                    name="Test Admin",
                    email="test_admin_aw@baygon.com",
                    username="test_admin_aw",
                    password="x",
                    is_admin=True,
                    phone_number="00000000000",
                    is_active=True,
                )
                session.add(admin)

            season = Seasons(
                number=997,
                initial_date=datetime(2026, 1, 1, tzinfo=timezone.utc),
                end_date=None,
                is_active=True,
            )
            session.add(season)
            await session.flush()

            rnd = Round(
                date=datetime(2026, 11, 12, tzinfo=timezone.utc),
                location="Arena Baygon",
                referee="Cruz",
                round_number=1,
                season_id=int(season.id_season),
            )
            session.add(rnd)

            p1 = Player(nome="PREMIADO A", apelido="PREMIADO A", potes=1, is_associate=True, is_guest=False)
            p2 = Player(nome="PREMIADO B", apelido="PREMIADO B", potes=2, is_associate=True, is_guest=False)
            session.add_all([p1, p2])
            await session.flush()

            team = Teams(name="TIME CAMPEAO", round_id=int(rnd.id_round), players=[p1, p2])
            session.add(team)
            await session.flush()

            season_id = int(season.id_season)
            round_id = int(rnd.id_round)
            p1_id, p2_id = int(p1.id_player), int(p2.id_player)
            team_id = int(team.id_team)
            admin_id = int(admin.id_user)
            admin_username = admin.username

            async def _override_get_db():
                yield session

            async def _override_admin():
                return SimpleNamespace(id_user=admin_id, is_admin=True, username=admin_username)

            app.dependency_overrides[get_db] = _override_get_db
            app.dependency_overrides[user_has_permission] = _override_admin

            transport = httpx.ASGITransport(app=app)
            async with httpx.AsyncClient(transport=transport, base_url="http://testserver") as client:
                # Seed default rules (bola_cheia=2, bola_murcha=-2, time_vencedor_rodada=1)
                r_seed = await client.post(f"/api/v1/rules/season/{season_id}/seed-defaults")
                self.assertEqual(r_seed.status_code, 201)

                # 1. Single award create with player_ids
                r_single = await client.post(
                    "/api/v1/awards/",
                    json={"round_id": round_id, "event_type": "gol_rodada", "player_ids": [p1_id]},
                )
                self.assertEqual(r_single.status_code, 201, r_single.text)
                self.assertEqual(len(r_single.json()["players"]), 1)
                self.assertEqual(r_single.json()["players"][0]["id_player"], p1_id)

                # 2. Batch post-round awards with recalculate_scores=True
                r_batch = await client.post(
                    f"/api/v1/awards/round/{round_id}/batch",
                    json={
                        "recalculate_scores": True,
                        "awards": [
                            {"event_type": "bola_cheia", "player_ids": [p1_id], "team_ids": []},
                            {"event_type": "bola_murcha", "player_ids": [p2_id], "team_ids": []},
                            {"event_type": "time_vencedor_rodada", "player_ids": [], "team_ids": [team_id]},
                            {"event_type": "gol_rodada", "player_ids": [p2_id], "team_ids": []},
                        ],
                    },
                )
                self.assertEqual(r_batch.status_code, 200, r_batch.text)
                awards_list = r_batch.json()
                self.assertEqual(len(awards_list), 4)

                # Verify gol_rodada was updated to p2 (no duplicate)
                gol_aw = next(a for a in awards_list if a["event_type"] == "gol_rodada")
                self.assertEqual(gol_aw["players"][0]["id_player"], p2_id)

                # Verify GET /awards/player/{p1_id} & /awards/team/{team_id}
                r_pl = await client.get(f"/api/v1/awards/player/{p1_id}")
                self.assertEqual(r_pl.status_code, 200, r_pl.text)
                self.assertEqual(len(r_pl.json()), 1)

                r_tm = await client.get(f"/api/v1/awards/team/{team_id}")
                self.assertEqual(r_tm.status_code, 200, r_tm.text)
                self.assertEqual(len(r_tm.json()), 1)

                # Verify PlayerScore recalculated: p1 has bola_cheia (+2) + time_vencedor_rodada (+1) = 3
                ps1 = (await session.execute(
                    select(PlayerScore).where(PlayerScore.round_id == round_id, PlayerScore.player_id == p1_id)
                )).scalar_one()
                self.assertEqual(ps1.points_individual, 2)
                self.assertEqual(ps1.points_team, 1)
                self.assertEqual(ps1.total_points, 3)
        finally:
            app.dependency_overrides.clear()
            await session.close()
            await trans.rollback()
            await conn.close()
            await engine.dispose()


if __name__ == "__main__":
    unittest.main(verbosity=2)
