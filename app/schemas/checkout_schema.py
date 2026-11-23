from typing import List, Optional, Dict, Any
from pydantic import BaseModel, Field, EmailStr


class CheckoutSessionCreate(BaseModel):
    tenant_name: str = Field(..., min_length=2, max_length=150, description="Nome da associação/liga")
    slug: Optional[str] = Field(None, min_length=3, max_length=63, description="Subdomínio desejado (opcional)")
    admin_name: str = Field(..., min_length=2, max_length=150, description="Nome do presidente/responsável")
    admin_email: str = Field(..., min_length=5, max_length=150, pattern=r"^[^@\s]+@[^@\s]+\.[^@\s]+$", description="E-mail principal do administrador")
    admin_phone: Optional[str] = Field(None, description="Telefone/WhatsApp para contato")
    plan_code: str = Field("basic", description="Código do plano: basic ou pro_all_inclusive")
    modules: List[str] = Field(default_factory=list, description="Módulos adicionais: fantasy, financial, gamification")
    payment_method: str = Field("pix", description="Método de pagamento: pix ou credit_card")


class CheckoutSessionResponse(BaseModel):
    session_id: str
    monthly_total: float
    breakdown: Dict[str, Any]
    checkout_url: str
    qr_code_pix: Optional[str] = None
    expires_at: str


class WebhookPaymentPayload(BaseModel):
    event_id: str = Field(..., description="Identificador único do evento no gateway")
    event_type: str = Field(..., description="Tipo do evento (ex: subscription.activated, payment.succeeded)")
    gateway: str = Field("stripe", description="Gateway de origem (stripe, asaas, mercadopago, mock)")
    tenant_data: Dict[str, Any] = Field(..., description="Metadados da associação a ser provisionada")
