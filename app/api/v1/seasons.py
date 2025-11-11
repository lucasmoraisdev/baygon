from typing import List
from fastapi import APIRouter, Depends, status
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.dependencies.auth_dependencies import user_has_permission
from app.core.services.season_service import SeasonService
from app.db.base import get_db
from app.db.repositories.season_repository import SeasonRepository
from app.schemas.season_schema import SeasonCreate, SeasonRead, SeasonUpdate


router = APIRouter(prefix="/seasons", tags=["Seasons"])

@router.post("/", response_model=SeasonRead, status_code=status.HTTP_201_CREATED)
async def create_season(
    season_create: SeasonCreate,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(user_has_permission)
):
    repo = SeasonRepository(db)
    service = SeasonService(repo)
    return await service.create_new_season(season_create.model_dump())

@router.get("/", response_model=List[SeasonRead])
async def get_seasons(
    db: AsyncSession = Depends(get_db)
):
    repo = SeasonRepository(db)
    service = SeasonService(repo)
    return await service.list_all_seasons()

@router.get("/{season_id}", response_model=SeasonRead, status_code=status.HTTP_200_OK)
async def get_season(
    season_id: int,
    db: AsyncSession = Depends(get_db)
):
    repo = SeasonRepository(db)
    service = SeasonService(repo)
    return await service.get_season_by_id(season_id)

@router.put("/{season_id}", response_model=SeasonRead, status_code=status.HTTP_200_OK)
async def update_season(
    season_id: int,
    season_update: SeasonUpdate,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(user_has_permission)
):
    repo = SeasonRepository(db)
    service = SeasonService(repo)
    return await service.edit_season(season_id, season_update.dict(exclude_unset=True))

@router.delete("/{season_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_season(
    season_id: int,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(user_has_permission)
):
    repo = SeasonRepository(db)
    service = SeasonService(repo)
    return await service.delete_season(season_id)