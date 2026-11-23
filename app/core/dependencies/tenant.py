from typing import Optional
from fastapi import HTTPException, status
from app.core.tenant_context import get_current_tenant as _get_context_tenant
from app.db.models.tenant import Tenant


async def get_current_tenant() -> Tenant:
    """
    Retorna a instância do Tenant ativo no contexto da requisição atual.
    Lança HTTPException 400 se nenhum tenant foi resolvido pelo middleware.
    """
    tenant = _get_context_tenant()
    if not tenant:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={
                "error": "tenant_not_resolved",
                "message": "Nenhum tenant foi resolvido para esta requisição."
            }
        )
    return tenant


async def get_current_tenant_or_none() -> Optional[Tenant]:
    """Retorna o tenant ativo ou None (útil em rotas com contexto opcional)."""
    return _get_context_tenant()
