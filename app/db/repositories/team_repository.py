from datetime import datetime, timezone
from typing import Optional, Sequence
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from app.db.models.team import Teams

class TeamRepository:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def get_by_id(self, id_team: int) -> Optional[Teams]:
        """
        Busca um time pelo id.
        """
        stmt = select(Teams).where(
            Teams.id_team == id_team
        )
        result = await self.db.execute(stmt)
        return result.scalar_one_or_none()
    
    async def list_teams_by_round(self, round_id: int) -> Sequence[Teams]:
        """
        Lista todos os times de uma rodada.
        """
        stmt = select(Teams).where(
            Teams.round_id == round_id
            )
        result = await self.db.execute(stmt)
        return result.scalars().all()

    async def create(self, team: Teams) -> Teams:
        """
        Cria um novo time.
        """
        self.db.add(team)
        await self.db.commit()
        await self.db.refresh(team)
        return team

    async def update(self, id_team: int, updates: dict) -> Optional[Teams]:
        """
        Atualiza um time.
        """
        team = await self.get_by_id(id_team)
        if not team:
            return None

        for field, value in updates.items():
            if hasattr(team, field):
                setattr(team, field, value)

        await self.db.commit()
        await self.db.refresh(team)
        return team

    async def delete(self, id_team: int) -> bool:
        """
        Deleta um time.
        """
        team = await self.get_by_id(id_team)
        if not team:
            return False
        team.deleted_at = datetime.now(timezone.utc)
        await self.db.commit()

        return True

