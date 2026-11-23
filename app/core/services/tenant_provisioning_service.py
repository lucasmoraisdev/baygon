import re
import uuid
import logging
from datetime import datetime, timedelta
from typing import Dict, Any, List, Optional
from sqlalchemy import select
from sqlalchemy.orm import selectinload
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models.tenant import Tenant
from app.db.models.plan import Plan
from app.db.models.tenant_module import TenantModule
from app.db.models.tenant_audit import TenantAuditLog
from app.db.models.user import User
from app.core.tenant_context import set_tenant_bypass
from app.core.services.tenant_service import TenantService
from app.config.settings import PHRASE_ENCODE, APP_URL
from app.core.utils import encrypt_data

logger = logging.getLogger(__name__)

# Preços base dos planos e módulos em BRL (centavos ou reais)
PLAN_CATALOG = {
    "free": {
        "name": "Plano Gratuito",
        "description": "Experimente até 2 campeonatos completos gratuitos com tabela, súmula, atletas ilimitados e anúncios.",
        "base_price": 0.0,
        "included_modules": ["competitions"],
        "max_players": -1,  # Ilimitado
        "max_seasons": 2,
    },
    "basic": {
        "name": "Plano Esportivo Básico",
        "description": "Ideal para ligas gerenciarem até 3 torneios, atletas ilimitados, livre de AdSense de popup e suporte a patrocinadores próprios.",
        "base_price": 59.90,
        "included_modules": ["competitions"],
        "max_players": -1,  # Ilimitado
        "max_seasons": 3,
    },
    "pro_all_inclusive": {
        "name": "Plano Completo Pro",
        "description": "A experiência definitiva com torneios ilimitados, atletas ilimitados, zero anúncios total (100% clean) e Fantasy Game incluso.",
        "base_price": 149.90,
        "included_modules": ["competitions", "fantasy", "financial", "gamification"],
        "max_players": -1,  # Ilimitado
        "max_seasons": -1,  # Ilimitado
    },
}

ADDON_MODULES_CATALOG = {
    "fantasy": {
        "name": "Fantasy Game Oficial",
        "monthly_price": 49.90,
        "description": "Mercado e escalação dos próprios atletas da liga com pontuações automáticas.",
    },
    "financial": {
        "name": "Gestão Financeira & Mensalidades",
        "monthly_price": 59.90,
        "description": "Controle de caixa, cobrança em lote de sócios e conciliação PIX.",
    },
    "gamification": {
        "name": "Roleta de Prêmios & Gamificação",
        "monthly_price": 29.90,
        "description": "Sorteios interativos de brindes e premiações aos destaques da rodada.",
    },
}


