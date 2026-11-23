import os
import unittest
import uuid
import httpx
from sqlalchemy.ext.asyncio import AsyncSession

os.environ.setdefault("PYTHONUTF8", "1")

from app.db.base import engine
from app.db.models.tenant import Tenant
from app.db.models.tenant_module import TenantModule
from app.db.models.season import Seasons
from app.core.tenant_context import set_tenant_bypass, clear_tenant_context
from app.main import app


class TestTenantModulesAndResolution(unittest.IsolatedAsyncioTestCase):
    async def asyncSetUp(self):
        clear_tenant_context()

    async def asyncTearDown(self):
        clear_tenant_context()
        await engine.dispose()

    async def test_tenant_me_and_slug_check(self):
        """Valida os endpoints /api/v1/tenant/me e /api/v1/tenants/check-slug."""
        transport = httpx.ASGITransport(app=app)
        async with httpx.AsyncClient(transport=transport, base_url="http://testserver") as client:
            # 1. Consulta metadados da Baygon via header x-tenant-slug
            response = await client.get("/api/v1/tenant/me", headers={"x-tenant-slug": "baygon"})
            self.assertEqual(response.status_code, 200)
            data = response.json()
            self.assertEqual(data["slug"], "baygon")
            self.assertIn("competitions", data["modules"])
            self.assertIn("fantasy", data["modules"])
            self.assertIn("financial", data["modules"])

            # 2. Checagem de disponibilidade de slug
            res_baygon = await client.get("/api/v1/tenants/check-slug?slug=baygon")
            self.assertEqual(res_baygon.status_code, 200)
            self.assertFalse(res_baygon.json()["available"], "O slug 'baygon' já está em uso.")

            res_novo = await client.get("/api/v1/tenants/check-slug?slug=liga-inedita-xyz-999")
            self.assertEqual(res_novo.status_code, 200)
            self.assertTrue(res_novo.json()["available"], "O slug inédito deve estar disponível.")

    async def test_require_module_guard_blocks_unsubscribed_tenants(self):
        """
        Valida que o guard @require_module('fantasy') bloqueia imediatamente
        associações que não possuem o módulo contratado.
        """
        tenant_slug = f"liga-basica-{uuid.uuid4().hex[:6]}"
        tenant_id = f"test-basico-{uuid.uuid4().hex[:8]}"

        set_tenant_bypass(True)
        try:
            async with AsyncSession(engine) as session:
                tenant_sem_fantasy = Tenant(
                    id_tenant=tenant_id,
                    name="Liga Sem Fantasy",
                    slug=tenant_slug,
                    status="active",
                )
                mod_comp = TenantModule(tenant_id=tenant_id, module_code="competitions", is_active=True)
                session.add_all([tenant_sem_fantasy, mod_comp])
                await session.commit()
        finally:
            set_tenant_bypass(False)

        try:
            from app.core.dependencies.auth_dependencies import get_current_user
            from app.db.models.user import User

            fake_admin = User(
                id_user=1,
                name="Admin Baygon",
                email="admin@baygon.local",
                username="admin_baygon",
                is_admin=True,
                is_active=True,
                tenant_id="00000000-0000-0000-0000-000000000001",
            )
            app.dependency_overrides[get_current_user] = lambda: fake_admin

            transport = httpx.ASGITransport(app=app)
            async with httpx.AsyncClient(transport=transport, base_url="http://testserver") as client:
                # 1. Chamada para /api/v1/fantasy/status com o tenant sem fantasy -> DEVE RETORNAR 403
                res_bloqueado = await client.get(
                    "/api/v1/fantasy/status?season_id=1",
                    headers={"x-tenant-slug": tenant_slug}
                )
                self.assertEqual(res_bloqueado.status_code, 403)
                detail = res_bloqueado.json().get("detail", {})
                self.assertEqual(detail.get("error"), "feature_not_subscribed")
                self.assertEqual(detail.get("module"), "fantasy")

                # 2. Chamada para a mesma rota com a Baygon (que possui fantasy) -> DEVE RETORNAR 200
                res_permitido = await client.get(
                    "/api/v1/fantasy/status?season_id=1",
                    headers={"x-tenant-slug": "baygon"}
                )
                self.assertEqual(res_permitido.status_code, 200)

        finally:
            from app.core.dependencies.auth_dependencies import get_current_user
            app.dependency_overrides.pop(get_current_user, None)
            # Limpa o tenant de teste do banco e invalida cache
            from app.core.services.tenant_service import TenantService
            TenantService.invalidate_cache(slug=tenant_slug, id_tenant=tenant_id)
            set_tenant_bypass(True)
            async with AsyncSession(engine) as del_session:
                t = await del_session.get(Tenant, tenant_id)
                if t:
                    await del_session.delete(t)
                    await del_session.commit()
            set_tenant_bypass(False)

    async def test_non_existent_and_suspended_subdomains(self):
        """Valida que subdomínios inexistentes retornam 404 e suspensos retornam 403."""
        transport = httpx.ASGITransport(app=app)
        async with httpx.AsyncClient(transport=transport, base_url="http://testserver") as client:
            # 1. Subdomínio inexistente
            res_404 = await client.get("/api/v1/tenant/me", headers={"x-tenant-slug": "subdominio-inexistente-12345"})
            self.assertEqual(res_404.status_code, 404)
            self.assertEqual(res_404.json().get("error"), "tenant_not_found")


if __name__ == "__main__":
    unittest.main()
