from datetime import datetime, timezone
from typing import Optional, Sequence
from sqlalchemy import select
from sqlalchemy.orm import selectinload
from sqlalchemy.ext.asyncio import AsyncSession
from app.db.models.round_attendance import RoundAttendance


class AttendanceRepository:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def list_by_round(self, round_id: int) -> Sequence[RoundAttendance]:
        stmt = (
            select(RoundAttendance)
            .options(selectinload(RoundAttendance.player))
            .where(
                RoundAttendance.round_id == round_id,
                RoundAttendance.deleted_at.is_(None),
            )
            .order_by(RoundAttendance.status.asc(), RoundAttendance.created_at.asc())
            .execution_options(populate_existing=True)
        )
        result = await self.db.execute(stmt)
        return result.scalars().all()

    async def get_by_round_and_player(
        self, round_id: int, player_id: int, include_deleted: bool = False
    ) -> Optional[RoundAttendance]:
        stmt = (
            select(RoundAttendance)
            .options(selectinload(RoundAttendance.player))
            .where(
                RoundAttendance.round_id == round_id,
                RoundAttendance.player_id == player_id,
            )
            .execution_options(populate_existing=True)
        )
        if not include_deleted:
            stmt = stmt.where(RoundAttendance.deleted_at.is_(None))
        result = await self.db.execute(stmt)
        return result.scalar_one_or_none()

    async def upsert(
        self,
        round_id: int,
        player_id: int,
        status: str,
        updated_by_user_id: Optional[int],
        note: Optional[str] = None,
    ) -> RoundAttendance:
        existing = await self.get_by_round_and_player(
            round_id=round_id, player_id=player_id, include_deleted=True
        )
        if existing:
            existing.status = status
            existing.note = note
            existing.updated_by_user_id = updated_by_user_id
            existing.deleted_at = None
            existing.updated_at = datetime.now(timezone.utc)
        else:
            existing = RoundAttendance(
                round_id=round_id,
                player_id=player_id,
                status=status,
                note=note,
                updated_by_user_id=updated_by_user_id,
            )
            self.db.add(existing)

        await self.db.commit()
        return await self.get_by_round_and_player(round_id=round_id, player_id=player_id)

    async def upsert_batch(
        self,
        round_id: int,
        items: list[tuple[int, str, Optional[str]]],
        updated_by_user_id: Optional[int],
    ) -> Sequence[RoundAttendance]:
        now = datetime.now(timezone.utc)
        for player_id, status, note in items:
            existing = await self.get_by_round_and_player(
                round_id=round_id, player_id=player_id, include_deleted=True
            )
            if existing:
                existing.status = status
                existing.note = note
                existing.updated_by_user_id = updated_by_user_id
                existing.deleted_at = None
                existing.updated_at = now
            else:
                self.db.add(
                    RoundAttendance(
                        round_id=round_id,
                        player_id=player_id,
                        status=status,
                        note=note,
                        updated_by_user_id=updated_by_user_id,
                    )
                )
        await self.db.commit()
        return await self.list_by_round(round_id)

    async def delete_entry(self, round_id: int, player_id: int) -> bool:
        existing = await self.get_by_round_and_player(round_id=round_id, player_id=player_id)
        if not existing:
            return False
        existing.deleted_at = datetime.now(timezone.utc)
        await self.db.commit()
        return True
