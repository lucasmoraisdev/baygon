from typing import Optional, List
from pydantic import BaseModel
from datetime import datetime

from app.core.enum.events_enum import EventTypeEnum

class AwardBase(BaseModel):
    """
    Campos principais de uma premiação.
    """
    round_id: int
    event_type: EventTypeEnum

class AwardCreate(AwardBase):
    """
    Schema usado para criação de uma nova premiação.
    """
    player_ids: Optional[List[int]] = []
    team_ids: Optional[List[int]] = []


class AwardUpdate(BaseModel):
    """
    Schema usado para atualização parcial de uma premiação existente.
    """
    round_id: Optional[int] = None
    event_type: Optional[EventTypeEnum] = None
    player_ids: Optional[List[int]] = None
    team_ids: Optional[List[int]] = None

class AwardRead(AwardBase):
    """
    Schema de retorno completo de uma premiação,
    incluindo relacionamentos.
    """
    id_award: int
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

    # Relações
    players: Optional[List["PlayerRead"]] = []
    teams: Optional[List["TeamRead"]] = []

    class Config:
        orm_mode = True


from app.schemas.player_schema import PlayerRead
from app.schemas.team_schema import TeamRead

AwardRead.update_forward_refs()
