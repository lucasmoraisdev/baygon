from typing import List, Optional, Sequence
from sqlalchemy import select, delete, func
from sqlalchemy.ext.asyncio import AsyncSession
from app.db.models.season_poll import SeasonPoll, SeasonPollOption, SeasonPollVote
from app.db.models.user import User


class PollRepository:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def list_by_season(self, season_id: int) -> Sequence[SeasonPoll]:
        query = (
            select(SeasonPoll)
            .where(SeasonPoll.season_id == season_id, SeasonPoll.deleted_at.is_(None))
            .order_by(SeasonPoll.is_active.desc(), SeasonPoll.created_at.desc())
        )
        result = await self.db.execute(query)
        return result.scalars().all()

    async def get_by_id(self, poll_id: int) -> Optional[SeasonPoll]:
        query = (
            select(SeasonPoll)
            .where(SeasonPoll.id_poll == poll_id, SeasonPoll.deleted_at.is_(None))
        )
        result = await self.db.execute(query)
        return result.scalar_one_or_none()

    async def create_poll(self, poll: SeasonPoll, options_data: List[dict]) -> SeasonPoll:
        self.db.add(poll)
        await self.db.flush()

        for opt in options_data:
            option_obj = SeasonPollOption(
                poll_id=poll.id_poll,
                title=opt["title"],
                description=opt.get("description"),
            )
            self.db.add(option_obj)

        await self.db.commit()
        await self.db.refresh(poll)
        return poll

    async def update_poll(self, poll: SeasonPoll, updates: dict) -> SeasonPoll:
        for key, value in updates.items():
            if value is not None and hasattr(poll, key):
                setattr(poll, key, value)
        await self.db.commit()
        await self.db.refresh(poll)
        return poll

    async def delete_poll(self, poll: SeasonPoll) -> bool:
        await self.db.delete(poll)
        await self.db.commit()
        return True

    async def get_user_votes(self, poll_id: int, user_id: int) -> List[SeasonPollVote]:
        query = (
            select(SeasonPollVote)
            .where(
                SeasonPollVote.poll_id == poll_id,
                SeasonPollVote.user_id == user_id,
                SeasonPollVote.deleted_at.is_(None),
            )
        )
        result = await self.db.execute(query)
        return list(result.scalars().all())

    async def cast_votes(
        self,
        poll: SeasonPoll,
        user_id: int,
        option_ids: List[int],
    ) -> List[SeasonPollVote]:
        # Se não for múltipla escolha, remove votos anteriores do usuário nesta enquete
        if not poll.multiple_choices:
            await self.db.execute(
                delete(SeasonPollVote).where(
                    SeasonPollVote.poll_id == poll.id_poll,
                    SeasonPollVote.user_id == user_id,
                )
            )

        created_votes = []
        for opt_id in option_ids:
            vote = SeasonPollVote(
                poll_id=poll.id_poll,
                option_id=opt_id,
                user_id=user_id,
            )
            self.db.add(vote)
            created_votes.append(vote)

        await self.db.commit()
        return created_votes
