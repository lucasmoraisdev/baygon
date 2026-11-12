from typing import Optional
from fastapi import HTTPException
from sqlalchemy import select
from app.db.models.player import Player
from app.db.models.round import Round
from app.db.repositories.attendance_repository import AttendanceRepository
from app.schemas.attendance_schema import (
    AdminAttendanceItem,
    AttendanceRead,
    AttendanceSummaryResponse,
)


class AttendanceService:
    def __init__(self, repo: AttendanceRepository):
        self.repo = repo

    async def _ensure_round_exists(self, round_id: int) -> Round:
        stmt = select(Round).where(Round.id_round == round_id, Round.deleted_at.is_(None))
        rnd = (await self.repo.db.execute(stmt)).scalar_one_or_none()
        if not rnd:
            raise HTTPException(status_code=404, detail="Rodada não encontrada.")
        return rnd

    async def get_round_attendance(self, round_id: int) -> AttendanceSummaryResponse:
        await self._ensure_round_exists(round_id)
        entries = list(await self.repo.list_by_round(round_id))
        confirmed = sum(1 for e in entries if e.status == "confirmed")
        declined = sum(1 for e in entries if e.status == "declined")
        waiting = sum(1 for e in entries if e.status == "waiting")
        return AttendanceSummaryResponse(
            round_id=round_id,
            confirmed_count=confirmed,
            declined_count=declined,
            waiting_count=waiting,
            items=[AttendanceRead.model_validate(e) for e in entries],
        )

    async def set_my_attendance(
        self,
        round_id: int,
        user_id: int,
        status: str,
        note: Optional[str] = None,
        player_id: Optional[int] = None,
    ) -> AttendanceRead:
        await self._ensure_round_exists(round_id)
        stmt = select(Player).where(Player.user_id == user_id, Player.deleted_at.is_(None))
        linked_players = list((await self.repo.db.execute(stmt)).scalars().all())
        if not linked_players:
            raise HTTPException(
                status_code=400,
                detail="Seu usuário não está vinculado a nenhum jogador. Solicite ao administrador.",
            )

        target_player = linked_players[0]
        if player_id is not None:
            matched = next((p for p in linked_players if p.id_player == player_id), None)
            if not matched:
                raise HTTPException(
                    status_code=403,
                    detail="Jogador informado não está vinculado ao seu usuário.",
                )
            target_player = matched

        entry = await self.repo.upsert(
            round_id=round_id,
            player_id=target_player.id_player,
            status=status,
            updated_by_user_id=user_id,
            note=note,
        )
        return AttendanceRead.model_validate(entry)

    async def set_admin_attendance_batch(
        self,
        round_id: int,
        items: list[AdminAttendanceItem],
        admin_user_id: int,
    ) -> AttendanceSummaryResponse:
        await self._ensure_round_exists(round_id)
        payload = [(item.player_id, item.status, item.note) for item in items]
        await self.repo.upsert_batch(
            round_id=round_id,
            items=payload,
            updated_by_user_id=admin_user_id,
        )
        return await self.get_round_attendance(round_id)

    async def remove_attendance(self, round_id: int, player_id: int) -> bool:
        await self._ensure_round_exists(round_id)
        return await self.repo.delete_entry(round_id=round_id, player_id=player_id)
