from typing import Optional, Sequence, Dict, Any
from app.db.models.player import Player
from app.db.repositories.player_repository import PlayerRepository

class PlayerService:
    def __init__(self, repo: PlayerRepository):
        self.repo = repo

    async def create_player(self, player_data: dict) -> Player:
        print(f"Creating player with data: {player_data}")
        player_obj = Player(**player_data)
        return await self.repo.create(player=player_obj)
    
    async def list_all_players(self) -> Sequence[Player]:
        return await self.repo.list_all_players()
    
    async def get_player_by_id(self, player_id: int) -> Optional[Player]:
        return await self.repo.get_by_id(player_id)
    
    async def edit_player(self, player_id: int, player_data: dict) -> Optional[Player]:
        return await self.repo.update_player(id_player=player_id, updates=player_data)
        
    async def delete_player(self, player_id: int) -> bool:
        return await self.repo.delete_player(id_player=player_id)

    async def get_player_stats(self, player_id: int) -> Dict[str, Any]:
        """Obtém estatísticas gerais do jogador"""
        return await self.repo.get_player_stats(player_id)

    async def get_player_season_stats(self, player_id: int) -> Sequence[Dict[str, Any]]:
        """Obtém estatísticas do jogador por temporada"""
        return await self.repo.get_player_season_stats(player_id)
