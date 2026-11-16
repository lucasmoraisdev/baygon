from typing import List, Optional, Sequence
from app.db.models.roulette_prize import RoulettePrize
from app.db.models.round_roulette_winner import RoundRouletteWinner
from app.db.repositories.roulette_prize_repository import RoulettePrizeRepository


class RoulettePrizeService:
    def __init__(self, repo: RoulettePrizeRepository):
        self.repo = repo

    async def list_prizes(self, include_inactive: bool = False) -> Sequence[RoulettePrize]:
        return await self.repo.list_all(include_inactive=include_inactive)

    async def get_prize(self, prize_id: int) -> Optional[RoulettePrize]:
        return await self.repo.get_by_id(prize_id)

    async def create_prize(self, data: dict) -> RoulettePrize:
        prize = RoulettePrize(
            name=data["name"],
            description=data.get("description"),
            is_active=data.get("is_active", True),
        )
        return await self.repo.create(prize)

    async def edit_prize(self, prize_id: int, data: dict) -> Optional[RoulettePrize]:
        return await self.repo.update(prize_id, data)

    async def delete_prize(self, prize_id: int) -> bool:
        return await self.repo.delete(prize_id)

    async def get_round_winners(self, round_id: int) -> Sequence[RoundRouletteWinner]:
        return await self.repo.list_round_winners(round_id)

    async def save_round_winners(
        self, round_id: int, winners: List[dict]
    ) -> Sequence[RoundRouletteWinner]:
        return await self.repo.sync_round_winners(round_id, winners)
