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
from app.db.models.round import Round
from app.db.models.season import Seasons
from app.db.models.user import User
from app.main import app


class TestTeamDrawFlow(unittest.IsolatedAsyncioTestCase):
    async def test_draw_preview_batch_replace_and_update_players(self):
        conn = await engine.connect()
        trans = await conn.begin()
        session = AsyncSession(bind=conn, expire_on_commit=False, join_transaction_mode="create_savepoint")

        try:
            admin = (await session.execute(select(User).where(User.is_admin.is_(True)))).scalars().first()
            if not admin:
                admin = User(
                    name="Test Admin Draw",
                    email="test_admin_draw@baygon.com",
                    username="test_admin_draw",
                    password="x",
                    is_admin=True,
                    phone_number="00000000000",
                    is_active=True,
                )
                session.add(admin)

            season = Seasons(
                number=998,
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
                round_number=2,
                season_id=int(season.id_season),
            )
            session.add(rnd)

            players = [
                Player(nome=f"POTE1_{i}", apelido=f"P1_{i}", potes=1, is_associate=True, is_guest=False)
                for i in range(4)
            ] + [
                Player(nome=f"POTE2_{i}", apelido=f"P2_{i}", potes=2, is_associate=True, is_guest=False)
                for i in range(4)
            ] + [
                Player(nome="CONVIDADO_SEM_POTE", apelido="CONV", potes=None, is_associate=False, is_guest=True)
            ]
            session.add_all(players)
            await session.flush()

            round_id = int(rnd.id_round)
            player_ids = [int(p.id_player) for p in players]
            guest_id = int(players[-1].id_player)
            admin_id = int(admin.id_user)
            admin_username = admin.username

            async def _override_get_db():
                yield session

            async def _override_admin():
                return SimpleNamespace(id_user=admin_id, is_admin=True, username=admin_username)

            app.dependency_overrides[get_db] = _override_get_db
            app.dependency_overrides[user_has_permission] = _override_admin

            async with httpx.AsyncClient(
                transport=httpx.ASGITransport(app=app),
                base_url="http://testserver",
            ) as client:
                # 1. Draw preview with pot override on guest (overridden to pot 3)
                draw_resp = await client.post(
                    "/api/v1/teams/draw-preview",
                    json={
                        "player_ids": player_ids,
                        "num_teams": 4,
                        "pote_overrides": {str(guest_id): 3},
                    },
                )
                self.assertEqual(draw_resp.status_code, 200, draw_resp.text)
                draw_data = draw_resp.json()
                self.assertEqual(len(draw_data["teams"]), 4)
                all_drawn_ids = [p["id_player"] for t in draw_data["teams"] for p in t["players"]]
                self.assertEqual(sorted(all_drawn_ids), sorted(player_ids))
                # Each team should have at least 2 players and at most 3
                sizes = [len(t["players"]) for t in draw_data["teams"]]
                self.assertEqual(sorted(sizes), [2, 2, 2, 3])
                # Guest override pot should be 3
                guest_entries = [p for t in draw_data["teams"] for p in t["players"] if p["id_player"] == guest_id]
                self.assertEqual(guest_entries[0]["potes"], 3)

                # 2. Save batch teams on round
                batch_payload = {
                    "overwrite_existing": False,
                    "teams": [
                        {"name": t["name"], "player_ids": [p["id_player"] for p in t["players"]]}
                        for t in draw_data["teams"]
                    ],
                }
                batch_resp = await client.post(f"/api/v1/teams/round/{round_id}/batch", json=batch_payload)
                self.assertEqual(batch_resp.status_code, 201, batch_resp.text)
                created_teams = batch_resp.json()
                self.assertEqual(len(created_teams), 4)

                # 3. Saving again without overwrite_existing fails with 400
                dup_resp = await client.post(f"/api/v1/teams/round/{round_id}/batch", json=batch_payload)
                self.assertEqual(dup_resp.status_code, 400)

                # 4. Overwrite with pre-formed manual teams
                manual_resp = await client.post(
                    f"/api/v1/teams/round/{round_id}/batch",
                    json={
                        "overwrite_existing": True,
                        "teams": [
                            {"name": "Time Azul", "player_ids": player_ids[:4]},
                            {"name": "Time Preto", "player_ids": player_ids[4:8]},
                        ],
                    },
                )
                self.assertEqual(manual_resp.status_code, 201, manual_resp.text)
                manual_teams = manual_resp.json()
                self.assertEqual(len(manual_teams), 2)

                list_resp = await client.get(f"/api/v1/teams/round/{round_id}")
                self.assertEqual(list_resp.status_code, 200)
                self.assertEqual(len(list_resp.json()), 2)

                # 5. Update team players via PUT /teams/{id}
                first_team_id = manual_teams[0]["id_team"]
                put_resp = await client.put(
                    f"/api/v1/teams/{first_team_id}",
                    json={"name": "Time Azul Editado", "player_ids": player_ids[:5]},
                )
                self.assertEqual(put_resp.status_code, 200, put_resp.text)
                updated = put_resp.json()
                self.assertEqual(updated["name"], "Time Azul Editado")
                self.assertEqual(len(updated["players"]), 5)
        finally:
            app.dependency_overrides.clear()
            await session.close()
            await trans.rollback()
            await conn.close()
