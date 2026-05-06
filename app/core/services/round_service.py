from typing import Any, Dict, Optional, Sequence
from app.db.models.round import Round
from app.db.repositories.round_repository import RoundRepository


class RoundService:
    def __init__(self, repo: RoundRepository):
        self.repo = repo

    async def create_round(self, round_data: dict) -> Round:
        round_obj = Round(**round_data)
        new_round = await self.repo.create(round=round_obj)
        return new_round

    async def list_rounds_from_season(self, season_id: int) -> Sequence[Round]:
        return await self.repo.list_all_rounds_from_season(season_id)

    async def get_round_by_id(self, round_id: int) -> Optional[Round]:
        return await self.repo.get_by_id(round_id)

    async def edit_round(self, round_id: int, round_data: dict) -> Optional[Round]:
        return await self.repo.edit_round(id_round=round_id, updates=round_data)

    async def delete_round(self, round_id: int) -> bool:
        return await self.repo.delete_round(round_id)

    async def get_round_stats(self, round_id: int) -> Dict[str, Any]:
        return await self.repo.get_round_stats(round_id)
