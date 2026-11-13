from typing import Optional
from pydantic import BaseModel, ConfigDict, Field, computed_field

from app.core.enum.events_enum import EventTypeEnum
from app.schemas.match_event_schema import (
    MatchEventCreate,
    MatchEventRead,
    MatchEventUpdate,
)


class MatchCreate(BaseModel):
    round_id: int
    home_team_id: int
    away_team_id: int
    filmed_by_id: Optional[int] = None
    filmed_by: Optional[int] = None
    filmed_by_player_id: Optional[int] = None
    home_score: Optional[int] = Field(None, ge=0)
    away_score: Optional[int] = Field(None, ge=0)
    score_home: Optional[int] = Field(None, ge=0)
    score_away: Optional[int] = Field(None, ge=0)
    event_type: Optional[EventTypeEnum] = None
    events: Optional[list[MatchEventCreate]] = []


class MatchUpdate(BaseModel):
    round_id: Optional[int] = None
    home_team_id: Optional[int] = None
    away_team_id: Optional[int] = None
    home_score: Optional[int] = Field(None, ge=0)
    away_score: Optional[int] = Field(None, ge=0)
    score_home: Optional[int] = Field(None, ge=0)
    score_away: Optional[int] = Field(None, ge=0)
    filmed_by_id: Optional[int] = None
    filmed_by: Optional[int] = None
    filmed_by_player_id: Optional[int] = None
    event_type: Optional[EventTypeEnum] = None
    events: Optional[list[MatchEventUpdate]] = []


class MatchRead(BaseModel):
    id_match: int
    round_id: int
    home_team_id: int
    away_team_id: int
    filmed_by: int
    event_type: EventTypeEnum
    score_home: int = 0
    score_away: int = 0
    events: Optional[list[MatchEventRead]] = []
    filmed_by_user: Optional[object] = Field(default=None, exclude=True)

    model_config = ConfigDict(from_attributes=True)

    @computed_field
    @property
    def id(self) -> int:
        return self.id_match

    @computed_field
    @property
    def home_score(self) -> int:
        return self.score_home

    @computed_field
    @property
    def away_score(self) -> int:
        return self.score_away

    @computed_field
    @property
    def filmed_by_player_id(self) -> Optional[int]:
        u = getattr(self, "filmed_by_user", None)
        if u is not None:
            players = getattr(u, "players", None) or []
            if players:
                return getattr(players[0], "id_player", None)
        return None

    @computed_field
    @property
    def filmed_by_name(self) -> Optional[str]:
        u = getattr(self, "filmed_by_user", None)
        if u is not None:
            players = getattr(u, "players", None) or []
            if players:
                p = players[0]
                return getattr(p, "apelido", None) or getattr(p, "nome", None)
            return getattr(u, "name", None)
        return None