from fastapi import Depends, HTTPException, status
import streamlit as st
import logging
from cryptography.fernet import Fernet, InvalidToken
from app.core.services import user_service
from app.config.settings import PHRASE_ENCODE
from app.core.jwt_manager import JWTManager
from app.core.services.user_service import UserService
from app.db.repositories.user_repository import UserRepository
from app.db.base import get_db
from sqlalchemy.ext.asyncio import AsyncSession

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')

key = str(PHRASE_ENCODE) if PHRASE_ENCODE else None

class AuthService:
    def __init__(self, service: user_service.UserService):
        self.logger = logging.getLogger(__name__)
        try:
            if key and key != "None":
                self.fernet = Fernet(key.encode("utf-8")) if isinstance(key, str) else Fernet(key)
            else:
                self.logger.warning("PHRASE_ENCODE not configured. Password encryption disabled.")
                self.fernet = None
        except Exception as e:
            self.logger.error(f"Failed to initialize Fernet key: {e}")
            self.fernet = None
        self.user_service = service

    async def authenticate_user(self, email: str, password: str) -> str:
        """
        Autentica o usuario utilizando a busca de usuario do user_service.
        Retorna True se autenticado.
        """
        if not email or not password:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Usuário e senha são obrigatórios."
            )

        try:
            user = await self.user_service.get_user_by_email(email)

            if not user:
                raise HTTPException(
                    status_code=status.HTTP_401_UNAUTHORIZED,
                    detail="Email não encontrado."
                )

            encrypted_password = user.password

            if not self.fernet:
                self.logger.error("Fernet not initialized. Cannot decrypt password.")
                raise HTTPException(
                    status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                    detail="Erro na configuração de segurança do sistema."
                )

            try:
                decrypted_password = self.fernet.decrypt(encrypted_password.encode("utf-8")).decode("utf-8")
                print(f"Senha descriptografada para usuário '{email}': {decrypted_password}")
                print(f"Senha fornecida para autenticação: {password}")
            except InvalidToken:
                self.logger.error(f"Erro ao descriptografar a senha do usuário '{email}'")
                raise HTTPException(
                    status_code=status.HTTP_401_UNAUTHORIZED,
                    detail="Erro ao validar credenciais."
                )

            if password != decrypted_password:
                raise HTTPException(
                    status_code=status.HTTP_401_UNAUTHORIZED,
                    detail="Credenciais inválidas."
                )

            token_data = {"sub": email}
            access_token = JWTManager.create_access_token(data=token_data)
            self.logger.info(f"Usuário '{email}' autenticado com sucesso.")
            return access_token

        except Exception as e:
            self.logger.error(f"Erro ao autenticar usuário '{email}': {e}", exc_info=True)
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Erro interno no servidor."
            )
        
    async def get_current_user(self, token: str) -> dict:
        """
        Recupera o usuário atual a partir do token JWT.
        """
        try:
            payload = JWTManager.verify_token(token)
        except HTTPException as e:
            raise e

        print(f"Payload do token: {payload}")

        if not payload:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Token inválido."
            )
        
        # Try to get user_id from payload, fall back to getting user by email (sub)
        user_id = payload.get("user_id")
        email = payload.get("email")
        username = payload.get("username")
        
        user = None
        if user_id:
            user = await self.user_service.get_user_by_id(user_id)
        elif email:
            user = await self.user_service.get_user_by_email(email)
        elif username:
            user = await self.user_service.get_user_by_username(username)
        print(f"Usuário encontrado: {user.username if user else 'Nenhum usuário encontrado'}")
        
        if not user:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Usuário não encontrado."
            )

        return user

async def get_auth_service(db: AsyncSession = Depends(get_db)) -> AuthService:
    user_repo = UserRepository(db)
    user_service = UserService(user_repo)
    return AuthService(user_service)