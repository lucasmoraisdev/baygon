from typing import List
from fastapi import APIRouter, Depends, status, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.dependencies.auth_dependencies import user_has_permission
from app.core.services.event_service import EventService
from app.db.base import get_db
from app.db.repositories.match_event_repository import MatchEventRepository
from app.schemas.match_event_schema import MatchEventCreate, MatchEventRead, MatchEventUpdate

router = APIRouter(prefix="/events", tags=["Events"])

@router.post("/", response_model=MatchEventRead, status_code=status.HTTP_201_CREATED)
async def create_event(
    event_create: MatchEventCreate,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(user_has_permission)
):
    repo = MatchEventRepository(db)
    service = EventService(repo)
    return await service.create_event(event_create.model_dump())

@router.get("/match/{match_id}", response_model=List[MatchEventRead])
async def list_events_by_match(
    match_id: int,
    db: AsyncSession = Depends(get_db)
):
    repo = MatchEventRepository(db)
    service = EventService(repo)
    return await service.list_events_by_match(match_id)

@router.get("/{event_id}", response_model=MatchEventRead, status_code=status.HTTP_200_OK)
async def get_event(
    event_id: int,
    db: AsyncSession = Depends(get_db)
):
    repo = MatchEventRepository(db)
    service = EventService(repo)
    event_obj = await service.get_event_by_id(event_id)
    if not event_obj:
        raise HTTPException(status_code=404, detail="Event not found")
    return event_obj

@router.put("/{event_id}", response_model=MatchEventRead, status_code=status.HTTP_200_OK)
async def update_event(
    event_id: int,
    event_update: MatchEventUpdate,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(user_has_permission)
):
    repo = MatchEventRepository(db)
    service = EventService(repo)
    updated_event = await service.edit_event(event_id, event_update.model_dump(exclude_unset=True))
    if not updated_event:
        raise HTTPException(status_code=404, detail="Event not found")
    return updated_event

@router.delete("/{event_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_event(
    event_id: int,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(user_has_permission)
):
    repo = MatchEventRepository(db)
    service = EventService(repo)
    success = await service.delete_event(event_id)
    if not success:
        raise HTTPException(status_code=404, detail="Event not found")
    return
