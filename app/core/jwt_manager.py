from datetime import datetime, timedelta
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
import jwt
from typing import Optional
from app.config.settings import SECRET_KEY, ACCESS_TOKEN_EXPIRE_HOURS

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
        expire = datetime.now() + (expires_delta or timedelta(hours=ACCESS_TOKEN_EXPIRE_HOURS))
        to_encode.update({ "exp": expire })
        encoded_jwt = jwt.encode(to_encode, JWTManager.JWT_SECRET, algorithm=JWTManager.ALGORITHM)
        return encoded_jwt
    
    @staticmethod
    def verify_token(token: str) -> Optional[dict]:
        """
        Verifica se o token é valido e o decodifica.
        Retorna o payload se for valido
        """
        try:
            payload = jwt.decode(token, SECRET_KEY, algorithms=[JWTManager.ALGORITHM])
            return payload
        except jwt.ExpiredSignatureError:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Token expirado. Faça login novamente.",
            )
        except jwt.InvalidTokenError:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Token inválido.",
            )
        
    @staticmethod
    async def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)):
        token = credentials.credentials
        payload = JWTManager.verify_token(token)
        return payload