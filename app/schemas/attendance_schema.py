from datetime import datetime
from typing import Literal, Optional
from pydantic import BaseModel, ConfigDict

AttendanceStatus = Literal["confirmed", "declined", "waiting"]


class AttendancePlayerSummary(BaseModel):
    id_player: int
    nome: str
    apelido: Optional[str] = None
    potes: Optional[int] = None
    posicao: Optional[str] = None
    is_associate: bool = True
    is_guest: bool = False

    model_config = ConfigDict(from_attributes=True)


class AttendanceRead(BaseModel):
    id_attendance: int
    round_id: int
    player_id: int
    status: str
    note: Optional[str] = None
    updated_by_user_id: Optional[int] = None
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None
    player: Optional[AttendancePlayerSummary] = None

    model_config = ConfigDict(from_attributes=True)


class MyAttendanceRequest(BaseModel):
    status: AttendanceStatus = "confirmed"
    note: Optional[str] = None
    player_id: Optional[int] = None


class AdminAttendanceItem(BaseModel):
    player_id: int
    status: AttendanceStatus = "confirmed"
    note: Optional[str] = None


class AdminAttendanceBatchRequest(BaseModel):
    items: list[AdminAttendanceItem]


class AttendanceSummaryResponse(BaseModel):
    round_id: int
    confirmed_count: int
    declined_count: int
    waiting_count: int
    items: list[AttendanceRead]
