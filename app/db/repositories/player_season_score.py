from datetime import datetime, timezone
from turtle import st
from typing import Optional, Sequence
from sqlalchemy import or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models.player_season_score import PlayerSeasonScore

class PlayerSeasonScoreRepository:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def create(self, player_season_score: PlayerSeasonScore) -> PlayerSeasonScore:
        """
        Cria um novo score do jogador.
        """
        self.db.add(player_season_score)
        await self.db.commit()
        await self.db.refresh(player_season_score)
        return player_season_score
    
    async def list_all_player_season_scores(self) -> Sequence[PlayerSeasonScore]:
        """
        Lista todos os scores dos jogadores.
        """
        stmt = select(PlayerSeasonScore)
        result = await self.db.execute(stmt)
        return result.scalars().all()
    
    async def list_by_season(self, season_id: int) -> Sequence[PlayerSeasonScore]:
        """
        Lista todos os scores dos jogadores de uma temporada.
        """
        stmt = select(PlayerSeasonScore).where(
            PlayerSeasonScore.season_id == season_id
        )
        result = await self.db.execute(stmt)
        return result.scalars().all()
    
    async def get_by_id(self, id_player_season_score: int) -> Optional[PlayerSeasonScore]:
        """
        Busca um score de temporada do jogador pelo seu id.
        """
        stmt = select(PlayerSeasonScore).where(
            PlayerSeasonScore.id_player_season_score == id_player_season_score
        )
        result = await self.db.execute(stmt)
        return result.scalar_one_or_none()
    
    async def get_by_player_and_season(self, player_id: int, season_id: int) -> Optional[PlayerSeasonScore]:
        """
        Busca um score de temporada do jogador pelo id do jogador e da temporada.
        """
        stmt = select(PlayerSeasonScore).where(
            PlayerSeasonScore.player_id == player_id,
            PlayerSeasonScore.season_id == season_id
        )
        result = await self.db.execute(stmt)
        return result.scalar_one_or_none()
    
    async def update(self, id_player_season_score: int, updates: dict) -> Optional[PlayerSeasonScore]:
        """
        Atualiza um score de temporada do jogador.
        """
        player_season_score = await self.get_by_id(id_player_season_score)
        if not player_season_score:
            return None
        for key, value in updates.items():
            if hasattr(player_season_score, key):
                setattr(player_season_score, key, value)
        player_season_score.updated_at = datetime.now(timezone.utc)
        await self.db.commit()
        await self.db.refresh(player_season_score)
        return player_season_score
    
    async def delete(self, id_player_season_score: int) -> bool:
        """
        Deleta um score de temporada do jogador.
        """
        player_season_score = await self.get_by_id(id_player_season_score)
        if not player_season_score:
            return False
        
        player_season_score.deleted_at = datetime.now(timezone.utc)
        await self.db.commit()
        return True
        