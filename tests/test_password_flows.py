import os
import unittest
from types import SimpleNamespace

os.environ.setdefault("PYTHONUTF8", "1")

import httpx
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config.settings import PHRASE_ENCODE
from app.core.dependencies.auth_dependencies import get_current_user, user_has_permission
from app.core.utils import encrypt_data
from app.db.base import engine, get_db
from app.db.models.user import User
from app.main import app


class TestPasswordFlows(unittest.IsolatedAsyncioTestCase):
    async def test_change_password_and_reset_password_flows(self):
        conn = await engine.connect()
        trans = await conn.begin()
        session = AsyncSession(bind=conn, expire_on_commit=False, join_transaction_mode="create_savepoint")

        try:
            initial_pw = "Baygon@123"
            user = User(
                name="Teste Senha",
                email="teste_senha@baygon.com",
                username="teste_senha",
                password=encrypt_data(initial_pw, PHRASE_ENCODE),
                is_admin=False,
                phone_number="11999998888",
                is_active=True,
            )
            session.add(user)
            await session.flush()

            user_id = int(user.id_user)
            user_email = user.email
            user_username = user.username

            async def _override_get_db():
                yield session

            async def _override_current_user():
                return SimpleNamespace(id_user=user_id, username=user_username, email=user_email, is_admin=False)

            async def _override_admin():
                return SimpleNamespace(id_user=user_id, username="admin", is_admin=True)

            app.dependency_overrides[get_db] = _override_get_db
            app.dependency_overrides[get_current_user] = _override_current_user
            app.dependency_overrides[user_has_permission] = _override_admin

            async with httpx.AsyncClient(
                transport=httpx.ASGITransport(app=app),
                base_url="http://testserver",
            ) as client:
                # 1. Wrong current password -> 401
                bad_curr = await client.post(
                    "/api/v1/change-password",
                    json={"current_password": "Wrong@123", "new_password": "Nova@1234"},
                )
                self.assertEqual(bad_curr.status_code, 401)

                # 2. Weak new password -> 400
                weak_pw = await client.post(
                    "/api/v1/change-password",
                    json={"current_password": initial_pw, "new_password": "123"},
                )
                self.assertEqual(weak_pw.status_code, 400)

                # 3. Valid change-password -> 200
                ok_change = await client.post(
                    "/api/v1/change-password",
                    json={"current_password": initial_pw, "new_password": "NovaSenha@2026"},
                )
                self.assertEqual(ok_change.status_code, 200, ok_change.text)

                # 4. Forgot password returns generic 200
                forgot_resp = await client.post(
                    "/api/v1/forgot-password",
                    json={"email": user_email},
                )
                self.assertEqual(forgot_resp.status_code, 200)

                # 5. Admin generates reset-password-link
                link_resp = await client.post(f"/api/v1/users/{user_id}/reset-password-link")
                self.assertEqual(link_resp.status_code, 200, link_resp.text)
                reset_link = link_resp.json()["reset_link"]
                token = reset_link.split("token=")[-1]

                # 6. Reset password with token
                reset_resp = await client.post(
                    "/api/v1/reset-password",
                    json={"token": token, "new_password": "Resetada@2026"},
                )
                self.assertEqual(reset_resp.status_code, 200, reset_resp.text)

                # 7. Token cannot be reused
                reuse_resp = await client.post(
                    "/api/v1/reset-password",
                    json={"token": token, "new_password": "Outra@2026"},
                )
                self.assertEqual(reuse_resp.status_code, 404)

                # 8. Login succeeds with the new reset password
                login_resp = await client.post(
                    "/api/v1/login",
                    json={"email": user_email, "password": "Resetada@2026"},
                )
                self.assertEqual(login_resp.status_code, 200, login_resp.text)
                self.assertIn("access_token", login_resp.json())
        finally:
            app.dependency_overrides.clear()
            await session.close()
            await trans.rollback()
            await conn.close()
