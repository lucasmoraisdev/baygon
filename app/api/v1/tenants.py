from typing import Any, Dict, Optional, List
from pydantic import BaseModel, Field
from fastapi import APIRouter, Depends, Query, status, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.base import get_db
from app.db.repositories.tenant_repository import TenantRepository
from app.core.services.tenant_service import TenantService
from app.core.services.tenant_provisioning_service import TenantProvisioningService
from app.core.dependencies.tenant import get_current_tenant
from app.core.dependencies.auth_dependencies import user_has_permission
from app.db.models.tenant import Tenant

router = APIRouter(tags=["Tenants"])


class TenantPlanUpgradeRequest(BaseModel):
    plan_code: str = Field(..., description="Código do plano: free, basic ou pro_all_inclusive")
    billing_cycle: str = Field("monthly", description="'monthly' ou 'annual'")
    additional_modules: Optional[List[str]] = Field(default_factory=list)


@router.get("/tenant/me", response_model=Dict[str, Any], status_code=status.HTTP_200_OK)
async def get_my_tenant(
    tenant: Tenant = Depends(get_current_tenant),
    db: AsyncSession = Depends(get_db),
):
    """
    Retorna os metadados da associação ativa na requisição:
    identidade visual, status, plano contratado e módulos ativos.
    """
    repo = TenantRepository(db)
    service = TenantService(repo)
    return await service.get_tenant_metadata(tenant)


@router.post("/tenant/upgrade-plan", response_model=Dict[str, Any], status_code=status.HTTP_200_OK)
async def upgrade_tenant_plan(
    payload: TenantPlanUpgradeRequest,
    current_user=Depends(user_has_permission),
    tenant: Tenant = Depends(get_current_tenant),
    db: AsyncSession = Depends(get_db),
):
    """
    Atualiza o plano da associação ativa com ativação imediata de benefícios e módulos.
    Exclusivo para administradores da associação.
    """
    provisioner = TenantProvisioningService(db)
    try:
        return await provisioner.upgrade_tenant_plan(
            tenant_id=tenant.id_tenant,
            plan_code=payload.plan_code,
            billing_cycle=payload.billing_cycle,
            additional_modules=payload.additional_modules,
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))


@router.get("/tenants/check-slug", response_model=Dict[str, Any], status_code=status.HTTP_200_OK)
async def check_slug_available(
    slug: str = Query(..., min_length=3, max_length=63, pattern=r"^[a-z0-9-]+$"),
    db: AsyncSession = Depends(get_db),
):
    """
    Endpoint público para checagem em tempo real de disponibilidade de subdomínio
    para uso no onboarding e checkout da Landing Page.
    """
    repo = TenantRepository(db)
    service = TenantService(repo)
    is_available = await service.check_slug_available(slug.strip().lower())

    return {
        "slug": slug.strip().lower(),
        "available": is_available,
    }
