import os
import hmac
import hashlib
import json
import uuid
from datetime import datetime, timedelta
from typing import Dict, Any, List
from fastapi import APIRouter, Depends, HTTPException, Header, Request, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.base import get_db
from app.db.repositories.webhook_repository import WebhookRepository
from app.core.services.tenant_provisioning_service import (
    TenantProvisioningService,
    PLAN_CATALOG,
    ADDON_MODULES_CATALOG,
)
from app.schemas.checkout_schema import (
    CheckoutSessionCreate,
    CheckoutSessionResponse,
    WebhookPaymentPayload,
)

router = APIRouter(prefix="", tags=["Checkout & Faturamento"])

WEBHOOK_SECRET = os.getenv("WEBHOOK_SECRET_KEY", "baygon_super_secret_webhook_key_2026")


def verify_hmac_signature(raw_body: bytes, signature: str) -> bool:
    """Verifica assinatura HMAC-SHA256 do payload do webhook."""
    if not signature:
        return False
    expected = hmac.new(WEBHOOK_SECRET.encode("utf-8"), raw_body, hashlib.sha256).hexdigest()
    # Suporta formato puro ou prefixado (ex: sha256=hash)
    cleaned_sig = signature.replace("sha256=", "").strip()
    return hmac.compare_digest(expected, cleaned_sig)


# ---------------- 1. CATALOGO DE PLANOS E MODULOS ----------------

@router.get("/checkout/plans", response_model=Dict[str, Any], status_code=status.HTTP_200_OK)
async def get_plans_and_addons():
    """
    Retorna o catálogo de planos base e módulos adicionais com precificação para a Landing Page.
    """
    return {
        "plans": PLAN_CATALOG,
        "addons": ADDON_MODULES_CATALOG,
    }


# ---------------- 2. CRIACAO DE SESSAO DE CHECKOUT ----------------

@router.post("/checkout/session", response_model=CheckoutSessionResponse, status_code=status.HTTP_201_CREATED)
async def create_checkout_session(
    data: CheckoutSessionCreate,
    db: AsyncSession = Depends(get_db),
):
    """
    Gera uma sessão de checkout com cálculo do valor mensal baseado no plano e módulos adicionais selecionados.
    """
    plan_info = PLAN_CATALOG.get(data.plan_code)
    if not plan_info:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Plano '{data.plan_code}' inválido. Planos disponíveis: {list(PLAN_CATALOG.keys())}",
        )

    # Cálculo da mensalidade
    base_price = plan_info["base_price"]
    addons_total = 0.0
    addons_breakdown: List[Dict[str, Any]] = []

    # Se for o plano Pro, os módulos já estão todos inclusos
    effective_modules = list(data.modules)
    if data.plan_code == "pro_all_inclusive":
        effective_modules = ["competitions", "fantasy", "financial", "gamification"]
    else:
        for mod in data.modules:
            if mod in ADDON_MODULES_CATALOG:
                mod_price = ADDON_MODULES_CATALOG[mod]["monthly_price"]
                addons_total += mod_price
                addons_breakdown.append({
                    "code": mod,
                    "name": ADDON_MODULES_CATALOG[mod]["name"],
                    "price": mod_price,
                })

    monthly_total = round(base_price + addons_total, 2)
    session_id = f"cs_{uuid.uuid4().hex[:16]}"
    expires_at = (datetime.utcnow() + timedelta(hours=2)).isoformat()

    return CheckoutSessionResponse(
        session_id=session_id,
        monthly_total=monthly_total,
        breakdown={
            "plan_code": data.plan_code,
            "plan_name": plan_info["name"],
            "base_price": base_price,
            "addons": addons_breakdown,
            "total_monthly": monthly_total,
            "payment_method": data.payment_method,
            "tenant_name": data.tenant_name,
            "requested_slug": data.slug or TenantProvisioningService.sanitize_slug(data.tenant_name),
            "admin_email": data.admin_email,
        },
        checkout_url=f"https://checkout.associacao.com/pay/{session_id}",
        qr_code_pix=f"00020126580014BR.GOV.BCB.PIX0136{uuid.uuid4()}520400005303986540{int(monthly_total)}5802BR5913BAYGON SAAS6008SALVADOR62070503***6304ABCD" if data.payment_method == "pix" else None,
        expires_at=expires_at,
    )


# ---------------- 3. RECEPTOR DE WEBHOOK COM IDEMPOTÊNCIA E HMAC ----------------

@router.post("/webhooks/payment", status_code=status.HTTP_200_OK)
async def handle_payment_webhook(
    request: Request,
    x_signature: str = Header(None, alias="x-signature"),
    db: AsyncSession = Depends(get_db),
):
    """
    Recebe eventos de pagamento/assinatura do gateway com validação HMAC e idempotência.
    Provisiona o subdomínio e a nova associação automaticamente.
    """
    raw_body = await request.body()

    # 1. Validação de Assinatura Criptográfica
    # Em ambiente de desenvolvimento/teste, aceita se for test_secret ou HMAC válido
    if not verify_hmac_signature(raw_body, x_signature or ""):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Assinatura HMAC do webhook inválida ou ausente.",
        )

    try:
        payload_dict = json.loads(raw_body.decode("utf-8"))
        payload = WebhookPaymentPayload(**payload_dict)
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Payload do webhook inválido: {str(e)}",
        )

    webhook_repo = WebhookRepository(db)

    # 2. Verificação de Idempotência (Não processa o mesmo event_id duas vezes)
    existing_event = await webhook_repo.get_by_event_id(payload.event_id)
    if existing_event:
        return {
            "status": "already_processed",
            "message": f"Evento {payload.event_id} já foi processado anteriormente.",
            "event_id": payload.event_id,
        }

    # 3. Registrar evento recebido
    await webhook_repo.create_event(
        event_id=payload.event_id,
        gateway=payload.gateway,
        event_type=payload.event_type,
        status="processing",
        payload=raw_body.decode("utf-8"),
    )

    # 4. Acionar Orquestrador de Provisionamento Zero-Touch
    provisioner = TenantProvisioningService(db)
    try:
        result = await provisioner.provision_tenant(payload.tenant_data)
        await webhook_repo.update_status(payload.event_id, "processed")
        return {
            "status": "success",
            "message": "Associação provisionada com sucesso.",
            "data": result,
        }
    except Exception as e:
        await webhook_repo.update_status(payload.event_id, "failed", error_message=str(e))
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Falha durante o provisionamento da associação: {str(e)}",
        )
