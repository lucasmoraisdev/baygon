from typing import Optional, Sequence
from app.db.models.team import Teams
from app.db.repositories.team_repository import TeamRepository

class TeamService:
    def __init__(self, repo: TeamRepository):
        self.repo = repo

    async def create_team(self, team_data: dict) -> Teams:
        player_ids = team_data.pop("player_ids", [])
        team_obj = Teams(**team_data)
        return await self.repo.create(team=team_obj, player_ids=player_ids)
    
    async def list_teams_by_round(self, round_id: int) -> Sequence[Teams]:
        return await self.repo.list_teams_by_round(round_id)
    
    async def get_team_by_id(self, team_id: int) -> Optional[Teams]:
        return await self.repo.get_by_id(team_id)
    
    async def edit_team(self, team_id: int, team_data: dict) -> Optional[Teams]:
        return await self.repo.update(id_team=team_id, updates=team_data)
        
    async def delete_team(self, team_id: int) -> bool:
        return await self.repo.delete(id_team=team_id)

    async def list_all_teams(self) -> Sequence[Teams]:
        return await self.repo.list_all()
