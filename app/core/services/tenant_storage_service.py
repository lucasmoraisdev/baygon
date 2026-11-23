import hmac
import hashlib
import time
import os
import re
from typing import Optional
from fastapi import HTTPException, status
from app.config.settings import SECRET_KEY

STORAGE_SIGNING_KEY = os.getenv("STORAGE_SIGNING_KEY", SECRET_KEY).encode("utf-8")
DEFAULT_EXPIRATION_SECONDS = 900  # 15 minutos


class TenantStorageService:
    """
    Serviço para gerenciamento seguro e isolado de storage de arquivos por tenant.
    Garante que nenhum caminho de arquivo seja compartilhado ou acessível
    sem URL pré-assinada criptograficamente vinculada ao tenant_id ativo.
    """

    @staticmethod
    def sanitize_path_part(part: str) -> str:
        clean = os.path.basename(part.strip())
        clean = re.sub(r"[^a-zA-Z0-9_.-]", "_", clean)
        return clean or "file"

    @classmethod
    def generate_tenant_path(cls, tenant_id: str, category: str, filename: str) -> str:
        """
        Gera o caminho físico padronizado particionado por tenant:
        tenants/{tenant_id}/{category}/{filename}
        """
        clean_cat = cls.sanitize_path_part(category)
        clean_file = cls.sanitize_path_part(filename)
        return f"tenants/{tenant_id}/{clean_cat}/{clean_file}"

    @classmethod
    def create_presigned_url(
        cls,
        tenant_id: str,
        file_path: str,
        ttl_seconds: int = DEFAULT_EXPIRATION_SECONDS,
        base_url: str = "/api/v1/storage/file",
    ) -> str:
        """
        Gera uma URL pré-assinada criptograficamente vinculada ao tenant_id e ao arquivo.
        """
        expected_prefix = f"tenants/{tenant_id}/"
        if not file_path.startswith(expected_prefix):
            raise ValueError(
                f"Tentativa de violação de fronteira: caminho '{file_path}' "
                f"não pertence ao tenant '{tenant_id}'."
            )

        expires_at = int(time.time()) + ttl_seconds
        message = f"{tenant_id}:{file_path}:{expires_at}".encode("utf-8")
        signature = hmac.new(STORAGE_SIGNING_KEY, message, hashlib.sha256).hexdigest()

        return f"{base_url}?path={file_path}&expires={expires_at}&signature={signature}"

    @classmethod
    def verify_presigned_url(
        cls,
        current_tenant_id: str,
        file_path: str,
        expires_at: int,
        signature: str,
    ) -> bool:
        """
        Valida integridade da URL pré-assinada.
        Lança HTTPException 401 ou 403 em caso de expiração, adulteração ou acesso cruzado.
        """
        now = int(time.time())
        if expires_at < now:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="A URL pré-assinada de acesso ao arquivo expirou.",
            )

        # Regra de Ouro: o caminho do arquivo solicitado DEVE iniciar com tenants/{current_tenant_id}/
        expected_prefix = f"tenants/{current_tenant_id}/"
        if not file_path.startswith(expected_prefix):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Acesso negado: tentativa de acesso cruzado a arquivo de outra associação.",
            )

        message = f"{current_tenant_id}:{file_path}:{expires_at}".encode("utf-8")
        expected_sig = hmac.new(STORAGE_SIGNING_KEY, message, hashlib.sha256).hexdigest()

        if not hmac.compare_digest(expected_sig, signature):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Assinatura criptográfica da URL de storage inválida ou adulterada.",
            )

        return True
