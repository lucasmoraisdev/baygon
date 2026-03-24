from typing import List
from fastapi import APIRouter, Depends, status, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.dependencies.auth_dependencies import user_has_permission
from app.core.services.match_service import MatchService
from app.db.base import get_db
from app.db.repositories.match_repository import MatchRepository
from app.schemas.match_schema import MatchCreate, MatchRead, MatchUpdate

router = APIRouter(prefix="/matches", tags=["Matches"])

@router.post("/", response_model=MatchRead, status_code=status.HTTP_201_CREATED)
async def create_match(
    match_create: MatchCreate,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(user_has_permission)
):
    repo = MatchRepository(db)
    service = MatchService(repo)
    return await service.create_match(match_create.model_dump(exclude={"events"}))

@router.get("/{match_id}", response_model=MatchRead, status_code=status.HTTP_200_OK)
async def get_match(
    match_id: int,
    db: AsyncSession = Depends(get_db)
):
    repo = MatchRepository(db)
    service = MatchService(repo)
    match_obj = await service.get_match_by_id(match_id)
    if not match_obj:
        raise HTTPException(status_code=404, detail="Match not found")
    return match_obj

@router.get("/round/{round_id}", response_model=List[MatchRead])
async def get_matches_by_round(
    round_id: int,
    db: AsyncSession = Depends(get_db)
):
    repo = MatchRepository(db)
    service = MatchService(repo)
    return await service.list_matches_by_round(round_id)

@router.get("/season/{season_id}", response_model=List[MatchRead])
async def get_matches_by_season(
    season_id: int,
    db: AsyncSession = Depends(get_db)
):
    repo = MatchRepository(db)
    service = MatchService(repo)
    return await service.list_matches_by_season(season_id)

@router.put("/{match_id}", response_model=MatchRead, status_code=status.HTTP_200_OK)
async def update_match(
    match_id: int,
    match_update: MatchUpdate,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(user_has_permission)
):
    repo = MatchRepository(db)
    service = MatchService(repo)
    updated_match = await service.edit_match(match_id, match_update.model_dump(exclude_unset=True, exclude={"events"}))
    if not updated_match:
        raise HTTPException(status_code=404, detail="Match not found")
    return updated_match

@router.delete("/{match_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_match(
    match_id: int,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(user_has_permission)
):
    repo = MatchRepository(db)
    service = MatchService(repo)
    success = await service.delete_match(match_id)
    if not success:
        raise HTTPException(status_code=404, detail="Match not found")
    return
