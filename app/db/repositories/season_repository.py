from datetime import datetime, timezone
from typing import Optional, Sequence
from sqlalchemy import or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models.season import Seasons

class SeasonRepository:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def create(self, season: Seasons) -> Seasons:
        """
        Cria uma nova temporada.
        """
        self.db.add(season)
        await self.db.commit()
        await self.db.refresh(season)
        return season

    async def get_by_id(self, id_season: int) -> Optional[Seasons]:
        """
        Busca uma temporada pelo seu id.
        """
        stmt = select(Seasons).where(
            Seasons.id_season == id_season
        )
        result = await self.db.execute(stmt)
        return result.scalar_one_or_none()
    
    async def edit(self, id_season: int, updates: dict) -> Optional[Seasons]:
        """
        Edita uma temporada.
        """
        season = await self.get_by_id(id_season)
        if not season:
            return None
        for key, value in updates.items():
            if hasattr(season, key):
                setattr(season, key, value)
        season.updated_at = datetime.now(timezone.utc)
        await self.db.commit()
        await self.db.refresh(season)
        return season
    
    async def delete(self, id_season: int) -> bool:
        """
        Deleta uma temporada.
        """
        season = await self.get_by_id(id_season)
        if not season:
            return False
        
        season.deleted_at = datetime.now(timezone.utc)
        await self.db.commit()
        return True
