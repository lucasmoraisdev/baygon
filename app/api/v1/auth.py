from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordRequestForm
from streamlit import form
from app.core.dependencies.auth_dependencies import get_current_user
from app.core.jwt_manager import JWTManager
from app.core.services import user_service as UserService
from app.db.repositories.user_repository import UserRepository
from sqlalchemy.ext.asyncio import AsyncSession
from app.db.base import get_db
from app.core.services.auth_service import AuthService, get_auth_service
from pydantic import BaseModel

router = APIRouter(tags=["Authentication"])

class LoginRequest(BaseModel):
    username: str
    password: str

@router.post("/login")
async def login(data: LoginRequest, db: AsyncSession = Depends(get_db)):
    """
    Endpoint para autenticação do usuário e retorno de JWT
    """
    user_service = UserService.UserService(UserRepository(db))
    auth_service = AuthService(user_service)
    identifier = data.username
    password = data.password
    print(f"Tentativa de login: username {identifier}, password {password}")
    user = await user_service.get_user_by_identifier(identifier=identifier)
    if not user or not await auth_service.authenticate_user(user.username, password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Credenciais inválidas."
        )
    access_token = JWTManager().create_access_token(data={
        "sub": identifier,
        "is_admin": user.is_admin,
        "user_id": user.id_user    
        }
    )
    return {"access_token": access_token, "token_type": "bearer"}

@router.get("/me")
async def get_me(current_user=Depends(get_current_user)):
  
    """
    Retorna o usuário autenticado.
    """
    return {"username": current_user.username, "is_admin": current_user.is_admin}