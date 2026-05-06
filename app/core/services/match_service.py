from typing import Optional, Sequence
from app.db.models.match import Match
from app.db.repositories.match_repository import MatchRepository

class MatchService:
    def __init__(self, repo: MatchRepository):
        self.repo = repo

    async def create_match(self, match_data: dict) -> Match:
        match_obj = Match(**match_data)
        return await self.repo.create(match=match_obj)
    
    async def get_match_by_id(self, match_id: int) -> Optional[Match]:
        return await self.repo.get_by_id(match_id)
    
    async def list_all_matches(self) -> Sequence[Match]:
        return await self.repo.get_all()

    async def list_matches_by_round(self, round_id: int) -> Sequence[Match]:
        return await self.repo.get_by_round(round_id)

    async def list_matches_by_season(self, season_id: int) -> Sequence[Match]:
        return await self.repo.get_by_season(season_id)
    
    async def edit_match(self, match_id: int, match_data: dict) -> Optional[Match]:
        return await self.repo.update(match_id=match_id, updates=match_data)
        
    async def delete_match(self, match_id: int) -> bool:
        return await self.repo.delete(match_id=match_id)
