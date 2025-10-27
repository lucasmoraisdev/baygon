from datetime import datetime, timezone
from typing import Optional, Sequence
from sqlalchemy import or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models.player_score import PlayerScore

class PlayerScoreRepository:
    def __init__(self, db: AsyncSession):
        self.db = db
    
    async def create(self, player_score: PlayerScore) -> PlayerScore:
        """
        Cria um novo score do jogador.
        """
        self.db.add(player_score)
        await self.db.commit()
        await self.db.refresh(player_score)
        return player_score
    
    async def list_all_player_scores(self) -> Sequence[PlayerScore]:
        """
        Lista todos os scores dos jogadores.
        """
        stmt = select(PlayerScore)
        result = await self.db.execute(stmt)
        return result.scalars().all()
    
    async def get_by_id(self, id_player_score: int) -> Optional[PlayerScore]:
        """
        Busca um score do jogador pelo seu id.
        """
        stmt = select(PlayerScore).where(
            PlayerScore.id_player_score == id_player_score
        )
        result = await self.db.execute(stmt)
        return result.scalar_one_or_none()
    
    async def get_by_round(self, round_id: int) -> Sequence[PlayerScore]:
        """
        Busca todos os scores dos jogadores de uma rodada.
        """
        stmt = select(PlayerScore).where(
            PlayerScore.round_id == round_id
        )
        result = await self.db.execute(stmt)
        return result.scalars().all()
    
    async def get_by_season(self, season_id: int) -> Sequence[PlayerScore]:
        """
        Busca todos os scores dos jogadores de uma temporada.
        """
        stmt = select(PlayerScore).where(
            PlayerScore.season_id == season_id
        )
        result = await self.db.execute(stmt)
        return result.scalars().all()
    
    async def update(self, id_player_score: int, updates: dict) -> Optional[PlayerScore]:
        """
        Atualiza um score do jogador.
        """
        player_score = await self.get_by_id(id_player_score)
        if not player_score:
            return None
        for key, value in updates.items():
            if hasattr(player_score, key):
                setattr(player_score, key, value)
        player_score.updated_at = datetime.now(timezone.utc)
        await self.db.commit()
        await self.db.refresh(player_score)
        return player_score
    
    async def delete(self, id_player_score: int) -> bool:
        """
        Deleta um score do jogador.
        """
        player_score = await self.get_by_id(id_player_score)
        if not player_score:
            return False
        
        player_score.deleted_at = datetime.now(timezone.utc)
        await self.db.commit()
        return True
        