from typing import List, Optional, Sequence
from fastapi import HTTPException
from sqlalchemy import select

from app.core.services.rule_service import RuleService
from app.db.models.award import Awards
from app.db.models.round import Round
from app.db.repositories.awards_repository import AwardRepository
from app.db.repositories.event_score_rule_repository import EventScoreRuleRepository
from app.schemas.awards_schema import RoundAwardEntry


class AwardService:
    def __init__(self, repo: AwardRepository):
        self.repo = repo

    async def create_award(self, award_data: dict) -> Awards:
        award_obj = Awards(
            round_id=award_data.get("round_id"),
            event_type=award_data.get("event_type"),
        )
        return await self.repo.create(
            award=award_obj,
            player_ids=award_data.get("player_ids") or [],
            team_ids=award_data.get("team_ids") or [],
        )

    async def get_award_by_id(self, award_id: int) -> Optional[Awards]:
        return await self.repo.get_by_id(award_id)

    async def list_awards_by_round(self, round_id: int) -> Sequence[Awards]:
        return await self.repo.list_by_round(round_id)

    async def list_awards_by_team(self, team_id: int) -> Sequence[Awards]:
        return await self.repo.list_by_teams(team_id)

    async def list_awards_by_player(self, player_id: int) -> Sequence[Awards]:
        return await self.repo.list_by_players(player_id)

    async def edit_award(self, award_id: int, award_data: dict) -> Optional[Awards]:
        base_updates = {}
        if "round_id" in award_data:
            base_updates["round_id"] = award_data["round_id"]
        if "event_type" in award_data:
            base_updates["event_type"] = award_data["event_type"]

        return await self.repo.edit_award(
            id_award=award_id,
            updates=base_updates,
            player_ids=award_data.get("player_ids"),
            team_ids=award_data.get("team_ids"),
        )

    async def delete_award(self, award_id: int) -> bool:
        return await self.repo.delete_award(id_award=award_id)

    async def set_round_awards(
        self,
        round_id: int,
        entries: List[RoundAwardEntry],
        recalculate_scores: bool = False,
    ) -> Sequence[Awards]:
        db = self.repo.db
        round_obj = (
            await db.execute(
                select(Round).where(Round.id_round == round_id, Round.deleted_at.is_(None))
            )
        ).scalar_one_or_none()
        if not round_obj:
            raise HTTPException(status_code=404, detail="Rodada não encontrada.")

        existing = await self.repo.list_by_round(round_id)
        existing_by_type = {aw.event_type: aw for aw in existing}

        for entry in entries:
            has_winners = bool(entry.player_ids or entry.team_ids)
            current = existing_by_type.get(entry.event_type)
            if current:
                if has_winners:
                    await self.repo.edit_award(
                        id_award=current.id_award,
                        updates={},
                        player_ids=entry.player_ids,
                        team_ids=entry.team_ids,
                    )
                else:
                    await self.repo.delete_award(current.id_award)
            elif has_winners:
                award_obj = Awards(round_id=round_id, event_type=entry.event_type)
                await self.repo.create(
                    award=award_obj,
                    player_ids=entry.player_ids,
                    team_ids=entry.team_ids,
                )

        if recalculate_scores:
            rule_service = RuleService(EventScoreRuleRepository(db))
            await rule_service.calculate_round_scores(round_id)

        return await self.repo.list_by_round(round_id)
