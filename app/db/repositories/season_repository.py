from datetime import datetime, timezone
from typing import Optional, Sequence
from fastapi import HTTPException
from sqlalchemy import desc, or_, select
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
    
    async def get_last_season_number(self) -> int:
        """
        Pega a ultima temporada.
        """
        try:
            stmt = select(Seasons.number).where(
                Seasons.deleted_at.is_(None),
                Seasons.end_date.is_(None)
                ).order_by(desc(Seasons.number))
            
            result = await self.db.execute(stmt)

            season = result.fetchone()

            if season is None:
                return 0
            
            return season[0]
        except Exception as e:
            print(f"Erro ao buscar última temporada: {e}")
            raise HTTPException(status_code=500, detail="Erro ao acessar o banco de dados ao buscar a última temporada.")
    
    async def list_all_seasons(self) -> Sequence[Seasons]:
        """
        Lista todas as temporadas.
        """
        stmt = select(Seasons).where(
            Seasons.deleted_at.isnot(None)
        ).order_by(desc(Seasons.number))
        result = await self.db.execute(stmt)
        
        seasons = result.scalars().all()
        return seasons