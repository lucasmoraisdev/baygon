import os
import time
import unittest
import uuid
import httpx
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

os.environ.setdefault("PYTHONUTF8", "1")

from app.db.base import engine
from app.db.models.tenant import Tenant
from app.db.models.tenant_module import TenantModule
from app.db.models.user import User
from app.db.models.season import Seasons
from datetime import datetime
from app.core.tenant_context import set_tenant_bypass, clear_tenant_context
from app.core.jwt_manager import JWTManager
from app.core.services.tenant_service import TenantService
from app.core.services.rate_limit_service import get_rate_limit_service
from app.core.services.tenant_storage_service import TenantStorageService
from app.main import app

BAYGON_TENANT_ID = "00000000-0000-0000-0000-000000000001"


class TestSecurityPenetration(unittest.IsolatedAsyncioTestCase):
    """
    Suíte de Testes de Penetração e Auditoria de Segurança (Red Team).
    Simula deliberadamente tentativas de invasão, IDOR, colisão de tokens,
    acesso indevido a arquivos de storage e ataques Noisy Neighbor (DoS).
    """

    async def asyncSetUp(self):
        clear_tenant_context()
        self.rate_limiter = get_rate_limit_service()

        # Configura dois tenants isolados para simulação de ataque
        self.tenant_a_id = BAYGON_TENANT_ID
        self.tenant_a_slug = "baygon"

        self.tenant_b_id = f"rival-{uuid.uuid4().hex[:8]}"
        self.tenant_b_slug = f"rival-league-{uuid.uuid4().hex[:6]}"

        set_tenant_bypass(True)
        try:
            async with AsyncSession(engine) as session:
                # Garante Tenant B
                tenant_b = Tenant(
                    id_tenant=self.tenant_b_id,
                    name="Rival League Adversária",
                    slug=self.tenant_b_slug,
                    status="active",
                )
                mod_comp = TenantModule(tenant_id=self.tenant_b_id, module_code="competitions", is_active=True)
                session.add_all([tenant_b, mod_comp])

                # Cria usuário para Tenant A
                self.user_a_email = f"user_a_{uuid.uuid4().hex[:6]}@baygon.local"
                user_a = User(
                    name="Atleta Tenant A",
                    email=self.user_a_email,
                    username=f"usera_{uuid.uuid4().hex[:6]}",
                    password="fakehash",
                    phone_number="11999990001",
                    is_admin=True,
                    is_active=True,
                    tenant_id=self.tenant_a_id,
                )

                # Cria usuário para Tenant B
                self.user_b_email = f"user_b_{uuid.uuid4().hex[:6]}@rival.local"
                user_b = User(
                    name="Atleta Invasor Tenant B",
                    email=self.user_b_email,
                    username=f"userb_{uuid.uuid4().hex[:6]}",
                    password="fakehash",
                    phone_number="11999990002",
                    is_admin=True,
                    is_active=True,
                    tenant_id=self.tenant_b_id,
                )

                session.add_all([user_a, user_b])
                await session.flush()
                self.user_a_id = user_a.id_user
                self.user_b_id = user_b.id_user

                # Cria uma temporada exclusiva do Tenant A
                self.season_a = Seasons(
                    number=999,
                    initial_date=datetime.now(),
                    is_active=True,
                    tenant_id=self.tenant_a_id,
                )
                session.add(self.season_a)
                await session.commit()
                await session.refresh(self.season_a)
                self.season_a_id = self.season_a.id_season

        finally:
            set_tenant_bypass(False)

        # Gera tokens JWT válidos vinculados a cada usuário/tenant
        self.token_user_a = JWTManager.create_access_token({
            "sub": self.user_a_email,
            "user_id": self.user_a_id,
            "tenant_id": self.tenant_a_id,
        })
        self.token_user_b = JWTManager.create_access_token({
            "sub": self.user_b_email,
            "user_id": self.user_b_id,
            "tenant_id": self.tenant_b_id,
        })

    async def asyncTearDown(self):
        clear_tenant_context()
        self.rate_limiter.reset_for_tenant(self.tenant_a_id)
        self.rate_limiter.reset_for_tenant(self.tenant_b_id)

        # Limpeza do banco
        set_tenant_bypass(True)
        try:
            async with AsyncSession(engine) as session:
                # Remove temporada de teste
                stmt_season = select(Seasons).where(Seasons.id_season == self.season_a_id)
                s = (await session.execute(stmt_season)).scalar_one_or_none()
                if s:
                    await session.delete(s)

                # Remove usuários
                stmt_ua = select(User).where(User.id_user == self.user_a_id)
                ua = (await session.execute(stmt_ua)).scalar_one_or_none()
                if ua:
                    await session.delete(ua)

                stmt_ub = select(User).where(User.id_user == self.user_b_id)
                ub = (await session.execute(stmt_ub)).scalar_one_or_none()
                if ub:
                    await session.delete(ub)

                # Remove Tenant B
                stmt_tb = select(Tenant).where(Tenant.id_tenant == self.tenant_b_id)
                tb = (await session.execute(stmt_tb)).scalar_one_or_none()
                if tb:
                    await session.delete(tb)

                await session.commit()
        finally:
            set_tenant_bypass(False)
            TenantService.invalidate_cache(slug=self.tenant_b_slug, id_tenant=self.tenant_b_id)
            await engine.dispose()

    async def test_red_team_01_cross_tenant_jwt_token_mismatch(self):
        """
        VETOR 1: Troca de Token JWT (Tenant Token Mismatch).
        O invasor pega um token válido do Tenant A e tenta operá-lo
        contra o subdomínio do Tenant B ('rival-league').
        Esperado: HTTP 403 Forbidden (tenant_mismatch).
        """
        transport = httpx.ASGITransport(app=app)
        async with httpx.AsyncClient(transport=transport, base_url="http://testserver") as client:
            headers_attack = {
                "x-tenant-slug": self.tenant_b_slug,
                "Authorization": f"Bearer {self.token_user_a}",  # Token do Tenant A no subdomínio B!
            }
            # Tenta listar usuários ou chamar rota autenticada
            response = await client.get("/api/v1/users/", headers=headers_attack)
            self.assertEqual(
                response.status_code, 
                403, 
                "Token do Tenant A apresentado no Tenant B DEVE ser sumariamente rejeitado com 403."
            )
            detail = response.json().get("detail", {})
            self.assertEqual(detail.get("error"), "tenant_mismatch")

    async def test_red_team_02_path_idor_cross_tenant_isolation(self):
        """
        VETOR 2: Insecure Direct Object Reference (IDOR).
        O invasor, autenticado legitimamente no Tenant B, tenta ler
        ou manipular o recurso do Tenant A sabendo o seu ID numérico.
        Esperado: HTTP 404 Not Found (recurso inexistente no universo do Tenant B).
        """
        transport = httpx.ASGITransport(app=app)
        async with httpx.AsyncClient(transport=transport, base_url="http://testserver") as client:
            # 1. Tenant A acessa legitimamente sua temporada -> HTTP 200
            headers_tenant_a = {
                "x-tenant-slug": self.tenant_a_slug,
                "Authorization": f"Bearer {self.token_user_a}",
            }
            res_legit = await client.get(f"/api/v1/seasons/{self.season_a_id}", headers=headers_tenant_a)
            self.assertEqual(res_legit.status_code, 200)
            self.assertEqual(res_legit.json()["id_season"], self.season_a_id)

            # 2. Invasor do Tenant B tenta acessar a temporada do Tenant A -> DEVE RETORNAR 404
            headers_tenant_b = {
                "x-tenant-slug": self.tenant_b_slug,
                "Authorization": f"Bearer {self.token_user_b}",
            }
            res_attack = await client.get(f"/api/v1/seasons/{self.season_a_id}", headers=headers_tenant_b)
            self.assertEqual(
                res_attack.status_code, 
                404, 
                "Tentativa de IDOR trans-tenant deve falhar com 404 devido ao interceptor de ORM."
            )

    async def test_red_team_03_storage_presigned_url_tampering_and_isolation(self):
        """
        VETOR 3: Vazamento e Violação de Storage / Presigned URLs.
        Valida que links de storage são particionados por tenant e protegidos
        contra acesso cruzado, assinaturas adulteradas e expiração.
        """
        transport = httpx.ASGITransport(app=app)
        async with httpx.AsyncClient(transport=transport, base_url="http://testserver") as client:
            headers_tenant_a = {
                "x-tenant-slug": self.tenant_a_slug,
                "Authorization": f"Bearer {self.token_user_a}",
            }
            headers_tenant_b = {
                "x-tenant-slug": self.tenant_b_slug,
                "Authorization": f"Bearer {self.token_user_b}",
            }

            # 1. Tenant A gera URL pré-assinada para seu comprovante
            presign_payload = {
                "category": "receipts",
                "filename": "comprovante_sigiloso_123.pdf",
                "ttl_seconds": 900,
            }
            presign_res = await client.post("/api/v1/storage/presign", json=presign_payload, headers=headers_tenant_a)
            self.assertEqual(presign_res.status_code, 201)
            presign_data = presign_res.json()
            url_a = presign_data["presigned_url"]
            file_path_a = presign_data["file_path"]

            # 2. Acesso legítimo do Tenant A -> HTTP 200
            res_legit = await client.get(url_a, headers=headers_tenant_a)
            self.assertEqual(res_legit.status_code, 200)
            self.assertEqual(res_legit.json()["status"], "authorized")

            # 3. Ataque 1: Invasor do Tenant B tenta acessar a mesma URL do Tenant A -> HTTP 403
            res_cross = await client.get(url_a, headers=headers_tenant_b)
            self.assertEqual(
                res_cross.status_code, 
                403, 
                "Tenant B não pode acessar URL de arquivo do Tenant A, mesmo com URL assinada pelo Tenant A."
            )

            # 4. Ataque 2: URL com assinatura adulterada -> HTTP 403
            tampered_url = url_a.replace("signature=", "signature=adulterada_")
            res_tampered = await client.get(tampered_url, headers=headers_tenant_a)
            self.assertEqual(res_tampered.status_code, 403)

            # 5. Ataque 3: URL expirada -> HTTP 401
            expired_url = TenantStorageService.create_presigned_url(
                tenant_id=self.tenant_a_id,
                file_path=file_path_a,
                ttl_seconds=-10,  # Expirada há 10 segundos
            )
            res_expired = await client.get(expired_url, headers=headers_tenant_a)
            self.assertEqual(res_expired.status_code, 401)

    async def test_red_team_04_noisy_neighbor_dos_rate_limiting(self):
        """
        VETOR 4: Ataque DoS por Tenant (Noisy Neighbor).
        Simula uma associação que dispara rajadas excessivas de requisições.
        O Rate Limiter estrangula exclusivamente o Tenant abusivo (HTTP 429),
        enquanto os outros tenants continuam respondendo perfeitamente (HTTP 200).
        """
        transport = httpx.ASGITransport(app=app)
        async with httpx.AsyncClient(transport=transport, base_url="http://testserver") as client:
            headers_tenant_a = {"x-tenant-slug": self.tenant_a_slug}
            headers_tenant_b = {"x-tenant-slug": self.tenant_b_slug}

            # Configura um limite reduzido temporário para testar o estrangulamento de rajada
            # Simula que Tenant A já consumiu todo seu limite
            cache_key_minute = int(time.time()) // 60
            self.rate_limiter.check_rate_limit(
                tenant_id=self.tenant_a_id,
                cost=120,  # consome 120 reqs de uma vez
            )

            # Próxima requisição do Tenant A DEVE ser bloqueada com 429 Too Many Requests
            res_throttled = await client.get("/api/v1/tenant/me", headers=headers_tenant_a)
            self.assertEqual(
                res_throttled.status_code, 
                429, 
                "Tenant que ultrapassou o rate limit deve receber 429 Too Many Requests."
            )
            self.assertIn("X-RateLimit-Limit", res_throttled.headers)
            self.assertIn("Retry-After", res_throttled.headers)

            # NO MESMO MOMENTO: Tenant B faz requisição normal -> DEVE RETORNAR 200 OK!
            res_tenant_b = await client.get("/api/v1/tenant/me", headers=headers_tenant_b)
            self.assertEqual(
                res_tenant_b.status_code, 
                200, 
                "Tenant B NÃO deve ser afetado pelo bloqueio do Tenant A (Proteção Noisy Neighbor comprovada)."
            )
