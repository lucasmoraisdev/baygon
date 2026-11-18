from datetime import datetime, timezone
from typing import List, Optional
from fastapi import HTTPException, status
from app.db.models.season_poll import SeasonPoll
from app.db.models.user import User
from app.db.repositories.poll_repository import PollRepository
from app.schemas.poll_schema import PollCreate, PollOptionRead, PollRead, PollUpdate


class PollService:
    def __init__(self, repo: PollRepository):
        self.repo = repo

    def is_user_associate(self, user: User) -> bool:
        """
        Verifica se o usuário é administrador ou se possui vínculo com jogador mensalista/associado.
        """
        if user.is_admin:
            return True
        if hasattr(user, "players") and user.players:
            return any(bool(p.is_associate) for p in user.players)
        return False

    def _build_poll_read(
        self,
        poll: SeasonPoll,
        user_voted_option_ids: List[int],
    ) -> PollRead:
        total_votes = len(poll.votes) if poll.votes else 0
        votes_by_option: dict[int, int] = {}
        for v in (poll.votes or []):
            votes_by_option[v.option_id] = votes_by_option.get(v.option_id, 0) + 1

        options_read: List[PollOptionRead] = []
        for opt in poll.options:
            opt_votes = votes_by_option.get(opt.id_option, 0)
            pct = round((opt_votes / total_votes * 100), 1) if total_votes > 0 else 0.0
            options_read.append(
                PollOptionRead(
                    id_option=opt.id_option,
                    poll_id=opt.poll_id,
                    title=opt.title,
                    description=opt.description,
                    votes_count=opt_votes,
                    percentage=pct,
                )
            )

        return PollRead(
            id_poll=poll.id_poll,
            season_id=poll.season_id,
            title=poll.title,
            description=poll.description,
            is_active=poll.is_active,
            multiple_choices=poll.multiple_choices,
            starts_at=poll.starts_at,
            ends_at=poll.ends_at,
            created_by_user_id=poll.created_by_user_id,
            created_at=poll.created_at,
            options=options_read,
            total_votes=total_votes,
            has_voted=len(user_voted_option_ids) > 0,
            user_voted_option_ids=user_voted_option_ids,
        )

    async def list_polls(self, season_id: int, current_user: Optional[User] = None) -> List[PollRead]:
        polls = await self.repo.list_by_season(season_id)
        result: List[PollRead] = []
        for poll in polls:
            user_votes = (
                await self.repo.get_user_votes(poll.id_poll, current_user.id_user)
                if current_user
                else []
            )
            user_voted_ids = [v.option_id for v in user_votes]
            result.append(self._build_poll_read(poll, user_voted_ids))
        return result

    async def get_poll(self, poll_id: int, current_user: Optional[User] = None) -> PollRead:
        poll = await self.repo.get_by_id(poll_id)
        if not poll:
            raise HTTPException(status_code=404, detail="Enquete não encontrada.")

        user_votes = (
            await self.repo.get_user_votes(poll.id_poll, current_user.id_user)
            if current_user
            else []
        )
        user_voted_ids = [v.option_id for v in user_votes]
        return self._build_poll_read(poll, user_voted_ids)

    async def create_poll(self, poll_in: PollCreate, current_user: User) -> PollRead:
        if not poll_in.options or len(poll_in.options) < 2:
            raise HTTPException(
                status_code=400,
                detail="A enquete precisa conter pelo menos duas opções de voto.",
            )

        poll_obj = SeasonPoll(
            season_id=poll_in.season_id,
            title=poll_in.title,
            description=poll_in.description,
            is_active=True,
            multiple_choices=poll_in.multiple_choices,
            starts_at=poll_in.starts_at,
            ends_at=poll_in.ends_at,
            created_by_user_id=current_user.id_user,
        )
        options_data = [opt.model_dump() for opt in poll_in.options]
        created = await self.repo.create_poll(poll_obj, options_data)
        return self._build_poll_read(created, [])

    async def update_poll(self, poll_id: int, poll_update: PollUpdate) -> PollRead:
        poll = await self.repo.get_by_id(poll_id)
        if not poll:
            raise HTTPException(status_code=404, detail="Enquete não encontrada.")

        updated = await self.repo.update_poll(poll, poll_update.model_dump(exclude_unset=True))
        return self._build_poll_read(updated, [])

    async def delete_poll(self, poll_id: int) -> bool:
        poll = await self.repo.get_by_id(poll_id)
        if not poll:
            raise HTTPException(status_code=404, detail="Enquete não encontrada.")
        return await self.repo.delete_poll(poll)

    async def vote(self, poll_id: int, option_ids: List[int], user: User) -> PollRead:
        if not self.is_user_associate(user):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Apenas usuários mensalistas/associados podem votar nesta enquete.",
            )

        poll = await self.repo.get_by_id(poll_id)
        if not poll:
            raise HTTPException(status_code=404, detail="Enquete não encontrada.")

        if not poll.is_active:
            raise HTTPException(status_code=400, detail="Esta enquete está encerrada para votação.")

        now = datetime.now(timezone.utc)
        if poll.starts_at and poll.starts_at > now:
            raise HTTPException(status_code=400, detail="A votação para esta enquete ainda não foi iniciada.")
        if poll.ends_at and poll.ends_at < now:
            raise HTTPException(status_code=400, detail="O prazo para votar nesta enquete já expirou.")

        if not option_ids:
            raise HTTPException(status_code=400, detail="Selecione ao menos uma opção.")

        if not poll.multiple_choices and len(option_ids) > 1:
            raise HTTPException(status_code=400, detail="Esta enquete permite escolher apenas uma opção.")

        valid_option_ids = {opt.id_option for opt in poll.options}
        for opt_id in option_ids:
            if opt_id not in valid_option_ids:
                raise HTTPException(status_code=400, detail=f"Opção de voto inválida: {opt_id}.")

        # Votar
        await self.repo.cast_votes(poll, user.id_user, option_ids)

        # Recarregar
        refreshed = await self.repo.get_by_id(poll_id)
        return self._build_poll_read(refreshed, option_ids)
