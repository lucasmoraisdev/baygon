from typing import Optional
from pydantic import BaseModel, ConfigDict, computed_field
from app.core.enum.events_enum import EventTypeEnum


class MatchEventBase(BaseModel):
    match_id: int
    player_id: Optional[int] = None
    event_type: EventTypeEnum
    play_id: Optional[int] = None


class MatchEventCreate(MatchEventBase):
    """Schema para criação de evento em uma partida."""
    pass


class MatchEventUpdate(BaseModel):
    """Schema para atualização de evento em uma partida."""
    event_type: Optional[EventTypeEnum] = None
    player_id: Optional[int] = None
    play_id: Optional[int] = None


class MatchEventRead(MatchEventBase):
    """Schema de leitura (retorno de API)."""
    id_event: int

    model_config = ConfigDict(from_attributes=True)

    @computed_field
    @property
    def id_match_event(self) -> int:
        return self.id_event
