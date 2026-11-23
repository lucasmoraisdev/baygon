from typing import Optional, List
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.db.models.tenant import Tenant
from app.db.models.tenant_module import TenantModule
from app.db.models.plan import Plan
from app.core.tenant_context import set_tenant_bypass


class TenantRepository:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def get_by_slug(self, slug: str) -> Optional[Tenant]:
        """Busca tenant pelo slug com bypass temporário para permitir a resolução inicial."""
        set_tenant_bypass(True)
        try:
            stmt = (
                select(Tenant)
                .options(selectinload(Tenant.modules))
                .where(Tenant.slug == slug)
            )
            result = await self.db.execute(stmt)
            return result.scalars().first()
        finally:
            set_tenant_bypass(False)

    async def get_by_id(self, id_tenant: str) -> Optional[Tenant]:
        set_tenant_bypass(True)
        try:
            stmt = (
                select(Tenant)
                .options(selectinload(Tenant.modules))
                .where(Tenant.id_tenant == id_tenant)
            )
            result = await self.db.execute(stmt)
            return result.scalars().first()
        finally:
            set_tenant_bypass(False)

    async def get_by_custom_domain(self, domain: str) -> Optional[Tenant]:
        set_tenant_bypass(True)
        try:
            stmt = (
                select(Tenant)
                .options(selectinload(Tenant.modules))
                .where(Tenant.custom_domain == domain)
            )
            result = await self.db.execute(stmt)
            return result.scalars().first()
        finally:
            set_tenant_bypass(False)

    async def check_slug_available(self, slug: str) -> bool:
        set_tenant_bypass(True)
        try:
            stmt = select(Tenant.id_tenant).where(Tenant.slug == slug)
            result = await self.db.execute(stmt)
            return result.scalars().first() is None
        finally:
            set_tenant_bypass(False)

    async def get_plan_by_id(self, plan_id: int) -> Optional[Plan]:
        set_tenant_bypass(True)
        try:
            stmt = select(Plan).where(Plan.id_plan == plan_id)
            result = await self.db.execute(stmt)
            return result.scalars().first()
        finally:
            set_tenant_bypass(False)
