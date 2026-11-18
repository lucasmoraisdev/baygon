from typing import Optional
from fastapi import APIRouter, Body, Depends, status
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.dependencies.auth_dependencies import get_current_user, user_has_permission
from app.core.services.round_vote_service import RoundVoteService
from app.db.base import get_db
from app.db.models.user import User
from app.db.repositories.round_vote_repository import RoundVoteRepository
from app.schemas.round_vote_schema import (
    RoundVoteSubmitRequest,
    RoundVotersAssignRequest,
    RoundVotingStatusRead,
)

router = APIRouter(prefix="/rounds/{round_id}/voting", tags=["Round Voting"])


def get_round_vote_service(db: AsyncSession = Depends(get_db)) -> RoundVoteService:
    return RoundVoteService(RoundVoteRepository(db))


@router.get("", response_model=RoundVotingStatusRead)
async def get_round_voting_status(
    round_id: int,
    current_user: Optional[User] = Depends(get_current_user),
    service: RoundVoteService = Depends(get_round_vote_service),
):
    return await service.get_voting_status(round_id, current_user)


@router.post("/voters", response_model=RoundVotingStatusRead)
async def assign_round_voters(
    round_id: int,
    payload: RoundVotersAssignRequest,
    current_user: User = Depends(user_has_permission),
    service: RoundVoteService = Depends(get_round_vote_service),
):
    return await service.assign_voters(round_id, payload.user_ids)


@router.post("/toggle", response_model=RoundVotingStatusRead)
async def toggle_round_voting(
    round_id: int,
    is_open: bool = Body(..., embed=True),
    current_user: User = Depends(user_has_permission),
    service: RoundVoteService = Depends(get_round_vote_service),
):
    return await service.toggle_voting(round_id, is_open)


@router.post("/vote", response_model=RoundVotingStatusRead)
async def submit_round_votes(
    round_id: int,
    payload: RoundVoteSubmitRequest,
    current_user: User = Depends(get_current_user),
    service: RoundVoteService = Depends(get_round_vote_service),
):
    return await service.cast_votes(
        round_id=round_id,
        user=current_user,
        votes=payload.votes,
        target_user_id=payload.voter_user_id,
    )


@router.post("/apply-awards")
async def apply_votes_to_awards(
    round_id: int,
    recalculate_scores: bool = Body(default=True, embed=True),
    current_user: User = Depends(user_has_permission),
    service: RoundVoteService = Depends(get_round_vote_service),
):
    return await service.apply_votes_to_awards(round_id, recalculate_scores)
