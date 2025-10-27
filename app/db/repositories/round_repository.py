from datetime import datetime, timezone
from typing import Optional, Sequence
from sqlalchemy import or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models.round import Round

class RoundRepository:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def create(self, round: Round) -> Round:
        """
        Cria uma nova rodada.
        """
        self.db.add(round)
        await self.db.commit()
        await self.db.refresh(round)
        return round

    async def get_by_id(self, id_round: int) -> Optional[Round]:
        """
        Busca uma rodada pelo seu id.
        """
        stmt = select(Round).where(
            Round.id_round == id_round
        )
        result = await self.db.execute(stmt)
        return result.scalar_one_or_none()
    
    async def list_all_rounds_from_season(self, season_id: int) -> Sequence[Round]:
        """
        Lista todas as rodadas.
        """
        stmt = select(Round).where(
            Round.season_id == season_id,
            Round.deleted_at.is_(None)
        )
        result = await self.db.execute(stmt)
        return result.scalars().all()
    
    async def edit_round(self, id_round: int, updates: dict) -> Optional[Round]:
        """
        Edita uma rodada de uma temporada.
        """
        round = await self.get_by_id(id_round)
        if not round:
            return None
        for key, value in updates.items():
            if hasattr(round, key):
                setattr(round, key, value)
        round.updated_at = datetime.now(timezone.utc)
        await self.db.commit()
        await self.db.refresh(round)
        return round
    
    async def delete_round(self, id_round: int) -> bool:
        """
        Deleta uma rodada de uma temporada.
        """
        round = await self.get_by_id(id_round)
        if not round:
            return False
        
        round.deleted_at = datetime.now(timezone.utc)
        await self.db.commit()
        return True
    
    