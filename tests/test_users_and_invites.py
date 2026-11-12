import os
import unittest
from types import SimpleNamespace
from urllib.parse import parse_qs, urlparse

os.environ.setdefault("PYTHONUTF8", "1")

import httpx
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.dependencies.auth_dependencies import user_has_permission
from app.db.base import engine, get_db
from app.db.models.player import Player
from app.db.models.user import User
from app.main import app


class TestUsersInvitesAndPlayerLinking(unittest.IsolatedAsyncioTestCase):
    async def test_invite_link_player_and_complete_registration(self):
        conn = await engine.connect()
        trans = await conn.begin()
        session = AsyncSession(bind=conn, expire_on_commit=False, join_transaction_mode="create_savepoint")

        try:
            admin = (await session.execute(select(User).where(User.is_admin.is_(True)))).scalars().first()
            if not admin:
                admin = User(
                    name="Test Admin",
                    email="test_admin_u@baygon.local",
                    username="test_admin_u",
                    password="x",
                    is_admin=True,
                    phone_number="00000000000",
                    is_active=True,
                )
                session.add(admin)

            player = Player(
                nome="JOGADOR CONVIDADO",
                apelido="CONVIDADO",
                potes=2,
                is_associate=True,
                is_guest=False,
            )
            session.add(player)
            await session.flush()

            admin_id = int(admin.id_user)
            admin_username = admin.username
            player_id = int(player.id_player)

            async def _override_get_db():
                yield session

            async def _override_admin():
                return SimpleNamespace(id_user=admin_id, is_admin=True, username=admin_username)

            app.dependency_overrides[get_db] = _override_get_db
            app.dependency_overrides[user_has_permission] = _override_admin

            transport = httpx.ASGITransport(app=app)
            async with httpx.AsyncClient(transport=transport, base_url="http://testserver") as client:
                # 1. Create invited user
                r_create = await client.post(
                    "/api/v1/users/",
                    json={
                        "name": "Convidado Teste",
                        "email": "convidado_teste@baygon.com",
                        "username": "convidado_teste",
                        "phone_number": "71999990000",
                        "is_admin": False,
                    },
                )
                self.assertEqual(r_create.status_code, 201, r_create.text)
                created = r_create.json()
                user_id = created["id_user"]
                self.assertFalse(created["is_active"])
                self.assertTrue(created["temporary_password"])
                self.assertIn("setup_token=", created["invite_link"])

                # 2. Link & unlink player
                r_link = await client.post(f"/api/v1/users/{user_id}/link-player/{player_id}")
                self.assertEqual(r_link.status_code, 200, r_link.text)
                self.assertEqual(len(r_link.json()["players"]), 1)

                r_unlink = await client.delete(f"/api/v1/users/{user_id}/unlink-player/{player_id}")
                self.assertEqual(r_unlink.status_code, 200, r_unlink.text)
                self.assertEqual(len(r_unlink.json()["players"]), 0)

                # Re-link before completing registration
                r_link2 = await client.post(f"/api/v1/users/{user_id}/link-player/{player_id}")
                self.assertEqual(r_link2.status_code, 200)

                # 3. Resend invite
                r_resend = await client.post(f"/api/v1/users/{user_id}/resend-invite")
                self.assertEqual(r_resend.status_code, 200, r_resend.text)
                resent = r_resend.json()
                temp_pass = resent["temporary_password"]
                parsed_url = urlparse(resent["invite_link"])
                setup_token = parse_qs(parsed_url.query)["setup_token"][0]

                # 4. Complete registration (public endpoint)
                r_comp = await client.post(
                    "/api/v1/users/complete-registration",
                    json={
                        "setup_token": setup_token,
                        "temporary_password": temp_pass,
                        "new_password": "NovaSenha@123",
                    },
                )
                self.assertEqual(r_comp.status_code, 202, r_comp.text)

                # 5. Update user (promote to admin / verify updated_at works)
                r_upd = await client.put(f"/api/v1/users/{user_id}", json={"is_admin": True, "is_active": True})
                self.assertEqual(r_upd.status_code, 200, r_upd.text)
                self.assertTrue(r_upd.json()["is_admin"])
                self.assertTrue(r_upd.json()["is_active"])
        finally:
            app.dependency_overrides.clear()
            await session.close()
            await trans.rollback()
            await conn.close()
            await engine.dispose()


if __name__ == "__main__":
    unittest.main(verbosity=2)
