from typing import Optional, Sequence
from app.db.models.player_score import PlayerScore
from app.db.repositories.player_score_repository import PlayerScoreRepository

class ScoreService:
    def __init__(self, repo: PlayerScoreRepository):
        self.repo = repo

    async def create_score(self, score_data: dict) -> PlayerScore:
        score_obj = PlayerScore(**score_data)
        return await self.repo.create(player_score=score_obj)
    
    async def list_all_scores(self) -> Sequence[PlayerScore]:
        return await self.repo.list_all_player_scores()

    async def get_score_by_id(self, score_id: int) -> Optional[PlayerScore]:
        return await self.repo.get_by_id(score_id)
    
    async def get_scores_by_round(self, round_id: int) -> Sequence[PlayerScore]:
        return await self.repo.get_by_round(round_id)

    async def get_scores_by_season(self, season_id: int) -> Sequence[PlayerScore]:
        return await self.repo.get_by_season(season_id)
    
    async def edit_score(self, score_id: int, score_data: dict) -> Optional[PlayerScore]:
        return await self.repo.update(id_player_score=score_id, updates=score_data)
        
    async def delete_score(self, score_id: int) -> bool:
        return await self.repo.delete(id_player_score=score_id)
