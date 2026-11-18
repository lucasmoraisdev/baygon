from typing import List, Optional, Sequence
from sqlalchemy import select, delete
from sqlalchemy.ext.asyncio import AsyncSession
from app.db.models.round import Round
from app.db.models.round_award_vote import RoundAwardVoter, RoundAwardVote
from app.db.models.user import User
from app.db.models.player import Player


class RoundVoteRepository:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def get_round(self, round_id: int) -> Optional[Round]:
        query = select(Round).where(Round.id_round == round_id, Round.deleted_at.is_(None))
        result = await self.db.execute(query)
        return result.scalar_one_or_none()

    async def list_voters(self, round_id: int) -> Sequence[RoundAwardVoter]:
        query = (
            select(RoundAwardVoter)
            .where(RoundAwardVoter.round_id == round_id, RoundAwardVoter.deleted_at.is_(None))
        )
        result = await self.db.execute(query)
        return result.scalars().all()

    async def is_user_voter(self, round_id: int, user_id: int) -> bool:
        query = (
            select(RoundAwardVoter)
            .where(
                RoundAwardVoter.round_id == round_id,
                RoundAwardVoter.user_id == user_id,
                RoundAwardVoter.deleted_at.is_(None),
            )
        )
        result = await self.db.execute(query)
        return result.scalar_one_or_none() is not None

    async def set_round_voters(self, round_id: int, user_ids: List[int]) -> Sequence[RoundAwardVoter]:
        # Remove eleitores antigos que não estão mais na lista
        existing = await self.list_voters(round_id)
        existing_user_ids = {v.user_id for v in existing}
        new_user_ids = set(user_ids)

        to_remove = existing_user_ids - new_user_ids
        if to_remove:
            await self.db.execute(
                delete(RoundAwardVoter).where(
                    RoundAwardVoter.round_id == round_id,
                    RoundAwardVoter.user_id.in_(to_remove),
                )
            )

        to_add = new_user_ids - existing_user_ids
        for uid in to_add:
            voter = RoundAwardVoter(round_id=round_id, user_id=uid)
            self.db.add(voter)

        await self.db.commit()
        return await self.list_voters(round_id)

    async def set_voting_open(self, round_id: int, is_open: bool) -> Round:
        round_obj = await self.get_round(round_id)
        if round_obj:
            round_obj.is_voting_open = is_open
            await self.db.commit()
            await self.db.refresh(round_obj)
        return round_obj

    async def list_votes_by_round(self, round_id: int) -> Sequence[RoundAwardVote]:
        query = (
            select(RoundAwardVote)
            .where(RoundAwardVote.round_id == round_id, RoundAwardVote.deleted_at.is_(None))
        )
        result = await self.db.execute(query)
        return result.scalars().all()

    async def list_user_votes_in_round(self, round_id: int, user_id: int) -> Sequence[RoundAwardVote]:
        query = (
            select(RoundAwardVote)
            .where(
                RoundAwardVote.round_id == round_id,
                RoundAwardVote.user_id == user_id,
                RoundAwardVote.deleted_at.is_(None),
            )
        )
        result = await self.db.execute(query)
        return result.scalars().all()

    async def save_user_votes(
        self,
        round_id: int,
        user_id: int,
        votes: List[dict],
    ) -> Sequence[RoundAwardVote]:
        # Para cada categoria votada, atualiza ou cria o voto
        award_types = [v["award_type"] for v in votes]
        # Remove votos prévios das categorias enviadas
        if award_types:
            await self.db.execute(
                delete(RoundAwardVote).where(
                    RoundAwardVote.round_id == round_id,
                    RoundAwardVote.user_id == user_id,
                    RoundAwardVote.award_type.in_(award_types),
                )
            )

        for item in votes:
            vote = RoundAwardVote(
                round_id=round_id,
                user_id=user_id,
                award_type=item["award_type"],
                player_id=item["player_id"],
            )
            self.db.add(vote)

        await self.db.commit()
        return await self.list_user_votes_in_round(round_id, user_id)
