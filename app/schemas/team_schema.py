from typing import Optional
from pydantic import BaseModel, ConfigDict, Field


class TeamPlayerSummary(BaseModel):
    id_player: int
    nome: str
    apelido: Optional[str] = None
    potes: Optional[int] = None
    posicao: Optional[str] = None

    model_config = ConfigDict(from_attributes=True)


class TeamAwardSummary(BaseModel):
    id_award: int
    event_type: str

    model_config = ConfigDict(from_attributes=True)


class TeamBase(BaseModel):
    name: str
    round_id: int


class TeamCreate(TeamBase):
    player_ids: list[int] = []


class TeamUpdate(BaseModel):
    name: Optional[str] = None
    round_id: Optional[int] = None
    player_ids: Optional[list[int]] = None


class TeamRead(TeamBase):
    id_team: int
    players: Optional[list[TeamPlayerSummary]] = []
    awards: Optional[list[TeamAwardSummary]] = []

    model_config = ConfigDict(from_attributes=True)


class TeamDrawRequest(BaseModel):
    player_ids: list[int]
    num_teams: int = Field(4, ge=2, le=8)
    pote_overrides: dict[int, Optional[int]] = {}


class DrawnTeamSuggestion(BaseModel):
    slot: int
    name: str
    players: list[TeamPlayerSummary]


class TeamDrawResponse(BaseModel):
    teams: list[DrawnTeamSuggestion]
    unassigned_player_ids: list[int] = []


class RoundTeamInput(BaseModel):
    name: str
    player_ids: list[int] = []


class RoundTeamsBatchRequest(BaseModel):
    overwrite_existing: bool = False
    teams: list[RoundTeamInput]
