from typing import List
from fastapi import APIRouter, Depends, status
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.dependencies.auth_dependencies import user_has_permission
from app.core.services.round_media_service import RoundMediaService
from app.db.base import get_db
from app.db.repositories.round_media_repository import RoundMediaRepository
from app.schemas.round_media_schema import RoundMediaCreate, RoundMediaRead

router = APIRouter(prefix="/rounds/{round_id}/media", tags=["Round Media"])


@router.get("/", response_model=List[RoundMediaRead], status_code=status.HTTP_200_OK)
async def list_round_media(
    round_id: int,
    db: AsyncSession = Depends(get_db),
):
    """Retorna todas as mídias sociais vinculadas à rodada (público)."""
    service = RoundMediaService(RoundMediaRepository(db))
    return await service.list_round_media(round_id)


@router.post("/", response_model=RoundMediaRead, status_code=status.HTTP_201_CREATED)
async def create_round_media(
    round_id: int,
    payload: RoundMediaCreate,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(user_has_permission),
):
    """Cadastra um link de mídia social para a rodada (apenas admin)."""
    service = RoundMediaService(RoundMediaRepository(db))
    return await service.create_round_media(
        round_id=round_id,
        url=payload.url,
        title=payload.title,
        media_type=payload.media_type,
        description=payload.description,
    )


@router.delete("/{media_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_round_media(
    round_id: int,
    media_id: int,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(user_has_permission),
):
    """Remove um link de mídia social da rodada (apenas admin)."""
    service = RoundMediaService(RoundMediaRepository(db))
    await service.delete_round_media(round_id=round_id, media_id=media_id)
    return
