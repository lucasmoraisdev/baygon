from datetime import datetime, timezone
from typing import Optional, Sequence
from sqlalchemy import select
from sqlalchemy.orm import selectinload
from sqlalchemy.ext.asyncio import AsyncSession
from app.db.models.team import Teams
from app.db.models.player import Player

class TeamRepository:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def get_by_id(self, id_team: int) -> Optional[Teams]:
        """
        Busca um time pelo id.
        """
        stmt = select(Teams).options(
            selectinload(Teams.players),
            selectinload(Teams.awards)
        ).where(
            Teams.id_team == id_team
        )
        result = await self.db.execute(stmt)
        return result.scalar_one_or_none()
    
    async def list_teams_by_round(self, round_id: int) -> Sequence[Teams]:
        """
        Lista todos os times de uma rodada.
        """
        stmt = select(Teams).options(
            selectinload(Teams.players),
            selectinload(Teams.awards)
        ).where(
            Teams.round_id == round_id
        )
        result = await self.db.execute(stmt)
        return result.scalars().all()

    async def create(self, team: Teams, player_ids: list[int] = None) -> Teams:
        """
        Cria um novo time.
        """
        self.db.add(team)
        
        if player_ids:
            stmt = select(Player).where(Player.id_player.in_(player_ids))
            result = await self.db.execute(stmt)
            players = result.scalars().all()
            team.players.extend(players)

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

    async def list_all(self) -> Sequence[Teams]:
        """
        Lista todos os times.
        """
        stmt = select(Teams).options(
            selectinload(Teams.players),
            selectinload(Teams.awards)
        ).where(Teams.deleted_at.is_(None))
        result = await self.db.execute(stmt)
        return result.scalars().all()

