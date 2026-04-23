from datetime import datetime, timedelta
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
import jwt
from typing import Optional
from app.config.settings import SECRET_KEY, ACCESS_TOKEN_EXPIRE_HOURS, REFRESH_TOKEN_EXPIRE_DAYS

security = HTTPBearer()

class JWTManager:
    JWT_SECRET = SECRET_KEY
    ALGORITHM = "HS256"
    
    @staticmethod
    def create_access_token(data: dict, expires_delta: Optional[timedelta] = None) -> str:
        """
        Cria um access token com tempo de expiracao.
        """
        to_encode = data.copy()

        print(f"ACcess token expire delta: {expires_delta}")
        print(f"ACcess token expire hours: {ACCESS_TOKEN_EXPIRE_HOURS}")
        expire = datetime.now() + (expires_delta or timedelta(hours=ACCESS_TOKEN_EXPIRE_HOURS))
        print(f"Criando access token com payload: {to_encode} e expiração: {expire}")

        # Converter datetime para timestamp Unix (segundos)
        to_encode.update({ "exp": int(expire.timestamp()), "type": "access" })
        # Ensure common fields are in the token
        if "user_id" not in to_encode and "sub" in to_encode:
            # If only 'sub' is provided, keep it for backwards compatibility
            pass
        encoded_jwt = jwt.encode(to_encode, JWTManager.JWT_SECRET, algorithm=JWTManager.ALGORITHM)
        return encoded_jwt
    
    @staticmethod
    def create_refresh_token(data: dict, expires_delta: Optional[timedelta] = None) -> str:
        """
        Cria um refresh token com tempo de expiracao maior.
        """
        to_encode = data.copy()
        print(f"Refresh token expire delta: {expires_delta}")
        print(f"Refresh token expire days: {REFRESH_TOKEN_EXPIRE_DAYS}")
        expire = datetime.now() + (timedelta(days=REFRESH_TOKEN_EXPIRE_DAYS))
        print(f"Criando refresh token com payload: {to_encode} e expiração: {expire}")
        # Converter datetime para timestamp Unix (segundos)
        to_encode.update({ "exp": int(expire.timestamp()), "type": "refresh" })
        encoded_jwt = jwt.encode(to_encode, JWTManager.JWT_SECRET, algorithm=JWTManager.ALGORITHM)
        return encoded_jwt
    
    @staticmethod
    def verify_token(token: str) -> Optional[dict]:
        """
        Verifica se o token é valido e o decodifica.
        Retorna o payload se for valido
        """
        try:
            print(f"Verificando token: {token}")
            print(f"Usando chave secreta: {JWTManager.JWT_SECRET}")
            payload = jwt.decode(token, JWTManager.JWT_SECRET, algorithms=[JWTManager.ALGORITHM])
            print(f"Payload do token : {payload}")
            return payload
        except jwt.ExpiredSignatureError:
            print("Token expirado.")
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Token expirado. Faça login novamente.",
            )
        except jwt.InvalidTokenError:
            print("Token inválido.")
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Token inválido.",
            )
    
    @staticmethod
    def verify_refresh_token(token: str) -> Optional[dict]:
        """
        Verifica se o refresh token é valido e retorna o payload.
        """
        try:
            payload = jwt.decode(token, JWTManager.JWT_SECRET, algorithms=[JWTManager.ALGORITHM])
            print(f"Payload do refresh token: {payload}")
            if payload.get("type") != "refresh":
                raise HTTPException(
                    status_code=status.HTTP_401_UNAUTHORIZED,
                    detail="Token inválido.",
                )
            return payload
        except jwt.ExpiredSignatureError:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Refresh token expirado. Faça login novamente.",
            )
        except jwt.InvalidTokenError:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Refresh token inválido.",
            )
        
    @staticmethod
    async def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)):
        token = credentials.credentials
        payload = JWTManager.verify_token(token)
        return payload