from typing import Optional
from pydantic import BaseModel
from datetime import datetime
from app.core.enum.events_enum import EventTypeEnum, EventContextEnum

class EventScoreRuleBase(BaseModel):
    """
    Representa a regra de pontuação base para um tipo de evento dentro de uma temporada.
    """
    season_id: int
    event_type: EventTypeEnum
    context: EventContextEnum
    points: int


class EventScoreRuleCreate(EventScoreRuleBase):
    """
    Schema usado para criar uma nova regra de pontuação.
    """
    pass

class EventScoreRuleUpdate(BaseModel):
    """
    Schema usado para atualizar uma regra de pontuação existente.
    """
    season_id: Optional[int] = None
    event_type: Optional[EventTypeEnum] = None
    context: Optional[EventContextEnum] = None
    points: Optional[int] = None

class EventScoreRuleRead(EventScoreRuleBase):
    """
    Schema de retorno completo de uma regra de pontuação.
    """
    id_event_score_rule: int
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

    class Config:
        orm_mode = True
