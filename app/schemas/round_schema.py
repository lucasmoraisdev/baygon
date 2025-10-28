from typing import Optional, List
from datetime import datetime
from pydantic import BaseModel, Field

class TeamSummary(BaseModel):
    id_team: int
    name: str

    class Config:
        orm_mode = True

class MatchSummary(BaseModel):
    id: int
    home_team_id: int
    away_team_id: int
    home_score: int
    away_score: int

    class Config:
        orm_mode = True

class AwardSummary(BaseModel):
    id_award: int
    event_type: str

    class Config:
        orm_mode = True

class PlayerScoreSummary(BaseModel):
    id_player_score: int
    total_points: int
    player_id: int

    class Config:
        orm_mode = True

class RoundBase(BaseModel):
    date: datetime
    location: str
    referee: str
    initial_time: Optional[datetime] = None
    end_time: Optional[datetime] = None
    round_number: int
    season_id: int


class RoundCreate(RoundBase):
    pass


class RoundUpdate(BaseModel):
    date: Optional[datetime] = None
    location: Optional[str] = None
    referee: Optional[str] = None
    initial_time: Optional[datetime] = None
    end_time: Optional[datetime] = None
    round_number: Optional[int] = None

class RoundRead(RoundBase):
    id_round: int
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

    class Config:
        orm_mode = True

class RoundWithTeamsRead(RoundRead):
    teams: List[TeamSummary] = []


class RoundWithMatchesRead(RoundRead):
    matches: List[MatchSummary] = []


class RoundWithAwardsRead(RoundRead):
    premiacoes: List[AwardSummary] = []


class RoundFullRead(RoundRead):
    """
    Retorna a rodada completa com todos os relacionamentos:
    teams, matches, awards e player_scores
    """
    teams: List[TeamSummary] = []
    matches: List[MatchSummary] = []
    premiacoes: List[AwardSummary] = []
    player_scores: List[PlayerScoreSummary] = []
