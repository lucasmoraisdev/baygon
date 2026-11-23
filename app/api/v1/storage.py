from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel, Field
from typing import Optional

from app.core.tenant_context import get_current_tenant_id
from app.core.dependencies.auth_dependencies import get_current_user
from app.core.services.tenant_storage_service import TenantStorageService

router = APIRouter(prefix="/storage", tags=["Storage & Presigned URLs"])


class PresignRequest(BaseModel):
    category: str = Field(..., description="Categoria do arquivo (ex: receipts, athletes, sumulas)")
    filename: str = Field(..., description="Nome do arquivo a ser salvo")
    ttl_seconds: Optional[int] = Field(900, description="Tempo de vida do link em segundos (padrão 15 min)")


class PresignResponse(BaseModel):
    tenant_id: str
    file_path: str
    presigned_url: str


@router.post("/presign", response_model=PresignResponse, status_code=status.HTTP_201_CREATED)
async def generate_presigned_url(
    payload: PresignRequest,
    current_user=Depends(get_current_user),
):
    """
    Gera uma URL pré-assinada vinculada criptograficamente ao tenant do usuário autenticado.
    """
    tenant_id = get_current_tenant_id()
    if not tenant_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Nenhuma associação ativa no contexto.",
        )

    file_path = TenantStorageService.generate_tenant_path(
        tenant_id=tenant_id,
        category=payload.category,
        filename=payload.filename,
    )

    presigned_url = TenantStorageService.create_presigned_url(
        tenant_id=tenant_id,
        file_path=file_path,
        ttl_seconds=payload.ttl_seconds or 900,
    )

    return PresignResponse(
        tenant_id=tenant_id,
        file_path=file_path,
        presigned_url=presigned_url,
    )


@router.get("/file", status_code=status.HTTP_200_OK)
async def get_storage_file(
    path: str = Query(..., description="Caminho do arquivo no storage"),
    expires: int = Query(..., description="Timestamp de expiração"),
    signature: str = Query(..., description="Assinatura HMAC-SHA256"),
):
    """
    Valida a URL pré-assinada e autoriza o acesso ao arquivo isolado do tenant.
    """
    current_tenant_id = get_current_tenant_id()
    if not current_tenant_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Associação não identificada na requisição.",
        )

    TenantStorageService.verify_presigned_url(
        current_tenant_id=current_tenant_id,
        file_path=path,
        expires_at=expires,
        signature=signature,
    )

    return {
        "status": "authorized",
        "tenant_id": current_tenant_id,
        "file_path": path,
        "message": "Acesso seguro validado com isolamento de tenant.",
    }
