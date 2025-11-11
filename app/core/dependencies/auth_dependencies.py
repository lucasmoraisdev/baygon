from fastapi import Depends
from fastapi.security import OAuth2PasswordBearer
from app.core.services.auth_service import get_auth_service, AuthService

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
