import os
import unittest
import uuid
import httpx
from datetime import datetime
from sqlalchemy import select, update, delete
from sqlalchemy.ext.asyncio import AsyncSession

os.environ.setdefault("PYTHONUTF8", "1")

from app.db.base import engine
from app.db.models.tenant import Tenant
from app.db.models.tenant_module import TenantModule
from app.db.models.user import User
from app.db.models.plan import Plan
from app.db.models.season import Seasons
from app.core.tenant_context import set_tenant_bypass, clear_tenant_context
from app.core.jwt_manager import JWTManager
from app.core.services.tenant_service import TenantService
from app.main import app


class TestTournamentQuota(unittest.IsolatedAsyncioTestCase):
    """
    Testes de Integração para a Regra de Negócio de Cotas de Torneios por Plano:
    - O usuário pode criar X torneios gratuitos (padrão X=2 definido no banco no plano 'free').
    - A partir de X+1, a criação é bloqueada com HTTP 402 Payment Required.
    - Ao realizar upgrade para Plano Básico (max_seasons=3), a cota é expandida.
    - No Plano Pro (max_seasons=-1), a criação de torneios é ilimitada.
    - Cotas personalizadas por associação (tenants.custom_max_tournaments) sobrepõem o plano.
    - A regra é validada tanto em /api/v1/tournaments quanto em /api/v1/seasons.
    """

    async def asyncSetUp(self):
        clear_tenant_context()
        self.tenant_id = str(uuid.uuid4())
        self.tenant_slug = f"liga-quota-{uuid.uuid4().hex[:6]}"
        self.created_season_ids = []

        set_tenant_bypass(True)
        try:
            async with AsyncSession(engine) as session:
                # 1. Cria tenant isolado sem plano vinculado inicialmente
                tenant = Tenant(
                    id_tenant=self.tenant_id,
                    name="Liga Teste de Cotas",
                    slug=self.tenant_slug,
                    status="active",
                    plan_id=None,
                )
                session.add(tenant)

                # 2. Habilita módulo core 'competitions'
                mod = TenantModule(
                    tenant_id=self.tenant_id,
                    module_code="competitions",
                    is_active=True,
                )
                session.add(mod)

                # 3. Cria gestor administrador
                self.admin_email = f"gestor_{uuid.uuid4().hex[:6]}@baygon.local"
                admin_user = User(
                    name="Gestor da Liga",
                    email=self.admin_email,
                    username=f"gestor_{uuid.uuid4().hex[:6]}",
                    password="fakehash",
                    phone_number="11999998888",
                    is_admin=True,
                    is_active=True,
                    tenant_id=self.tenant_id,
                )
                session.add(admin_user)
                await session.flush()
                self.admin_id = admin_user.id_user

                # 4. Obtém os IDs dos planos 'basic' e 'pro_all_inclusive'
                stmt_plans = select(Plan).where(Plan.code.in_(["basic", "pro_all_inclusive"]))
                plans = (await session.execute(stmt_plans)).scalars().all()
                self.plan_map = {p.code: p.id_plan for p in plans}

                await session.commit()
        finally:
            set_tenant_bypass(False)

        self.token = JWTManager.create_access_token({
            "sub": self.admin_email,
            "user_id": self.admin_id,
            "tenant_id": self.tenant_id,
        })
        self.headers = {
            "x-tenant-slug": self.tenant_slug,
            "Authorization": f"Bearer {self.token}",
        }

    async def asyncTearDown(self):
        clear_tenant_context()
        set_tenant_bypass(True)
        try:
            async with AsyncSession(engine) as session:
                if self.created_season_ids:
                    await session.execute(
                        delete(Seasons).where(Seasons.id_season.in_(self.created_season_ids))
                    )
                await session.execute(delete(User).where(User.tenant_id == self.tenant_id))
                await session.execute(delete(TenantModule).where(TenantModule.tenant_id == self.tenant_id))
                await session.execute(delete(Tenant).where(Tenant.id_tenant == self.tenant_id))
                await session.commit()
            TenantService.invalidate_cache(self.tenant_slug, self.tenant_id)
        finally:
            set_tenant_bypass(False)
            await engine.dispose()

    async def test_01_free_plan_quota_and_x_plus_one_block(self):
        """Valida que o plano gratuito permite X=2 torneios e bloqueia o X+1 com HTTP 402."""
        transport = httpx.ASGITransport(app=app)
        async with httpx.AsyncClient(transport=transport, base_url="http://testserver") as client:
            # 1. Consulta cota inicial (0/2)
            quota_res = await client.get("/api/v1/tournaments/quota", headers=self.headers)
            self.assertEqual(quota_res.status_code, 200)
            quota_data = quota_res.json()
            self.assertEqual(quota_data["plan_code"], "free")
            self.assertEqual(quota_data["tournaments_limit"], 2)
            self.assertEqual(quota_data["tournaments_created"], 0)
            self.assertEqual(quota_data["tournaments_remaining"], 2)
            self.assertTrue(quota_data["can_create"])
            self.assertFalse(quota_data["upgrade_required"])

            # 2. Cria Torneio 1 (dentro da cota gratuita)
            t1_res = await client.post(
                "/api/v1/tournaments/",
                headers=self.headers,
                json={
                    "name": "Campeonato Gratuito 1",
                    "tournament_format": "pontos_corridos",
                },
            )
            self.assertEqual(t1_res.status_code, 201, t1_res.text)
            self.created_season_ids.append(t1_res.json()["id_season"])

            # 3. Cria Torneio 2 (esgotando a cota gratuita X=2)
            t2_res = await client.post(
                "/api/v1/tournaments/",
                headers=self.headers,
                json={
                    "name": "Copa Mata-Mata Gratuita 2",
                    "tournament_format": "mata_mata",
                },
            )
            self.assertEqual(t2_res.status_code, 201, t2_res.text)
            self.created_season_ids.append(t2_res.json()["id_season"])

            # 4. Checa cota esgotada (2/2)
            quota_res2 = await client.get("/api/v1/tournaments/quota", headers=self.headers)
            self.assertEqual(quota_res2.status_code, 200)
            quota_data2 = quota_res2.json()
            self.assertEqual(quota_data2["tournaments_created"], 2)
            self.assertEqual(quota_data2["tournaments_remaining"], 0)
            self.assertFalse(quota_data2["can_create"])
            self.assertTrue(quota_data2["upgrade_required"])

            # 5. Tentativa de criar o Torneio X+1 (Torneio 3) -> DEVE SER BLOQUEADO COM HTTP 402
            t3_res = await client.post(
                "/api/v1/tournaments/",
                headers=self.headers,
                json={
                    "name": "Torneio Excedente 3",
                    "tournament_format": "grupos_e_mata_mata",
                },
            )
            self.assertEqual(t3_res.status_code, 402)
            err_detail = t3_res.json()["detail"]
            self.assertEqual(err_detail["code"], "TOURNAMENT_QUOTA_EXCEEDED")
            self.assertTrue(err_detail["quota"]["upgrade_required"])
            self.assertEqual(err_detail["quota"]["tournaments_remaining"], 0)

    async def test_02_plan_upgrade_unlocks_more_tournaments(self):
        """Valida que o upgrade de plano expande a cota e permite criar mais torneios."""
        transport = httpx.ASGITransport(app=app)
        async with httpx.AsyncClient(transport=transport, base_url="http://testserver") as client:
            # Cria 2 torneios no plano gratuito
            for i in range(1, 3):
                t_res = await client.post(
                    "/api/v1/tournaments/",
                    headers=self.headers,
                    json={"name": f"Torneio Free {i}", "tournament_format": "pontos_corridos"},
                )
                self.assertEqual(t_res.status_code, 201)
                self.created_season_ids.append(t_res.json()["id_season"])

            # Simula upgrade no banco para Plano Básico (max_seasons = 3)
            set_tenant_bypass(True)
            try:
                async with AsyncSession(engine) as session:
                    await session.execute(
                        update(Tenant)
                        .where(Tenant.id_tenant == self.tenant_id)
                        .values(plan_id=self.plan_map["basic"])
                    )
                    await session.commit()
                TenantService.invalidate_cache(self.tenant_slug, self.tenant_id)
            finally:
                set_tenant_bypass(False)

            # Consulta cota após upgrade (2/3)
            quota_res = await client.get("/api/v1/tournaments/quota", headers=self.headers)
            self.assertEqual(quota_res.status_code, 200)
            quota_data = quota_res.json()
            self.assertEqual(quota_data["plan_code"], "basic")
            self.assertEqual(quota_data["tournaments_limit"], 3)
            self.assertEqual(quota_data["tournaments_created"], 2)
            self.assertEqual(quota_data["tournaments_remaining"], 1)
            self.assertTrue(quota_data["can_create"])

            # Agora consegue criar o 3º torneio com sucesso
            t3_res = await client.post(
                "/api/v1/tournaments/",
                headers=self.headers,
                json={"name": "Torneio Plano Básico 3", "tournament_format": "mata_mata"},
            )
            self.assertEqual(t3_res.status_code, 201)
            self.created_season_ids.append(t3_res.json()["id_season"])

            # 4º torneio atinge o limite do Plano Básico (3/3) -> bloqueado
            t4_res = await client.post(
                "/api/v1/tournaments/",
                headers=self.headers,
                json={"name": "Torneio Excedente 4", "tournament_format": "pontos_corridos"},
            )
            self.assertEqual(t4_res.status_code, 402)
            self.assertEqual(t4_res.json()["detail"]["code"], "TOURNAMENT_QUOTA_EXCEEDED")

    async def test_03_pro_plan_unlimited_tournaments(self):
        """Valida que o Plano Pro possui cota ilimitada (-1)."""
        # Associa tenant ao Plano Pro no banco
        set_tenant_bypass(True)
        try:
            async with AsyncSession(engine) as session:
                await session.execute(
                    update(Tenant)
                    .where(Tenant.id_tenant == self.tenant_id)
                    .values(plan_id=self.plan_map["pro_all_inclusive"])
                )
                await session.commit()
            TenantService.invalidate_cache(self.tenant_slug, self.tenant_id)
        finally:
            set_tenant_bypass(False)

        transport = httpx.ASGITransport(app=app)
        async with httpx.AsyncClient(transport=transport, base_url="http://testserver") as client:
            quota_res = await client.get("/api/v1/tournaments/quota", headers=self.headers)
            self.assertEqual(quota_res.status_code, 200)
            quota_data = quota_res.json()
            self.assertEqual(quota_data["plan_code"], "pro_all_inclusive")
            self.assertEqual(quota_data["tournaments_limit"], -1)
            self.assertTrue(quota_data["can_create"])

            # Cria 4 torneios sem restrição
            for i in range(1, 5):
                t_res = await client.post(
                    "/api/v1/tournaments/",
                    headers=self.headers,
                    json={"name": f"Torneio Pro {i}", "tournament_format": "individual_points"},
                )
                self.assertEqual(t_res.status_code, 201)
                self.created_season_ids.append(t_res.json()["id_season"])

    async def test_04_custom_tenant_quota_override(self):
        """Valida que custom_max_tournaments no tenant sobrepõe o limite do plano."""
        set_tenant_bypass(True)
        try:
            async with AsyncSession(engine) as session:
                # Define cota personalizada de 5 torneios direto na associação
                await session.execute(
                    update(Tenant)
                    .where(Tenant.id_tenant == self.tenant_id)
                    .values(custom_max_tournaments=5, plan_id=None)
                )
                await session.commit()
            TenantService.invalidate_cache(self.tenant_slug, self.tenant_id)
        finally:
            set_tenant_bypass(False)

        transport = httpx.ASGITransport(app=app)
        async with httpx.AsyncClient(transport=transport, base_url="http://testserver") as client:
            quota_res = await client.get("/api/v1/tournaments/quota", headers=self.headers)
            self.assertEqual(quota_res.status_code, 200)
            quota_data = quota_res.json()
            self.assertEqual(quota_data["tournaments_limit"], 5)
            self.assertTrue(quota_data["can_create"])

    async def test_05_seasons_endpoint_enforces_quota(self):
        """Valida que a rota legada /api/v1/seasons/ também respeita rigorosamente a cota."""
        transport = httpx.ASGITransport(app=app)
        async with httpx.AsyncClient(transport=transport, base_url="http://testserver") as client:
            # 1. Cria 2 temporadas pelo endpoint /seasons/
            for i in range(1, 3):
                s_res = await client.post(
                    "/api/v1/seasons/",
                    headers=self.headers,
                    json={
                        "number": i,
                        "is_active": True,
                        "initial_date": datetime.utcnow().isoformat(),
                    },
                )
                self.assertEqual(s_res.status_code, 201, s_res.text)
                self.created_season_ids.append(s_res.json()["id_season"])

            # 2. Tentativa da 3ª temporada -> Bloqueada com 402
            s3_res = await client.post(
                "/api/v1/seasons/",
                headers=self.headers,
                json={
                    "number": 3,
                    "is_active": True,
                    "initial_date": datetime.utcnow().isoformat(),
                },
            )
            self.assertEqual(s3_res.status_code, 402)
            self.assertEqual(s3_res.json()["detail"]["code"], "TOURNAMENT_QUOTA_EXCEEDED")


if __name__ == "__main__":
    unittest.main()
