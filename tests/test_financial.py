import os
import unittest
from datetime import datetime, timezone
from decimal import Decimal

os.environ.setdefault("PYTHONUTF8", "1")

import httpx
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.dependencies.auth_dependencies import get_current_user, user_has_permission
from app.db.base import engine, get_db
from app.db.models.player import Player
from app.db.models.user import User
from app.main import app


class TestFinancialModule(unittest.IsolatedAsyncioTestCase):
    async def test_financial_fees_costs_and_summary(self):
        conn = await engine.connect()
        trans = await conn.begin()
        session = AsyncSession(bind=conn, expire_on_commit=False, join_transaction_mode="create_savepoint")

        try:
            # 1. Admin user
            admin = (await session.execute(select(User).where(User.is_admin.is_(True)))).scalars().first()
            if not admin:
                admin = User(
                    name="Admin Financeiro",
                    email="admin_fin@baygon.local",
                    username="admin_fin",
                    password="x",
                    is_admin=True,
                    phone_number="71999991111",
                    is_active=True,
                )
                session.add(admin)
                await session.flush()

            # 2. Regular user (non-admin)
            regular_user = User(
                name="Regular User",
                email="user_regular@baygon.local",
                username="user_regular",
                password="x",
                is_admin=False,
                phone_number="71999992222",
                is_active=True,
            )
            session.add(regular_user)
            await session.flush()

            # 3. Create a test associate player
            player = Player(
                nome="Jogador Mensalista Teste",
                apelido="Mensalista",
                is_associate=True,
                is_guest=False,
            )
            session.add(player)
            await session.flush()

            async def override_get_db():
                yield session

            app.dependency_overrides[get_db] = override_get_db

            # --- Test non-admin receives 403 Forbidden ---
            app.dependency_overrides[get_current_user] = lambda: regular_user
            transport = httpx.ASGITransport(app=app)
            async with httpx.AsyncClient(transport=transport, base_url="http://testserver") as client:
                resp = await client.get("/api/v1/financial/summary")
                # user_has_permission raises 403
                self.assertEqual(resp.status_code, 403)

            # --- Now test as Admin ---
            app.dependency_overrides[get_current_user] = lambda: admin
            async with httpx.AsyncClient(transport=transport, base_url="http://testserver") as client:
                # 1. Generate fees for month 11/2026
                gen_resp = await client.post(
                    "/api/v1/financial/fees/generate-month",
                    json={
                        "year": 2026,
                        "month": 11,
                        "default_amount": 60.0,
                        "only_associates": True,
                    },
                )
                self.assertEqual(gen_resp.status_code, 200, gen_resp.text)
                gen_data = gen_resp.json()
                self.assertGreaterEqual(gen_data["created_count"], 1)

                # 2. List fees
                list_resp = await client.get("/api/v1/financial/fees?year=2026&month=11")
                self.assertEqual(list_resp.status_code, 200)
                fees = list_resp.json()
                self.assertTrue(any(f["player_id"] == player.id_player for f in fees))

                fee_target = next(f for f in fees if f["player_id"] == player.id_player)
                self.assertEqual(fee_target["status"], "pending")
                self.assertEqual(float(fee_target["amount"]), 60.0)

                # 3. Mark fee as paid
                patch_resp = await client.patch(
                    f"/api/v1/financial/fees/{fee_target['id_fee']}/status",
                    json={"status": "paid", "payment_method": "PIX"},
                )
                self.assertEqual(patch_resp.status_code, 200)
                patched = patch_resp.json()
                self.assertEqual(patched["status"], "paid")
                self.assertEqual(patched["payment_method"], "PIX")
                self.assertIsNotNone(patched["paid_at"])

                # 4. Create an expense (cost)
                cost_resp = await client.post(
                    "/api/v1/financial/costs",
                    json={
                        "description": "Aluguel da Quadra / Campo",
                        "category": "Campo",
                        "amount": 250.0,
                        "cost_date": "2026-11-15T18:00:00Z",
                        "status": "paid",
                        "payment_method": "PIX",
                        "notes": "Pagamento mensal da arena",
                    },
                )
                self.assertEqual(cost_resp.status_code, 201, cost_resp.text)
                cost = cost_resp.json()
                self.assertEqual(cost["description"], "Aluguel da Quadra / Campo")
                self.assertEqual(float(cost["amount"]), 250.0)

                # 5. List costs
                costs_resp = await client.get("/api/v1/financial/costs?year=2026&month=11")
                self.assertEqual(costs_resp.status_code, 200)
                costs = costs_resp.json()
                self.assertTrue(any(c["id_cost"] == cost["id_cost"] for c in costs))

                # 6. Check summary
                summary_resp = await client.get("/api/v1/financial/summary?year=2026&month=11")
                self.assertEqual(summary_resp.status_code, 200)
                summary = summary_resp.json()

                self.assertIn("period", summary)
                self.assertIn("overall", summary)
                self.assertIn("trends", summary)
                self.assertGreaterEqual(summary["period"]["total_fees_paid"], 60.0)
                self.assertGreaterEqual(summary["period"]["total_costs_paid"], 250.0)

                # 7. Delete cost
                del_cost_resp = await client.delete(f"/api/v1/financial/costs/{cost['id_cost']}")
                self.assertEqual(del_cost_resp.status_code, 204)

        finally:
            app.dependency_overrides.clear()
            await trans.rollback()
            await conn.close()
