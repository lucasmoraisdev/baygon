from datetime import datetime
from typing import List, Optional
from pydantic import BaseModel, ConfigDict, Field

from app.core.enum.events_enum import EventTypeEnum


class AwardPlayerSummary(BaseModel):
    id_player: int
    nome: str
    apelido: Optional[str] = None

    model_config = ConfigDict(from_attributes=True)


class AwardTeamSummary(BaseModel):
    id_team: int
    name: str

    model_config = ConfigDict(from_attributes=True)


class AwardBase(BaseModel):
    """Campos principais de uma premiação."""
    round_id: int
    event_type: EventTypeEnum


class AwardCreate(AwardBase):
    """Schema usado para criação de uma nova premiação."""
    player_ids: Optional[List[int]] = Field(default_factory=list)
    team_ids: Optional[List[int]] = Field(default_factory=list)


class AwardUpdate(BaseModel):
    """Schema usado para atualização parcial de uma premiação existente."""
    round_id: Optional[int] = None
    event_type: Optional[EventTypeEnum] = None
    player_ids: Optional[List[int]] = None
    team_ids: Optional[List[int]] = None


class AwardRead(AwardBase):
    """Schema de retorno completo de uma premiação, incluindo relacionamentos."""
    id_award: int
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

    players: List[AwardPlayerSummary] = Field(default_factory=list)
    teams: List[AwardTeamSummary] = Field(default_factory=list)

    model_config = ConfigDict(from_attributes=True)


class RoundAwardEntry(BaseModel):
    event_type: EventTypeEnum
    player_ids: List[int] = Field(default_factory=list)
    team_ids: List[int] = Field(default_factory=list)


class RoundAwardsBatchRequest(BaseModel):
    recalculate_scores: bool = False
    awards: List[RoundAwardEntry] = Field(default_factory=list)
