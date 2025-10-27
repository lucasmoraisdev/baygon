from datetime import datetime, timezone
from typing import Optional, Sequence
from sqlalchemy import or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models.award import Awards

class AwardRepository:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def create(self, award: Awards) -> Awards:
        """
        Cria um novo prêmio.
        """
        self.db.add(award)
        await self.db.commit()
        await self.db.refresh(award)
        return award
    
    async def get_by_id(self, id_award: int) -> Optional[Awards]:
        """
        Busca um prêmio pelo seu id.
        """
        stmt = select(Awards).where(
            Awards.id_award == id_award,
            Awards.deleted_at.is_(None)
        )
        result = await self.db.execute(stmt)
        return result.scalar_one_or_none()
    
    async def list_by_round(self, round_id: int) -> Sequence[Awards]:
        """
        Busca todos os prêmios de uma rodada.
        """
        stmt = select(Awards).where(
            Awards.round_id == round_id,
            Awards.deleted_at.is_(None)
        )
        result = await self.db.execute(stmt)
        return result.scalars().all()
    
    async def list_by_teams(self, team_id: int) -> Sequence[Awards]:
        """
        Busca todos os prêmios de um time (ou seja, de uma rodada tambem).
        """
        stmt = select(Awards).where(
            Awards.teams.any(id_team=team_id),
            Awards.deleted_at.is_(None)
        )
        result = await self.db.execute(stmt)
        return result.scalars().all()
    
    async def list_by_players(self, player_id: int) -> Sequence[Awards]:
        """
        Busca todos os prêmios de um jogador (Historicamente).
        """
        stmt = select(Awards).where(
            Awards.players.any(id_player=player_id),
            Awards.deleted_at.is_(None)
        )
        result = await self.db.execute(stmt)
        return result.scalars().all()
    
    async def edit_award(self, id_award: int, updates: dict) -> Optional[Awards]:
        """
        Edita um prêmio.
        """
        award = await self.get_by_id(id_award)
        if not award:
            return None
        for key, value in updates.items():
            if hasattr(award, key):
                setattr(award, key, value)
        award.updated_at = datetime.now(timezone.utc)
        await self.db.commit()
        await self.db.refresh(award)
        return award
    
    async def delete_award(self, id_award: int) -> bool:
        """
        Deleta um prêmio.
        """
        award = await self.get_by_id(id_award)
        if not award:
            return False
        
        award.deleted_at = datetime.now(timezone.utc)
        await self.db.commit()
        return True