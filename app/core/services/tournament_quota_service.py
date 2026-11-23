from typing import Dict, Any, Optional
from fastapi import HTTPException, status
from sqlalchemy import select, func
from sqlalchemy.orm import selectinload
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models.tenant import Tenant
from app.db.models.plan import Plan
from app.db.models.season import Seasons


class TournamentQuotaService:
    """
    Serviço de Gestão e Verificação de Cotas de Torneios por Tenant e Plano.
    
    Regras de Negócio:
    - Tipos de torneios: LIVRES (qualquer formato: pontos corridos, mata-mata, grupos ou pelada).
    - Cota: Baseada 100% no banco de dados (tabela plans e tenants.custom_max_tournaments).
    - Contagem: Cumulativa no histórico (cada temporada/campeonato criado consome cota).
    - Limite -1: Ilimitado (ex: Plano Pro).
    - Limite atingido: HTTP 402 Payment Required com detalhamento e convite ao upgrade.
    """

    def __init__(self, db: AsyncSession):
        self.db = db

    async def get_tenant_quota(self, tenant_id: Optional[str]) -> Dict[str, Any]:
        """
        Calcula a cota de torneios atual do tenant informado consultando o banco.
        """
        if not tenant_id:
            # Contexto sem tenant (bypass / superadmin / sistema)
            return {
                "plan_code": "system",
                "plan_name": "Sistema / Bypass",
                "tournaments_created": 0,
                "tournaments_limit": -1,
                "tournaments_remaining": -1,
                "can_create": True,
                "upgrade_required": False,
            }

        # 1. Busca o tenant e seu plano associado
        stmt_t = select(Tenant).options(selectinload(Tenant.plan)).where(Tenant.id_tenant == tenant_id)
        tenant = (await self.db.execute(stmt_t)).scalar_one_or_none()

        plan: Optional[Plan] = tenant.plan if (tenant and tenant.plan) else None

        # 2. Se o tenant não possui plano ativo vinculado, busca o plano 'free' no banco
        if not plan:
            stmt_free = select(Plan).where(Plan.code == "free", Plan.is_active.is_(True))
            plan = (await self.db.execute(stmt_free)).scalars().first()

        # 3. Determina o limite configurado (prioridade: cota personalizada no tenant > plano do banco > default 2)
        if tenant and tenant.custom_max_tournaments is not None:
            limit = tenant.custom_max_tournaments
        elif plan:
            limit = plan.max_seasons
        else:
            limit = 2

        # 4. Conta quantos torneios cumulativos o tenant já criou no banco
        stmt_count = select(func.count(Seasons.id_season)).where(Seasons.tenant_id == tenant_id)
        created_count = (await self.db.execute(stmt_count)).scalar() or 0

        # 5. Avalia disponibilidade
        is_unlimited = (limit == -1 or limit >= 999999)
        if is_unlimited:
            can_create = True
            remaining = -1
        else:
            can_create = (created_count < limit)
            remaining = max(0, limit - created_count)

        plan_code = plan.code if plan else "free"
        plan_name = plan.name if plan else "Plano Gratuito"

        return {
            "plan_code": plan_code,
            "plan_name": plan_name,
            "tournaments_created": created_count,
            "tournaments_limit": limit,
            "tournaments_remaining": remaining,
            "can_create": can_create,
            "upgrade_required": not can_create,
        }

    async def assert_can_create_tournament(self, tenant_id: Optional[str]) -> Dict[str, Any]:
        """
        Valida se o tenant pode criar um novo torneio.
        Lança HTTPException 402 com payload estruturado caso a cota tenha sido atingida.
        """
        quota = await self.get_tenant_quota(tenant_id)
        if not quota["can_create"]:
            raise HTTPException(
                status_code=status.HTTP_402_PAYMENT_REQUIRED,
                detail={
                    "code": "TOURNAMENT_QUOTA_EXCEEDED",
                    "message": (
                        f"Você atingiu o limite de {quota['tournaments_limit']} torneio(s) "
                        f"do seu plano atual ({quota['plan_name']}). Faça upgrade para continuar criando novos campeonatos."
                    ),
                    "quota": quota,
                    "upgrade_url": "/checkout",
                },
            )
        return quota
