from datetime import datetime, timezone
from typing import Optional, Sequence
from sqlalchemy import or_, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.db.models.match import Match
from app.db.models.round import Round


class MatchRepository:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def create(self, match: Match) -> Match:
        """Cria uma nova partida."""
        self.db.add(match)
        await self.db.commit()
        return await self.get_by_id(match.id_match)

    async def get_by_id(self, match_id: int) -> Optional[Match]:
        """Busca uma partida pelo seu id."""
        stmt = (
            select(Match)
            .options(selectinload(Match.events))
            .where(Match.id_match == match_id, Match.deleted_at.is_(None))
        )
        result = await self.db.execute(stmt)
        return result.scalar_one_or_none()

    async def get_all(self) -> Sequence[Match]:
        stmt = (
            select(Match)
            .options(selectinload(Match.events))
            .where(Match.deleted_at.is_(None))
            .order_by(Match.id_match.desc())
        )
        result = await self.db.execute(stmt)
        return result.scalars().all()

    async def get_by_round(self, round_id: int) -> Sequence[Match]:
        """Busca todas as partidas de um round."""
        stmt = (
            select(Match)
            .options(selectinload(Match.events))
            .where(Match.round_id == round_id, Match.deleted_at.is_(None))
            .order_by(Match.id_match.asc())
        )
        result = await self.db.execute(stmt)
        return result.scalars().all()

    async def get_by_season(self, season_id: int) -> Sequence[Match]:
        """Busca todas as partidas de uma temporada via Round."""
        stmt = (
            select(Match)
            .options(selectinload(Match.events))
            .join(Round, Round.id_round == Match.round_id)
            .where(
                Round.season_id == season_id,
                Match.deleted_at.is_(None),
                Round.deleted_at.is_(None),
            )
            .order_by(Match.id_match.desc())
        )
        result = await self.db.execute(stmt)
        return result.scalars().all()

    async def get_by_team_and_round(self, team_id: int, round_id: int) -> Sequence[Match]:
        """Busca todas as partidas de um time numa rodada."""
        stmt = (
            select(Match)
            .options(selectinload(Match.events))
            .where(
                Match.round_id == round_id,
                Match.deleted_at.is_(None),
                or_(
                    Match.home_team_id == team_id,
                    Match.away_team_id == team_id,
                ),
            )
        )
        result = await self.db.execute(stmt)
        return result.scalars().all()

    async def update(self, match_id: int, updates: dict) -> Optional[Match]:
        """Atualiza uma partida."""
        match = await self.get_by_id(match_id)
        if not match:
            return None

        for key, value in updates.items():
            if hasattr(match, key) and value is not None:
                setattr(match, key, value)

        match.updated_at = datetime.now(timezone.utc)
        await self.db.commit()
        return await self.get_by_id(match_id)

    async def delete(self, match_id: int) -> bool:
        """Deleta uma partida."""
        match = await self.get_by_id(match_id)
        if not match:
            return False

        match.deleted_at = datetime.now(timezone.utc)
        await self.db.commit()
        return True