class TenantProvisioningService:
    def __init__(self, db: AsyncSession):
        self.db = db

    @staticmethod
    def sanitize_slug(raw_slug: str) -> str:
        """Sanitiza string para formato seguro de subdomínio DNS (RFC 1123)."""
        slug = raw_slug.lower().strip()
        slug = re.sub(r'[^a-z0-9-]', '-', slug)
        slug = re.sub(r'-+', '-', slug)
        return slug.strip('-')[:63] or f"liga-{uuid.uuid4().hex[:6]}"

    async def resolve_unique_slug(self, base_slug: str) -> str:
        """Garante que o subdomínio é único; caso colida, anexa sufixo incremental."""
        candidate = self.sanitize_slug(base_slug)
        set_tenant_bypass(True)
        try:
            stmt = select(Tenant.id_tenant).where(Tenant.slug == candidate)
            result = await self.db.execute(stmt)
            if result.scalars().first() is None:
                return candidate

            # Colisão detectada: busca sufixo livre
            counter = 1
            while True:
                suffix_candidate = f"{candidate}-{counter}"
                stmt = select(Tenant.id_tenant).where(Tenant.slug == suffix_candidate)
                res = await self.db.execute(stmt)
                if res.scalars().first() is None:
                    return suffix_candidate
                counter += 1
        finally:
            set_tenant_bypass(False)

    async def get_or_create_plan(self, plan_code: str) -> Plan:
        """Busca plano no banco ou cria caso ainda não exista."""
        set_tenant_bypass(True)
        try:
            stmt = select(Plan).where(Plan.code == plan_code)
            plan = (await self.db.execute(stmt)).scalars().first()
            if plan:
                return plan

            plan_def = PLAN_CATALOG.get(plan_code, PLAN_CATALOG["basic"])
            plan = Plan(
                name=plan_def["name"],
                code=plan_code,
                price_monthly_cents=int(round(plan_def["base_price"] * 100)),
                max_players=plan_def["max_players"],
                max_seasons=plan_def["max_seasons"],
                is_active=True,
            )
            self.db.add(plan)
            await self.db.flush()
            return plan
        finally:
            set_tenant_bypass(False)

    async def provision_tenant(self, payload: Dict[str, Any]) -> Dict[str, Any]:
        """
        Orquestra a criação atômica e zero-touch de uma nova associação.
        """
        tenant_name: str = payload.get("tenant_name", "").strip() or "Nova Associação Esportiva"
        raw_slug: str = payload.get("slug", "") or tenant_name
        admin_name: str = payload.get("admin_name", "").strip() or "Presidente da Liga"
        admin_email: str = payload.get("admin_email", "").strip().lower()
        admin_phone: str = payload.get("admin_phone", "").strip() or "00000000000"
        plan_code: str = payload.get("plan_code", "basic")
        requested_modules: List[str] = payload.get("modules", [])
        primary_color: str = payload.get("primary_color", "#059669")
        secondary_color: str = payload.get("secondary_color", "#10b981")

        if not admin_email or "@" not in admin_email:
            raise ValueError("E-mail de administrador válido é obrigatório para provisionamento.")

        # 1. Ativa bypass temporário de contexto para inserção dos dados mestre
        set_tenant_bypass(True)
        try:
            # 2. Resolução do slug e plano
            final_slug = await self.resolve_unique_slug(raw_slug)
            plan = await self.get_or_create_plan(plan_code)

            # 3. Criação do Tenant
            tenant_id = str(uuid.uuid4())
            tenant = Tenant(
                id_tenant=tenant_id,
                name=tenant_name,
                slug=final_slug,
                primary_color=primary_color,
                secondary_color=secondary_color,
                status="active",
                plan_id=plan.id_plan,
            )
            self.db.add(tenant)
            await self.db.flush()

            # 4. Módulos contratados (competitions é sempre core)
            all_modules = set(["competitions"] + requested_modules)
            if plan_code == "pro_all_inclusive":
                all_modules.update(["fantasy", "financial", "gamification"])

            for mod_code in all_modules:
                mod = TenantModule(
                    tenant_id=tenant_id,
                    module_code=mod_code,
                    is_active=True,
                )
                self.db.add(mod)

            # 5. Criação do usuário Presidente/Super Admin do inquilino
            user_key = PHRASE_ENCODE if PHRASE_ENCODE else "default_master_key_12345"
            temp_password = f"Liga@{uuid.uuid4().hex[:6]}"
            setup_token = str(uuid.uuid4())
            exp = datetime.utcnow() + timedelta(days=30)
            username = f"{admin_email.split('@')[0]}_{final_slug[:4]}"

            admin_user = User(
                name=admin_name,
                email=admin_email,
                username=username,
                password=encrypt_data(temp_password, user_key),
                is_admin=True,
                is_active=True,
                phone_number=admin_phone,
                setup_token=setup_token,
                invite_token_expires=exp,
                tenant_id=tenant_id,
            )
            self.db.add(admin_user)

            # 6. Log de auditoria
            audit = TenantAuditLog(
                tenant_id=tenant_id,
                action="tenant_provisioned",
                entity="tenant",
                entity_id=tenant_id,
                details=f"Provisionamento zero-touch concluído pelo admin {admin_email}. Plano: {plan_code}, Módulos: {list(all_modules)}, Slug: {final_slug}",
            )
            self.db.add(audit)

            # 7. Commit atômico
            await self.db.commit()

            # 8. Invalidação de cache para liberação em tempo real
            TenantService.invalidate_cache(slug=final_slug, id_tenant=tenant_id)

            logger.info(f"Tenant provisionado com sucesso: slug={final_slug}, id={tenant_id}")

            return {
                "success": True,
                "tenant_id": tenant_id,
                "name": tenant_name,
                "slug": final_slug,
                "subdomain_url": f"http://{final_slug}.localhost:3000",
                "admin_user": {
                    "name": admin_name,
                    "email": admin_email,
                    "username": username,
                    "temp_password": temp_password,
                    "setup_token": setup_token,
                },
                "plan": plan_code,
                "modules": list(all_modules),
                "created_at": datetime.utcnow().isoformat(),
            }
        finally:
            set_tenant_bypass(False)

    async def upgrade_tenant_plan(
        self,
        tenant_id: str,
        plan_code: str,
        billing_cycle: str = "monthly",
        additional_modules: Optional[List[str]] = None,
    ) -> Dict[str, Any]:
        """
        Realiza o upgrade ou alteração de plano de um tenant existente com ativação imediata de módulos e auditoria.
        """
        set_tenant_bypass(True)
        try:
            stmt_t = select(Tenant).options(selectinload(Tenant.modules)).where(Tenant.id_tenant == tenant_id)
            tenant = (await self.db.execute(stmt_t)).scalar_one_or_none()
            if not tenant:
                raise ValueError("Associação não encontrada.")

            plan = await self.get_or_create_plan(plan_code)
            tenant.plan_id = plan.id_plan

            # Define os módulos garantidos pelo novo plano
            plan_def = PLAN_CATALOG.get(plan_code, PLAN_CATALOG["basic"])
            modules_to_activate = set(plan_def.get("included_modules", ["competitions"]))
            if additional_modules:
                modules_to_activate.update(additional_modules)

            # Ativa os módulos do plano na tabela tenant_modules
            existing_modules = {m.module_code: m for m in tenant.modules}
            for mod_code in modules_to_activate:
                if mod_code in existing_modules:
                    existing_modules[mod_code].is_active = True
                else:
                    new_mod = TenantModule(tenant_id=tenant_id, module_code=mod_code, is_active=True)
                    self.db.add(new_mod)

            audit = TenantAuditLog(
                tenant_id=tenant_id,
                action="plan_upgraded",
                entity="tenant",
                entity_id=tenant_id,
                details=f"Plano atualizado para '{plan_code}' ({plan.name}, ciclo: {billing_cycle}). Módulos: {list(modules_to_activate)}",
            )
            self.db.add(audit)
            await self.db.commit()

            TenantService.invalidate_cache(slug=tenant.slug, id_tenant=tenant_id)
            return {
                "success": True,
                "tenant_id": tenant_id,
                "plan_code": plan.code,
                "plan_name": plan.name,
                "billing_cycle": billing_cycle,
                "modules": list(modules_to_activate),
                "message": f"Plano atualizado com sucesso para {plan.name}!",
            }
        finally:
            set_tenant_bypass(False)

