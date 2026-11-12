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
from app.schemas.user_schema import UserRead
from pydantic import BaseModel

router = APIRouter(tags=["Authentication"])

class LoginRequest(BaseModel):
    email: str
    password: str

class RefreshTokenRequest(BaseModel):
    refresh_token: str

@router.post("/login")
async def login(data: LoginRequest, db: AsyncSession = Depends(get_db)):
    """
    Endpoint para autenticação do usuário e retorno de JWT
    """
    print(f"Requisição recebida: {data.dict()}")
    
    user_service = UserService.UserService(UserRepository(db))
    auth_service = AuthService(user_service)
    email = data.email
    password = data.password
    print(f"Tentativa de login: email {email}, password {password}")
    
    # authenticate_user raises HTTPException if auth fails
    try:
        await auth_service.authenticate_user(email, password)
    except HTTPException:
        raise
    
    # Get user data for token creation
    user = await user_service.get_user_by_email(email)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Credenciais inválidas."
        )
    
    # Criar access token com email e username
    access_token = JWTManager.create_access_token(data={
        "sub": email,
        "email": user.email,
        "username": user.username,
        "role": user.role,
        "user_id": user.id_user    
        }
    )
    
    # Criar refresh token
    refresh_token = JWTManager.create_refresh_token(data={
        "sub": email,
        "email": user.email,
        "username": user.username,
        "user_id": user.id_user
    })
    
    return {
        "access_token": access_token, 
        "refresh_token": refresh_token,
        "token_type": "bearer"
    }

@router.post("/refresh")
async def refresh_token(data: RefreshTokenRequest, db: AsyncSession = Depends(get_db)):
    """
    Endpoint para renovar o access token usando o refresh token
    """
    try:
        # Verificar o refresh token
        payload = JWTManager.verify_refresh_token(data.refresh_token)
        
        # Buscar o usuário
        user_service = UserService.UserService(UserRepository(db))
        user = await user_service.get_user_by_id(payload["user_id"])
        
        if not user:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Usuário não encontrado."
            )
        
        # Criar novo access token com email e username
        access_token = JWTManager.create_access_token(data={
            "sub": payload["sub"],
            "email": user.email,
            "username": user.username,
            "role": user.role,
            "user_id": user.id_user    
        })
        
        # Criar novo refresh token com data de expiracao valida
        refresh_token = JWTManager.create_refresh_token(data={
            "sub": payload["sub"],
            "email": user.email,
            "username": user.username,
            "user_id": user.id_user
        })
        
        return {
            "access_token": access_token,
            "refresh_token": refresh_token,
            "token_type": "bearer"
        }
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Refresh token inválido."
        )

@router.get("/me", response_model=UserRead)
async def get_me(current_user=Depends(get_current_user)):
  
    """
    Retorna o usuário autenticado.
    """
    print(f"Usuário autenticado: {current_user.username}")
    return current_user


class ChangePasswordRequest(BaseModel):
    current_password: str
    new_password: str


class ForgotPasswordRequest(BaseModel):
    email: str


class ResetPasswordRequest(BaseModel):
    token: str
    new_password: str


@router.post("/change-password")
async def change_password(
    data: ChangePasswordRequest,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_user),
):
    """Permite ao usuário autenticado alterar sua própria senha."""
    user_service = UserService.UserService(UserRepository(db))
    return await user_service.change_password(
        user_id=current_user.id_user,
        current_password=data.current_password,
        new_password=data.new_password,
    )


@router.post("/forgot-password")
async def forgot_password(
    data: ForgotPasswordRequest,
    db: AsyncSession = Depends(get_db),
):
    """Solicita link de redefinição de senha por e-mail."""
    user_service = UserService.UserService(UserRepository(db))
    return await user_service.request_password_reset(data.email)


@router.post("/reset-password")
async def reset_password(
    data: ResetPasswordRequest,
    db: AsyncSession = Depends(get_db),
):
    """Redefine a senha utilizando um token válido."""
    user_service = UserService.UserService(UserRepository(db))
    return await user_service.reset_password_with_token(
        token=data.token,
        new_password=data.new_password,
    )