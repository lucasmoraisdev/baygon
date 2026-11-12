from datetime import datetime, timezone
from typing import List, Optional, Sequence
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.db.models.award import Awards
from app.db.models.player import Player
from app.db.models.team import Teams


class AwardRepository:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def create(
        self,
        award: Awards,
        player_ids: Optional[List[int]] = None,
        team_ids: Optional[List[int]] = None,
    ) -> Awards:
        """Cria um novo prêmio associando jogadores e times."""
        if player_ids:
            players = list(
                (await self.db.execute(select(Player).where(Player.id_player.in_(player_ids)))).scalars().all()
            )
            award.player = players
        if team_ids:
            teams = list(
                (await self.db.execute(select(Teams).where(Teams.id_team.in_(team_ids)))).scalars().all()
            )
            award.teams = teams

        self.db.add(award)
        await self.db.commit()
        return await self.get_by_id(award.id_award)

    async def get_by_id(self, id_award: int) -> Optional[Awards]:
        """Busca um prêmio pelo seu id."""
        stmt = (
            select(Awards)
            .options(selectinload(Awards.player), selectinload(Awards.teams))
            .where(Awards.id_award == id_award, Awards.deleted_at.is_(None))
            .execution_options(populate_existing=True)
        )
        result = await self.db.execute(stmt)
        return result.scalar_one_or_none()

    async def list_by_round(self, round_id: int) -> Sequence[Awards]:
        """Busca todos os prêmios de uma rodada."""
        stmt = (
            select(Awards)
            .options(selectinload(Awards.player), selectinload(Awards.teams))
            .where(Awards.round_id == round_id, Awards.deleted_at.is_(None))
            .order_by(Awards.id_award.asc())
        )
        result = await self.db.execute(stmt)
        return result.scalars().all()

    async def list_by_teams(self, team_id: int) -> Sequence[Awards]:
        """Busca todos os prêmios de um time."""
        stmt = (
            select(Awards)
            .options(selectinload(Awards.player), selectinload(Awards.teams))
            .where(Awards.teams.any(id_team=team_id), Awards.deleted_at.is_(None))
        )
        result = await self.db.execute(stmt)
        return result.scalars().all()

    async def list_by_players(self, player_id: int) -> Sequence[Awards]:
        """Busca todos os prêmios de um jogador."""
        stmt = (
            select(Awards)
            .options(selectinload(Awards.player), selectinload(Awards.teams))
            .where(Awards.player.any(id_player=player_id), Awards.deleted_at.is_(None))
        )
        result = await self.db.execute(stmt)
        return result.scalars().all()

    async def edit_award(
        self,
        id_award: int,
        updates: dict,
        player_ids: Optional[List[int]] = None,
        team_ids: Optional[List[int]] = None,
    ) -> Optional[Awards]:
        """Edita um prêmio."""
        award = await self.get_by_id(id_award)
        if not award:
            return None

        for key, value in updates.items():
            if hasattr(award, key) and value is not None:
                setattr(award, key, value)

        if player_ids is not None:
            players = list(
                (await self.db.execute(select(Player).where(Player.id_player.in_(player_ids)))).scalars().all()
            ) if player_ids else []
            award.player = players

        if team_ids is not None:
            teams = list(
                (await self.db.execute(select(Teams).where(Teams.id_team.in_(team_ids)))).scalars().all()
            ) if team_ids else []
            award.teams = teams

        award.updated_at = datetime.now(timezone.utc)
        await self.db.commit()
        return await self.get_by_id(id_award)

    async def delete_award(self, id_award: int) -> bool:
        """Deleta um prêmio."""
        award = await self.get_by_id(id_award)
        if not award:
            return False

        award.deleted_at = datetime.now(timezone.utc)
        await self.db.commit()
        return True