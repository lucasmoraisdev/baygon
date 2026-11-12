import os
import unittest
from datetime import datetime, timezone
from types import SimpleNamespace

os.environ.setdefault("PYTHONUTF8", "1")

import httpx
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.dependencies.auth_dependencies import get_current_user, user_has_permission
from app.db.base import Base, engine, get_db
from app.db.models.player import Player
from app.db.models.round import Round
from app.db.models.season import Seasons
from app.db.models.user import User
from app.main import app


class TestAttendanceFlow(unittest.IsolatedAsyncioTestCase):
    async def test_attendance_rsvp_batch_and_delete(self):
        async with engine.begin() as init_conn:
            await init_conn.run_sync(Base.metadata.create_all)

        conn = await engine.connect()
        trans = await conn.begin()
        session = AsyncSession(bind=conn, expire_on_commit=False, join_transaction_mode="create_savepoint")

        try:
            u_linked = User(
                name="Jogador Vinculado",
                email="linked_att@baygon.com",
                username="linked_att",
                password="x",
                is_admin=False,
                phone_number="11911112222",
                is_active=True,
            )
            u_unlinked = User(
                name="Sem Jogador",
                email="unlinked_att@baygon.com",
                username="unlinked_att",
                password="x",
                is_admin=False,
                phone_number="11911113333",
                is_active=True,
            )
            session.add_all([u_linked, u_unlinked])

            season = Seasons(
                number=996,
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
                round_number=3,
                season_id=int(season.id_season),
            )
            session.add(rnd)
            await session.flush()

            p1 = Player(
                nome="ATLETA 1",
                apelido="ATLETA 1",
                potes=1,
                user_id=int(u_linked.id_user),
                is_associate=True,
                is_guest=False,
            )
            p2 = Player(
                nome="ATLETA 2",
                apelido="ATLETA 2",
                potes=2,
                is_associate=True,
                is_guest=False,
            )
            session.add_all([p1, p2])
            await session.flush()

            round_id = int(rnd.id_round)
            u_linked_id = int(u_linked.id_user)
            u_unlinked_id = int(u_unlinked.id_user)
            p1_id, p2_id = int(p1.id_player), int(p2.id_player)

            current_uid = {"id": u_unlinked_id}

            async def _override_get_db():
                yield session

            async def _override_current_user():
                return SimpleNamespace(id_user=current_uid["id"], is_admin=False)

            async def _override_admin():
                return {"id_user": u_linked_id, "is_admin": True}

            app.dependency_overrides[get_db] = _override_get_db
            app.dependency_overrides[get_current_user] = _override_current_user
            app.dependency_overrides[user_has_permission] = _override_admin

            async with httpx.AsyncClient(
                transport=httpx.ASGITransport(app=app),
                base_url="http://testserver",
            ) as client:
                # 1. Unlinked user cannot RSVP -> 400
                unlinked_resp = await client.post(
                    f"/api/v1/attendance/round/{round_id}/me",
                    json={"status": "confirmed"},
                )
                self.assertEqual(unlinked_resp.status_code, 400)

                # 2. Linked user confirms -> 200
                current_uid["id"] = u_linked_id
                rsvp_resp = await client.post(
                    f"/api/v1/attendance/round/{round_id}/me",
                    json={"status": "confirmed"},
                )
                self.assertEqual(rsvp_resp.status_code, 200, rsvp_resp.text)
                self.assertEqual(rsvp_resp.json()["player_id"], p1_id)
                self.assertEqual(rsvp_resp.json()["status"], "confirmed")

                # 3. Linked user updates to waiting
                wait_resp = await client.post(
                    f"/api/v1/attendance/round/{round_id}/me",
                    json={"status": "waiting"},
                )
                self.assertEqual(wait_resp.status_code, 200)
                self.assertEqual(wait_resp.json()["status"], "waiting")

                # 4. Admin batch marks p1 confirmed and p2 declined
                batch_resp = await client.post(
                    f"/api/v1/attendance/round/{round_id}/batch",
                    json={
                        "items": [
                            {"player_id": p1_id, "status": "confirmed"},
                            {"player_id": p2_id, "status": "declined"},
                        ]
                    },
                )
                self.assertEqual(batch_resp.status_code, 200, batch_resp.text)
                summary = batch_resp.json()
                self.assertEqual(summary["confirmed_count"], 1)
                self.assertEqual(summary["declined_count"], 1)
                self.assertEqual(summary["waiting_count"], 0)

                # 5. Admin removes p2 from list
                del_resp = await client.delete(f"/api/v1/attendance/round/{round_id}/player/{p2_id}")
                self.assertEqual(del_resp.status_code, 204)

                get_resp = await client.get(f"/api/v1/attendance/round/{round_id}")
                self.assertEqual(get_resp.status_code, 200)
                self.assertEqual(len(get_resp.json()["items"]), 1)
        finally:
            app.dependency_overrides.clear()
            await session.close()
            await trans.rollback()
            await conn.close()
