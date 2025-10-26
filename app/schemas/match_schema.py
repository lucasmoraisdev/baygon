from typing import Optional
from pydantic import BaseModel, Field

from app.core.enum.events_enum import EventTypeEnum


class MatchEventBase(BaseModel):
    player_id: int
    event_type: EventTypeEnum

class MatchEventCreate(MatchEventBase):
    pass

class MatchEventUpdate(MatchEventBase):
    pass

class MatchEventRead(MatchEventBase):
    id: int

    class Config:
        orm_mode = True

class MatchBase(BaseModel):
    round_id: int
    home_team_id: int
    away_team_id: int
    filmed_by_id: Optional[int] = None
    home_score: Optional[int] = Field(0, ge=0)
    away_score: Optional[int] = Field(0, ge=0)

class MatchCreate(MatchBase):
    events: Optional[list[MatchEventCreate]] = []

class MatchUpdate(MatchBase):
    home_score: Optional[int] = None
    away_score: Optional[int] = None
    filmed_by_id: Optional[int] = None
    events: Optional[list[MatchEventUpdate]] = []

class MatchRead(MatchBase):
    id: int
    events: Optional[list[MatchEventRead]] = []

    class Config:
        orm_mode = True