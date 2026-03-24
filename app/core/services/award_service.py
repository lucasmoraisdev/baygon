from typing import Optional, Sequence
from app.db.models.award import Awards
from app.db.repositories.awards_repository import AwardRepository

class AwardService:
    def __init__(self, repo: AwardRepository):
        self.repo = repo

    async def create_award(self, award_data: dict) -> Awards:
        base_data = {
            "round_id": award_data.get("round_id"),
            "event_type": award_data.get("event_type")
        }
        award_obj = Awards(**base_data)
        return await self.repo.create(award=award_obj)
    
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
        return await self.repo.edit_award(id_award=award_id, updates=base_updates)
        
    async def delete_award(self, award_id: int) -> bool:
        return await self.repo.delete_award(id_award=award_id)
