from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.dependencies.auth_dependencies import get_current_user, user_has_permission
from app.core.services.attendance_service import AttendanceService
from app.db.base import get_db
from app.db.repositories.attendance_repository import AttendanceRepository
from app.schemas.attendance_schema import (
    AdminAttendanceBatchRequest,
    AttendanceRead,
    AttendanceSummaryResponse,
    MyAttendanceRequest,
)

router = APIRouter(prefix="/attendance", tags=["Attendance"])


@router.get("/round/{round_id}", response_model=AttendanceSummaryResponse)
async def get_round_attendance(
    round_id: int,
    db: AsyncSession = Depends(get_db),
):
    service = AttendanceService(AttendanceRepository(db))
    return await service.get_round_attendance(round_id)


@router.post("/round/{round_id}/me", response_model=AttendanceRead)
async def set_my_attendance(
    round_id: int,
    payload: MyAttendanceRequest,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_user),
):
    user_id = current_user["id_user"] if isinstance(current_user, dict) else current_user.id_user
    service = AttendanceService(AttendanceRepository(db))
    return await service.set_my_attendance(
        round_id=round_id,
        user_id=user_id,
        status=payload.status,
        note=payload.note,
        player_id=payload.player_id,
    )


@router.post("/round/{round_id}/batch", response_model=AttendanceSummaryResponse)
async def set_admin_attendance_batch(
    round_id: int,
    payload: AdminAttendanceBatchRequest,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(user_has_permission),
):
    admin_id = current_user["id_user"] if isinstance(current_user, dict) else current_user.id_user
    service = AttendanceService(AttendanceRepository(db))
    return await service.set_admin_attendance_batch(
        round_id=round_id,
        items=payload.items,
        admin_user_id=admin_id,
    )


@router.delete("/round/{round_id}/player/{player_id}", status_code=status.HTTP_204_NO_CONTENT)
async def remove_player_attendance(
    round_id: int,
    player_id: int,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(user_has_permission),
):
    service = AttendanceService(AttendanceRepository(db))
    removed = await service.remove_attendance(round_id=round_id, player_id=player_id)
    if not removed:
        raise HTTPException(status_code=404, detail="Registro de presença não encontrado.")
    return
