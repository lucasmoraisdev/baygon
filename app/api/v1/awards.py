from typing import List
from fastapi import APIRouter, Depends, status, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.dependencies.auth_dependencies import user_has_permission
from app.core.services.award_service import AwardService
from app.db.base import get_db
from app.db.repositories.awards_repository import AwardRepository
from app.schemas.awards_schema import AwardCreate, AwardRead, AwardUpdate

router = APIRouter(prefix="/awards", tags=["Awards"])

@router.post("/", response_model=AwardRead, status_code=status.HTTP_201_CREATED)
async def create_award(
    award_create: AwardCreate,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(user_has_permission)
):
    repo = AwardRepository(db)
    service = AwardService(repo)
    return await service.create_award(award_create.model_dump())

@router.get("/{award_id}", response_model=AwardRead, status_code=status.HTTP_200_OK)
async def get_award(
    award_id: int,
    db: AsyncSession = Depends(get_db)
):
    repo = AwardRepository(db)
    service = AwardService(repo)
    award_obj = await service.get_award_by_id(award_id)
    if not award_obj:
        raise HTTPException(status_code=404, detail="Award not found")
    return award_obj

@router.get("/round/{round_id}", response_model=List[AwardRead])
async def list_awards_by_round(
    round_id: int,
    db: AsyncSession = Depends(get_db)
):
    repo = AwardRepository(db)
    service = AwardService(repo)
    return await service.list_awards_by_round(round_id)

@router.get("/team/{team_id}", response_model=List[AwardRead])
async def list_awards_by_team(
    team_id: int,
    db: AsyncSession = Depends(get_db)
):
    repo = AwardRepository(db)
    service = AwardService(repo)
    return await service.list_awards_by_team(team_id)

@router.put("/{award_id}", response_model=AwardRead, status_code=status.HTTP_200_OK)
async def update_award(
    award_id: int,
    award_update: AwardUpdate,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(user_has_permission)
):
    repo = AwardRepository(db)
    service = AwardService(repo)
    updated_award = await service.edit_award(award_id, award_update.model_dump(exclude_unset=True))
    if not updated_award:
        raise HTTPException(status_code=404, detail="Award not found")
    return updated_award

@router.delete("/{award_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_award(
    award_id: int,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(user_has_permission)
):
    repo = AwardRepository(db)
    service = AwardService(repo)
    success = await service.delete_award(award_id)
    if not success:
        raise HTTPException(status_code=404, detail="Award not found")
    return
