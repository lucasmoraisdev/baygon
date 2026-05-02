from typing import List
from fastapi import APIRouter, Depends, status, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.dependencies.auth_dependencies import user_has_permission
from app.core.services.team_service import TeamService
from app.db.base import get_db
from app.db.repositories.team_repository import TeamRepository
from app.schemas.team_schema import TeamCreate, TeamRead, TeamUpdate

router = APIRouter(prefix="/teams", tags=["Teams"])

@router.get("/", response_model=List[TeamRead])
async def list_all_teams(
    db: AsyncSession = Depends(get_db)
):
    repo = TeamRepository(db)
    service = TeamService(repo)
    return await service.list_all_teams()

@router.post("/", response_model=TeamRead, status_code=status.HTTP_201_CREATED)
async def create_team(
    team_create: TeamCreate,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(user_has_permission)
):
    repo = TeamRepository(db)
    service = TeamService(repo)
    return await service.create_team(team_create.model_dump())

@router.get("/round/{round_id}", response_model=List[TeamRead])
async def get_teams_by_round(
    round_id: int,
    db: AsyncSession = Depends(get_db)
):
    repo = TeamRepository(db)
    service = TeamService(repo)
    return await service.list_teams_by_round(round_id)

@router.get("/{team_id}", response_model=TeamRead, status_code=status.HTTP_200_OK)
async def get_team(
    team_id: int,
    db: AsyncSession = Depends(get_db)
):
    repo = TeamRepository(db)
    service = TeamService(repo)
    team_obj = await service.get_team_by_id(team_id)
    if not team_obj:
        raise HTTPException(status_code=404, detail="Team not found")
    return team_obj

@router.put("/{team_id}", response_model=TeamRead, status_code=status.HTTP_200_OK)
async def update_team(
    team_id: int,
    team_update: TeamUpdate,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(user_has_permission)
):
    repo = TeamRepository(db)
    service = TeamService(repo)
    updated_team = await service.edit_team(team_id, team_update.model_dump(exclude_unset=True))
    if not updated_team:
        raise HTTPException(status_code=404, detail="Team not found")
    return updated_team

@router.delete("/{team_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_team(
    team_id: int,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(user_has_permission)
):
    repo = TeamRepository(db)
    service = TeamService(repo)
    success = await service.delete_team(team_id)
    if not success:
        raise HTTPException(status_code=404, detail="Team not found")
    return
