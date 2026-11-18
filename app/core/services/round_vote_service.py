from collections import defaultdict
from typing import List, Optional
from fastapi import HTTPException, status
from sqlalchemy import select
from app.core.services.award_service import AwardService
from app.db.models.player import Player
from app.db.models.round_award_vote import RoundAwardVote
from app.db.models.user import User
from app.db.repositories.awards_repository import AwardRepository
from app.db.repositories.round_vote_repository import RoundVoteRepository
from app.schemas.awards_schema import RoundAwardEntry
from app.schemas.round_vote_schema import (
    AWARD_CATEGORY_LABELS,
    RoundCategoryTally,
    RoundVoteCandidateCount,
    RoundVoteItem,
    RoundVoterRead,
    RoundVotingStatusRead,
)

ALLOWED_AWARD_TYPES = list(AWARD_CATEGORY_LABELS.keys())


class RoundVoteService:
    def __init__(self, repo: RoundVoteRepository):
        self.repo = repo

    async def get_voting_status(
        self,
        round_id: int,
        current_user: Optional[User] = None,
    ) -> RoundVotingStatusRead:
        round_obj = await self.repo.get_round(round_id)
        if not round_obj:
            raise HTTPException(status_code=404, detail="Rodada não encontrada.")

        voters = await self.repo.list_voters(round_id)
        all_votes = await self.repo.list_votes_by_round(round_id)

        # Usuários que já votaram (qualquer categoria)
        voted_user_ids = {v.user_id for v in all_votes}

        voters_read: List[RoundVoterRead] = []
        for v in voters:
            u = v.user
            voters_read.append(
                RoundVoterRead(
                    id_voter=v.id_voter,
                    round_id=round_id,
                    user_id=v.user_id,
                    user_name=u.name if u else f"Usuário #{v.user_id}",
                    user_email=u.email if u else "",
                    has_voted=v.user_id in voted_user_ids,
                )
            )

        is_user_voter = False
        user_votes_list: List[RoundVoteItem] = []
        if current_user:
            is_user_voter = any(v.user_id == current_user.id_user for v in voters)
            user_votes = await self.repo.list_user_votes_in_round(round_id, current_user.id_user)
            user_votes_list = [
                RoundVoteItem(award_type=v.award_type, player_id=v.player_id)
                for v in user_votes
            ]

        # Agrupar votos por categoria
        votes_by_category: dict[str, list[RoundAwardVote]] = defaultdict(list)
        for v in all_votes:
            votes_by_category[v.award_type].append(v)

        tallies: List[RoundCategoryTally] = []
        for award_type in ALLOWED_AWARD_TYPES:
            cat_votes = votes_by_category.get(award_type, [])
            total_cat_votes = len(cat_votes)

            player_counts: dict[int, dict] = {}
            for v in cat_votes:
                pid = v.player_id
                if pid not in player_counts:
                    p = v.player
                    player_counts[pid] = {
                        "player_id": pid,
                        "player_name": p.nome if p else f"Jogador #{pid}",
                        "player_apelido": p.apelido if p else None,
                        "count": 0,
                    }
                player_counts[pid]["count"] += 1

            candidates: List[RoundVoteCandidateCount] = []
            leading_id = None
            leading_name = None
            max_votes = -1

            for pid, data in player_counts.items():
                cnt = data["count"]
                pct = round((cnt / total_cat_votes * 100), 1) if total_cat_votes > 0 else 0.0
                cand = RoundVoteCandidateCount(
                    player_id=pid,
                    player_name=data["player_name"],
                    player_apelido=data["player_apelido"],
                    votes_count=cnt,
                    percentage=pct,
                )
                candidates.append(cand)
                if cnt > max_votes:
                    max_votes = cnt
                    leading_id = pid
                    leading_name = data["player_name"]

            # Ordenar candidatos por mais votos
            candidates.sort(key=lambda c: c.votes_count, reverse=True)

            tallies.append(
                RoundCategoryTally(
                    award_type=award_type,
                    category_label=AWARD_CATEGORY_LABELS.get(award_type, award_type),
                    total_votes=total_cat_votes,
                    candidates=candidates,
                    leading_player_id=leading_id,
                    leading_player_name=leading_name,
                )
            )

        voted_voters_count = len(voted_user_ids.intersection({v.user_id for v in voters}))

        return RoundVotingStatusRead(
            round_id=round_id,
            is_voting_open=round_obj.is_voting_open,
            is_user_voter=is_user_voter,
            total_voters_count=len(voters),
            voted_voters_count=voted_voters_count,
            voters=voters_read,
            user_votes=user_votes_list,
            tallies=tallies,
        )

    async def assign_voters(self, round_id: int, user_ids: List[int]) -> RoundVotingStatusRead:
        round_obj = await self.repo.get_round(round_id)
        if not round_obj:
            raise HTTPException(status_code=404, detail="Rodada não encontrada.")
        if not round_obj.is_voting_open:
            raise HTTPException(
                status_code=400,
                detail="A votação está encerrada. Abra ou edite a votação para designar jurados.",
            )
        await self.repo.set_round_voters(round_id, user_ids)
        return await self.get_voting_status(round_id)

    async def toggle_voting(self, round_id: int, is_open: bool) -> RoundVotingStatusRead:
        round_obj = await self.repo.get_round(round_id)
        if not round_obj:
            raise HTTPException(status_code=404, detail="Rodada não encontrada.")
        await self.repo.set_voting_open(round_id, is_open)
        return await self.get_voting_status(round_id)

    async def cast_votes(
        self,
        round_id: int,
        user: User,
        votes: List[RoundVoteItem],
    ) -> RoundVotingStatusRead:
        round_obj = await self.repo.get_round(round_id)
        if not round_obj:
            raise HTTPException(status_code=404, detail="Rodada não encontrada.")

        if not round_obj.is_voting_open and not user.is_admin:
            raise HTTPException(status_code=400, detail="A votação para esta rodada não está aberta.")

        # Verificar se o usuário é um dos jurados designados pelo admin
        is_voter = await self.repo.is_user_voter(round_id, user.id_user)
        if not is_voter and not user.is_admin:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Apenas os usuários designados pela administração podem votar nesta rodada.",
            )

        # Validar categorias
        for item in votes:
            if item.award_type not in ALLOWED_AWARD_TYPES:
                raise HTTPException(
                    status_code=400,
                    detail=f"Categoria de votação inválida: {item.award_type}.",
                )

        # Salvar votos
        votes_data = [{"award_type": v.award_type, "player_id": v.player_id} for v in votes]
        await self.repo.save_user_votes(round_id, user.id_user, votes_data)

        return await self.get_voting_status(round_id, user)

    async def apply_votes_to_awards(
        self,
        round_id: int,
        recalculate_scores: bool = True,
    ) -> dict:
        """
        Consolida os candidatos mais votados em cada categoria de premiação da rodada,
        atualizando a tabela Awards e opcionalmente recalculando a pontuação.
        """
        status_read = await self.get_voting_status(round_id)
        entries: List[RoundAwardEntry] = []

        for tally in status_read.tallies:
            if tally.leading_player_id:
                entries.append(
                    RoundAwardEntry(
                        event_type=tally.award_type,
                        player_ids=[tally.leading_player_id],
                        team_ids=[],
                    )
                )

        if not entries:
            raise HTTPException(
                status_code=400,
                detail="Nenhum voto foi registrado ainda para aplicar aos prêmios.",
            )

        award_repo = AwardRepository(self.repo.db)
        award_service = AwardService(award_repo)
        await award_service.set_round_awards(
            round_id=round_id,
            entries=entries,
            recalculate_scores=recalculate_scores,
        )

        return {
            "message": "Vencedores consolidados com sucesso nas premiações da rodada!",
            "applied_count": len(entries),
        }
