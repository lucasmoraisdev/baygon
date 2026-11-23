from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from app.core.services.auth_service import get_auth_service, AuthService
from app.core.services.user_service import UserService, get_user_service

from app.core.tenant_context import get_current_tenant_id

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/login")

async def get_current_user(
    token: str = Depends(oauth2_scheme),
    auth_service: AuthService = Depends(get_auth_service)
):
    """
    Dependência global para recuperar o usuário autenticado
    a partir do token JWT e validar a amarra com o tenant ativo.
    """
    print(f"Token recebido para autenticação: {token}")
    user = await auth_service.get_current_user(token)

    # Validação de Tenant Binding (Zero Cross-Tenant Access)
    current_tenant = get_current_tenant_id()
    if current_tenant and getattr(user, "tenant_id", None):
        if user.tenant_id != current_tenant:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail={
                    "error": "tenant_mismatch",
                    "message": "Este usuário não possui autorização para operar nesta associação.",
                }
            )

    return user

async def user_has_permission(
    current_user=Depends(get_current_user),
):
    """
    Dependência global para validar se o usuário autenticado é administrador.
    """
    if not current_user.is_admin:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Permissão negada. Apenas administradores podem executar esta ação."
        )
    return current_user