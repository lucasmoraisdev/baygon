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
        stmt = (
            select(Teams)
            .options(selectinload(Teams.players), selectinload(Teams.awards))
            .where(Teams.id_team == id_team, Teams.deleted_at.is_(None))
            .execution_options(populate_existing=True)
        )
        result = await self.db.execute(stmt)
        return result.scalar_one_or_none()
    
    async def list_teams_by_round(self, round_id: int) -> Sequence[Teams]:
        """
        Lista todos os times de uma rodada.
        """
        stmt = (
            select(Teams)
            .options(selectinload(Teams.players), selectinload(Teams.awards))
            .where(Teams.round_id == round_id, Teams.deleted_at.is_(None))
            .execution_options(populate_existing=True)
        )
        result = await self.db.execute(stmt)
        return result.scalars().all()

    async def get_players_by_ids(self, player_ids: list[int]) -> list[Player]:
        if not player_ids:
            return []
        stmt = select(Player).where(
            Player.id_player.in_(player_ids),
            Player.deleted_at.is_(None),
        )
        result = await self.db.execute(stmt)
        return list(result.scalars().all())

    async def create(self, team: Teams, player_ids: list[int] = None) -> Teams:
        """
        Cria um novo time.
        """
        if player_ids:
            team.players = await self.get_players_by_ids(player_ids)

        self.db.add(team)
        await self.db.commit()
        return await self.get_by_id(team.id_team)

    async def update(self, id_team: int, updates: dict) -> Optional[Teams]:
        """
        Atualiza um time.
        """
        team = await self.get_by_id(id_team)
        if not team:
            return None

        data = dict(updates)
        player_ids = data.pop("player_ids", None)
        if player_ids is not None:
            team.players = await self.get_players_by_ids(player_ids)

        for field, value in data.items():
            if hasattr(team, field):
                setattr(team, field, value)

        await self.db.commit()
        return await self.get_by_id(id_team)

    async def replace_round_teams(
        self,
        round_id: int,
        teams_payload: list[tuple[str, list[int]]],
        overwrite_existing: bool = False,
    ) -> list[Teams]:
        """
        Cria times em lote para uma rodada, opcionalmente substituindo os existentes.
        """
        if overwrite_existing:
            existing = await self.list_teams_by_round(round_id)
            now = datetime.now(timezone.utc)
            for existing_team in existing:
                existing_team.deleted_at = now
            await self.db.flush()

        all_player_ids = list({pid for _, pids in teams_payload for pid in pids})
        players = await self.get_players_by_ids(all_player_ids)
        players_map = {p.id_player: p for p in players}

        created: list[Teams] = []
        for name, pids in teams_payload:
            team = Teams(name=name.strip() or "Time", round_id=round_id)
            team.players = [players_map[pid] for pid in dict.fromkeys(pids) if pid in players_map]
            self.db.add(team)
            created.append(team)

        await self.db.flush()
        created_ids = [t.id_team for t in created]
        await self.db.commit()

        if not created_ids:
            return []
        stmt = (
            select(Teams)
            .options(selectinload(Teams.players), selectinload(Teams.awards))
            .where(Teams.id_team.in_(created_ids), Teams.deleted_at.is_(None))
            .execution_options(populate_existing=True)
        )
        result = await self.db.execute(stmt)
        fetched = {t.id_team: t for t in result.scalars().all()}
        return [fetched[tid] for tid in created_ids if tid in fetched]

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

