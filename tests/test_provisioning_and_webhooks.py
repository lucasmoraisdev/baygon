import os
import hmac
import hashlib
import json
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
from app.db.models.webhook_event import WebhookEvent
from app.api.v1.checkout import WEBHOOK_SECRET
from app.core.tenant_context import set_tenant_bypass, clear_tenant_context
from app.core.services.tenant_service import TenantService
from app.main import app


class TestProvisioningAndWebhooks(unittest.IsolatedAsyncioTestCase):
    async def asyncSetUp(self):
        clear_tenant_context()

    async def asyncTearDown(self):
        clear_tenant_context()
        await engine.dispose()

    async def test_checkout_plans_and_pricing_calculation(self):
        """Valida a consulta do catálogo e o cálculo modular de mensalidade no checkout."""
        transport = httpx.ASGITransport(app=app)
        async with httpx.AsyncClient(transport=transport, base_url="http://testserver") as client:
            # 1. Catálogo de Planos
            plans_resp = await client.get("/api/v1/checkout/plans")
            self.assertEqual(plans_resp.status_code, 200)
            catalog = plans_resp.json()
            self.assertIn("basic", catalog["plans"])
            self.assertIn("pro_all_inclusive", catalog["plans"])
            self.assertIn("fantasy", catalog["addons"])

            # 2. Sessão com Plano Básico + Addon Fantasy (59.90 + 49.90 = 109.80)
            payload_basic = {
                "tenant_name": "Liga Teste Básico",
                "slug": "liga-teste-basico",
                "admin_name": "Gestor Básico",
                "admin_email": "gestor@basico.local",
                "plan_code": "basic",
                "modules": ["fantasy"],
                "payment_method": "pix",
            }
            res_session = await client.post("/api/v1/checkout/session", json=payload_basic)
            self.assertEqual(res_session.status_code, 201)
            data_basic = res_session.json()
            self.assertEqual(data_basic["monthly_total"], 109.80)
            self.assertIn("qr_code_pix", data_basic)

            # 3. Sessão com Plano Pro All Inclusive (149.90 fixo com tudo incluído)
            payload_pro = {
                "tenant_name": "Liga Teste Pro",
                "slug": "liga-teste-pro",
                "admin_name": "Gestor Pro",
                "admin_email": "gestor@pro.local",
                "plan_code": "pro_all_inclusive",
                "modules": ["fantasy", "financial"],
                "payment_method": "credit_card",
            }
            res_pro = await client.post("/api/v1/checkout/session", json=payload_pro)
            self.assertEqual(res_pro.status_code, 201)
            self.assertEqual(res_pro.json()["monthly_total"], 149.90)

    async def test_webhook_hmac_signature_validation(self):
        """Valida que o webhook de pagamento rejeita payloads sem assinatura ou com hash adulterado."""
        transport = httpx.ASGITransport(app=app)
        async with httpx.AsyncClient(transport=transport, base_url="http://testserver") as client:
            payload = {
                "event_id": f"evt_{uuid.uuid4().hex[:12]}",
                "event_type": "subscription.activated",
                "gateway": "stripe",
                "tenant_data": {
                    "tenant_name": "Liga Sem Assinatura",
                    "admin_name": "Admin Inválido",
                    "admin_email": "fake@invalido.local",
                },
            }
            raw_json = json.dumps(payload).encode("utf-8")

            # Sem header x-signature -> 401
            res_no_sig = await client.post(
                "/api/v1/webhooks/payment",
                content=raw_json,
                headers={"Content-Type": "application/json"},
            )
            self.assertEqual(res_no_sig.status_code, 401)

            # Com header x-signature falso -> 401
            res_bad_sig = await client.post(
                "/api/v1/webhooks/payment",
                content=raw_json,
                headers={"Content-Type": "application/json", "x-signature": "hash_falso_123456"},
            )
            self.assertEqual(res_bad_sig.status_code, 401)

    async def test_zero_touch_provisioning_and_idempotency(self):
        """
        Valida o fluxo completo de provisionamento zero-touch:
        1. Recepção do webhook com assinatura válida;
        2. Criação atômica do Tenant, Módulos, Usuário Admin;
        3. Idempotência estrita: reenvio do mesmo evento não duplica registros.
        """
        test_slug = f"autoliga-{uuid.uuid4().hex[:6]}"
        test_event_id = f"evt_stripe_{uuid.uuid4().hex[:12]}"
        admin_email = f"pres_{uuid.uuid4().hex[:6]}@autoliga.local"

        payload = {
            "event_id": test_event_id,
            "event_type": "subscription.activated",
            "gateway": "stripe",
            "tenant_data": {
                "tenant_name": "Liga Auto Provisionada",
                "slug": test_slug,
                "admin_name": "Presidente Automático",
                "admin_email": admin_email,
                "plan_code": "basic",
                "modules": ["fantasy"],
                "primary_color": "#10b981",
                "secondary_color": "#059669",
            },
        }
        raw_json = json.dumps(payload).encode("utf-8")
        valid_signature = hmac.new(WEBHOOK_SECRET.encode("utf-8"), raw_json, hashlib.sha256).hexdigest()

        provisioned_tenant_id = None

        try:
            transport = httpx.ASGITransport(app=app)
            async with httpx.AsyncClient(transport=transport, base_url="http://testserver") as client:
                # 1. Primeiro envio do Webhook -> DEVE PROVISIONAR COM SUCESSO (200 OK)
                res_first = await client.post(
                    "/api/v1/webhooks/payment",
                    content=raw_json,
                    headers={"Content-Type": "application/json", "x-signature": valid_signature},
                )
                self.assertEqual(res_first.status_code, 200, res_first.text)
                first_body = res_first.json()
                self.assertEqual(first_body["status"], "success")
                provisioned_tenant_id = first_body["data"]["tenant_id"]
                self.assertEqual(first_body["data"]["slug"], test_slug)
                self.assertIn("fantasy", first_body["data"]["modules"])
                self.assertIn("competitions", first_body["data"]["modules"])

                # 2. Segundo envio do MESMO evento -> DEVE RESPONDER IDEMPOTENTE (200 OK)
                res_second = await client.post(
                    "/api/v1/webhooks/payment",
                    content=raw_json,
                    headers={"Content-Type": "application/json", "x-signature": valid_signature},
                )
                self.assertEqual(res_second.status_code, 200)
                second_body = res_second.json()
                self.assertEqual(second_body["status"], "already_processed")

            # 3. Verificação de integridade no banco de dados
            set_tenant_bypass(True)
            async with AsyncSession(engine) as session:
                # Verifica Tenant
                t = await session.get(Tenant, provisioned_tenant_id)
                self.assertIsNotNone(t)
                self.assertEqual(t.status, "active")

                # Verifica Módulos
                mods = (await session.execute(
                    select(TenantModule).where(TenantModule.tenant_id == provisioned_tenant_id)
                )).scalars().all()
                mod_codes = [m.module_code for m in mods]
                self.assertIn("competitions", mod_codes)
                self.assertIn("fantasy", mod_codes)
                self.assertNotIn("financial", mod_codes)  # Não foi contratado

                # Verifica Usuário Admin
                user = (await session.execute(
                    select(User).where(User.tenant_id == provisioned_tenant_id)
                )).scalars().first()
                self.assertIsNotNone(user)
                self.assertTrue(user.is_admin)
                self.assertEqual(user.email, admin_email)

                # Verifica Tabela de Idempotência
                evt = (await session.execute(
                    select(WebhookEvent).where(WebhookEvent.event_id == test_event_id)
                )).scalars().first()
                self.assertIsNotNone(evt)
                self.assertEqual(evt.status, "processed")

            set_tenant_bypass(False)

        finally:
            # Limpeza do ambiente de teste
            TenantService.invalidate_cache(slug=test_slug, id_tenant=provisioned_tenant_id)
            set_tenant_bypass(True)
            if provisioned_tenant_id:
                async with AsyncSession(engine) as del_session:
                    t_del = await del_session.get(Tenant, provisioned_tenant_id)
                    if t_del:
                        await del_session.delete(t_del)
                    evt_del = (await del_session.execute(
                        select(WebhookEvent).where(WebhookEvent.event_id == test_event_id)
                    )).scalars().first()
                    if evt_del:
                        await del_session.delete(evt_del)
                    await del_session.commit()
            set_tenant_bypass(False)


if __name__ == "__main__":
    unittest.main()
