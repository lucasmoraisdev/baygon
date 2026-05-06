from typing import Any, Dict, List
from fastapi import APIRouter, Depends, status, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.dependencies.auth_dependencies import user_has_permission
from app.core.services.round_service import RoundService
from app.db.base import get_db
from app.db.repositories.round_repository import RoundRepository
from app.schemas.round_schema import RoundCreate, RoundRead, RoundUpdate

router = APIRouter(prefix="/rounds", tags=["Rounds"])

@router.post("/", response_model=RoundRead, status_code=status.HTTP_201_CREATED)
async def create_round(
    round_create: RoundCreate,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(user_has_permission)
):
    repo = RoundRepository(db)
    service = RoundService(repo)
    return await service.create_round(round_create.model_dump())

@router.get("/season/{season_id}", response_model=List[RoundRead])
async def get_rounds_by_season(
    season_id: int,
    db: AsyncSession = Depends(get_db)
):
    repo = RoundRepository(db)
    service = RoundService(repo)
    return await service.list_rounds_from_season(season_id)

@router.get("/{round_id}/stats", response_model=Dict[str, Any], status_code=status.HTTP_200_OK)
async def get_round_stats(
    round_id: int,
    db: AsyncSession = Depends(get_db)
):
    repo = RoundRepository(db)
    service = RoundService(repo)
    round_obj = await service.get_round_by_id(round_id)
    if not round_obj:
        raise HTTPException(status_code=404, detail="Round not found")
    return await service.get_round_stats(round_id)

@router.get("/{round_id}", response_model=RoundRead, status_code=status.HTTP_200_OK)
async def get_round(
    round_id: int,
    db: AsyncSession = Depends(get_db)
):
    repo = RoundRepository(db)
    service = RoundService(repo)
    round_obj = await service.get_round_by_id(round_id)
    if not round_obj:
        raise HTTPException(status_code=404, detail="Round not found")
    return round_obj

@router.put("/{round_id}", response_model=RoundRead, status_code=status.HTTP_200_OK)
async def update_round(
    round_id: int,
    round_update: RoundUpdate,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(user_has_permission)
):
    repo = RoundRepository(db)
    service = RoundService(repo)
    updated_round = await service.edit_round(round_id, round_update.model_dump(exclude_unset=True))
    if not updated_round:
        raise HTTPException(status_code=404, detail="Round not found")
    return updated_round

@router.delete("/{round_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_round(
    round_id: int,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(user_has_permission)
):
    repo = RoundRepository(db)
    service = RoundService(repo)
    success = await service.delete_round(round_id)
    if not success:
        raise HTTPException(status_code=404, detail="Round not found")
    return
