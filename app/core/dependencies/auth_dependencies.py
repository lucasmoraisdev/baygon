from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from app.core.services.auth_service import get_auth_service, AuthService
from app.core.services.user_service import UserService, get_user_service

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/login")

async def get_current_user(
    token: str = Depends(oauth2_scheme),
    auth_service: AuthService = Depends(get_auth_service)
):
    """
    Dependência global para recuperar o usuário autenticado
    a partir do token JWT.
    """
    return await auth_service.get_current_user(token)

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