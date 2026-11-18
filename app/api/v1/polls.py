from typing import List, Optional
from fastapi import APIRouter, Depends, status
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.dependencies.auth_dependencies import get_current_user, user_has_permission
from app.core.services.poll_service import PollService
from app.db.base import get_db
from app.db.models.user import User
from app.db.repositories.poll_repository import PollRepository
from app.schemas.poll_schema import PollCreate, PollRead, PollUpdate, PollVoteRequest

router = APIRouter(prefix="/polls", tags=["Polls"])


def get_poll_service(db: AsyncSession = Depends(get_db)) -> PollService:
    return PollService(PollRepository(db))


@router.get("/season/{season_id}", response_model=List[PollRead])
async def list_season_polls(
    season_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: Optional[User] = Depends(get_current_user),
    service: PollService = Depends(get_poll_service),
):
    return await service.list_polls(season_id, current_user)


@router.get("/{poll_id}", response_model=PollRead)
async def get_poll_by_id(
    poll_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: Optional[User] = Depends(get_current_user),
    service: PollService = Depends(get_poll_service),
):
    return await service.get_poll(poll_id, current_user)


@router.post("/", response_model=PollRead, status_code=status.HTTP_201_CREATED)
async def create_poll(
    payload: PollCreate,
    current_user: User = Depends(user_has_permission),
    service: PollService = Depends(get_poll_service),
):
    return await service.create_poll(payload, current_user)


@router.put("/{poll_id}", response_model=PollRead)
async def update_poll(
    poll_id: int,
    payload: PollUpdate,
    current_user: User = Depends(user_has_permission),
    service: PollService = Depends(get_poll_service),
):
    return await service.update_poll(poll_id, payload)


@router.delete("/{poll_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_poll(
    poll_id: int,
    current_user: User = Depends(user_has_permission),
    service: PollService = Depends(get_poll_service),
):
    await service.delete_poll(poll_id)
    return None


@router.post("/{poll_id}/vote", response_model=PollRead)
async def vote_in_poll(
    poll_id: int,
    payload: PollVoteRequest,
    current_user: User = Depends(get_current_user),
    service: PollService = Depends(get_poll_service),
):
    return await service.vote(poll_id, payload.option_ids, current_user)
