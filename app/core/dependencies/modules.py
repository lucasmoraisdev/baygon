from fastapi import Depends, HTTPException, status
from app.core.dependencies.tenant import get_current_tenant
from app.db.models.tenant import Tenant


def require_module(module_code: str):
    """
    Guard declarativo para endpoints FastAPI.
    Valida se o tenant ativo na requisição contratou o módulo solicitado.
    Se não contratou, aborta com 403 Forbidden e código estruturado 'feature_not_subscribed'.
    """
    async def dependency(tenant: Tenant = Depends(get_current_tenant)) -> bool:
        if not tenant.has_module(module_code):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail={
                    "error": "feature_not_subscribed",
                    "module": module_code,
                    "message": f"O módulo '{module_code}' não está ativo no plano contratado da sua associação."
                }
            )
        return True

    return dependency
