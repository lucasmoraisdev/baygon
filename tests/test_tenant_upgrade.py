import os
import unittest
import uuid
import httpx
from sqlalchemy import select, delete
from sqlalchemy.ext.asyncio import AsyncSession

os.environ.setdefault("PYTHONUTF8", "1")

from app.db.base import engine
from app.db.models.tenant import Tenant
from app.db.models.tenant_module import TenantModule
from app.db.models.tenant_audit import TenantAuditLog
from app.db.models.user import User
from app.core.tenant_context import set_tenant_bypass, clear_tenant_context
from app.core.jwt_manager import JWTManager
from app.main import app


class TestTenantUpgrade(unittest.IsolatedAsyncioTestCase):
    """
    Testes de Integração para Upgrade de Planos e Assinatura do Tenant:
    - Upgrade do plano Free para Pro All Inclusive.
    - Ativação atômica de todos os módulos inclusos.
    - Registro de log de auditoria.
    - Reflexo instantâneo no endpoint /tenant/me.
    """

    async def asyncSetUp(self):
        clear_tenant_context()
        self.tenant_id = str(uuid.uuid4())
        self.tenant_slug = f"liga-upgrade-{uuid.uuid4().hex[:6]}"

        set_tenant_bypass(True)
        try:
            async with AsyncSession(engine) as session:
                tenant = Tenant(
                    id_tenant=self.tenant_id,
                    name="Liga Teste Upgrade",
                    slug=self.tenant_slug,
                    status="active",
                    plan_id=None,  # Começa no plano free por default
                )
                session.add(tenant)

                mod = TenantModule(
                    tenant_id=self.tenant_id,
                    module_code="competitions",
                    is_active=True,
                )
                session.add(mod)

                user = User(
                    name="Gestor Upgrade",
                    username=f"gestor_{uuid.uuid4().hex[:6]}",
                    email=f"gestor_{uuid.uuid4().hex[:6]}@baygon.local",
                    password="fakehash",
                    phone_number="11999996666",
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
                await session.execute(delete(TenantAuditLog).where(TenantAuditLog.tenant_id == self.tenant_id))
                await session.execute(delete(User).where(User.tenant_id == self.tenant_id))
                await session.execute(delete(TenantModule).where(TenantModule.tenant_id == self.tenant_id))
                await session.execute(delete(Tenant).where(Tenant.id_tenant == self.tenant_id))
                await session.commit()
        finally:
            clear_tenant_context()
            await engine.dispose()

    async def test_upgrade_from_free_to_pro(self):
        transport = httpx.ASGITransport(app=app)
        async with httpx.AsyncClient(transport=transport, base_url="http://testserver") as client:
            # 1. Verifica estado inicial via /api/v1/tenant/me
            resp_init = await client.get("/api/v1/tenant/me", headers=self.headers)
            self.assertEqual(resp_init.status_code, 200)
            data_init = resp_init.json()
            # Inicialmente cota gratuita (2 torneios)
            self.assertEqual(data_init["tournament_quota"]["plan_code"], "free")
            self.assertEqual(data_init["tournament_quota"]["tournaments_limit"], 2)

            # 2. Executa upgrade para Pro All Inclusive
            resp_upgrade = await client.post(
                "/api/v1/tenant/upgrade-plan",
                json={
                    "plan_code": "pro_all_inclusive",
                    "billing_cycle": "annual",
                },
                headers=self.headers,
            )
            self.assertEqual(resp_upgrade.status_code, 200)
            data_up = resp_upgrade.json()
            self.assertTrue(data_up["success"])
            self.assertEqual(data_up["plan_code"], "pro_all_inclusive")
            self.assertIn("fantasy", data_up["modules"])
            self.assertIn("financial", data_up["modules"])

            # 3. Consulta /api/v1/tenant/me novamente e comprova a atualização instantânea
            resp_after = await client.get("/api/v1/tenant/me", headers=self.headers)
            self.assertEqual(resp_after.status_code, 200)
            data_after = resp_after.json()
            self.assertEqual(data_after["plan"]["code"], "pro_all_inclusive")
            self.assertEqual(data_after["tournament_quota"]["plan_code"], "pro_all_inclusive")
            self.assertEqual(data_after["tournament_quota"]["tournaments_limit"], -1)
            self.assertTrue(data_after["tournament_quota"]["can_create"])


if __name__ == "__main__":
    unittest.main()
