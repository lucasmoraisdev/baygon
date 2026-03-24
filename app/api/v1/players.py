from typing import List
from fastapi import APIRouter, Depends, status, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.dependencies.auth_dependencies import user_has_permission
from app.core.services.player_service import PlayerService
from app.db.base import get_db
from app.db.repositories.player_repository import PlayerRepository
from app.schemas.player_schema import PlayerCreate, PlayerRead, PlayerUpdate

router = APIRouter(prefix="/players", tags=["Players"])

@router.post("/", response_model=PlayerRead, status_code=status.HTTP_201_CREATED)
async def create_player(
    player_create: PlayerCreate,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(user_has_permission)
):
    repo = PlayerRepository(db)
    service = PlayerService(repo)
    return await service.create_player(player_create.model_dump())

@router.get("/", response_model=List[PlayerRead])
async def list_players(
    db: AsyncSession = Depends(get_db)
):
    repo = PlayerRepository(db)
    service = PlayerService(repo)
    return await service.list_all_players()

@router.get("/{player_id}", response_model=PlayerRead, status_code=status.HTTP_200_OK)
async def get_player(
    player_id: int,
    db: AsyncSession = Depends(get_db)
):
    repo = PlayerRepository(db)
    service = PlayerService(repo)
    player_obj = await service.get_player_by_id(player_id)
    if not player_obj:
        raise HTTPException(status_code=404, detail="Player not found")
    return player_obj

@router.put("/{player_id}", response_model=PlayerRead, status_code=status.HTTP_200_OK)
async def update_player(
    player_id: int,
    player_update: PlayerUpdate,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(user_has_permission)
):
    repo = PlayerRepository(db)
    service = PlayerService(repo)
    updated_player = await service.edit_player(player_id, player_update.model_dump(exclude_unset=True))
    if not updated_player:
        raise HTTPException(status_code=404, detail="Player not found")
    return updated_player

@router.delete("/{player_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_player(
    player_id: int,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(user_has_permission)
):
    repo = PlayerRepository(db)
    service = PlayerService(repo)
    success = await service.delete_player(player_id)
    if not success:
        raise HTTPException(status_code=404, detail="Player not found")
    return
