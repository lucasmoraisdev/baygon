import time
from typing import Optional, Dict, Any
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.repositories.tenant_repository import TenantRepository
from app.db.models.tenant import Tenant
from app.db.models.plan import Plan
from app.core.services.tournament_quota_service import TournamentQuotaService

# Cache em memória simples com TTL (Time-To-Live de 300 segundos = 5 min)
_TENANT_CACHE: Dict[str, Dict[str, Any]] = {}
CACHE_TTL_SECONDS = 300


class TenantService:
    def __init__(self, repo: TenantRepository):
        self.repo = repo

    async def get_tenant_by_slug(self, slug: str) -> Optional[Tenant]:
        now = time.time()
        cached = _TENANT_CACHE.get(f"slug:{slug}")
        if cached and (now - cached["timestamp"]) < CACHE_TTL_SECONDS:
            return cached["tenant"]

        tenant = await self.repo.get_by_slug(slug)
        if tenant:
            _TENANT_CACHE[f"slug:{slug}"] = {"tenant": tenant, "timestamp": now}
            _TENANT_CACHE[f"id:{tenant.id_tenant}"] = {"tenant": tenant, "timestamp": now}
        return tenant

    async def get_tenant_by_id(self, id_tenant: str) -> Optional[Tenant]:
        now = time.time()
        cached = _TENANT_CACHE.get(f"id:{id_tenant}")
        if cached and (now - cached["timestamp"]) < CACHE_TTL_SECONDS:
            return cached["tenant"]

        tenant = await self.repo.get_by_id(id_tenant)
        if tenant:
            _TENANT_CACHE[f"id:{id_tenant}"] = {"tenant": tenant, "timestamp": now}
            _TENANT_CACHE[f"slug:{tenant.slug}"] = {"tenant": tenant, "timestamp": now}
        return tenant

    async def check_slug_available(self, slug: str) -> bool:
        return await self.repo.check_slug_available(slug)

    async def get_tenant_metadata(self, tenant: Tenant) -> Dict[str, Any]:
        """Gera payload completo para o endpoint /api/v1/tenant/me."""
        active_modules = [
            mod.module_code for mod in tenant.modules if mod.is_active
        ]
        plan_info = None
        if tenant.plan_id:
            plan = await self.repo.get_plan_by_id(tenant.plan_id)
            if plan:
                plan_info = {
                    "id": plan.id_plan,
                    "code": plan.code,
                    "name": plan.name,
                    "max_players": plan.max_players,
                    "max_seasons": plan.max_seasons,
                }

        quota_service = TournamentQuotaService(self.repo.db)
        tournament_quota = await quota_service.get_tenant_quota(tenant.id_tenant)

        return {
            "id": tenant.id_tenant,
            "name": tenant.name,
            "slug": tenant.slug,
            "custom_domain": tenant.custom_domain,
            "logo_url": tenant.logo_url,
            "primary_color": tenant.primary_color,
            "secondary_color": tenant.secondary_color,
            "status": tenant.status,
            "plan": plan_info,
            "modules": active_modules,
            "tournament_quota": tournament_quota,
        }

    @staticmethod
    def invalidate_cache(slug: Optional[str] = None, id_tenant: Optional[str] = None):
        """Invalida cache quando um tenant for atualizado ou assinar novos módulos."""
        if slug and f"slug:{slug}" in _TENANT_CACHE:
            del _TENANT_CACHE[f"slug:{slug}"]
        if id_tenant and f"id:{id_tenant}" in _TENANT_CACHE:
            del _TENANT_CACHE[f"id:{id_tenant}"]
