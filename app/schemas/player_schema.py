from typing import Optional, List
from datetime import datetime
from pydantic import BaseModel

class PlayerBase(BaseModel):
    name: str
    user_id: Optional[int] = None
    is_associate: bool = True

class PlayerCreate(PlayerBase):
    pass


class PlayerUpdate(BaseModel):
    name: Optional[str] = None
    user_id: Optional[int] = None
    is_associate: Optional[bool] = None

class PlayerRead(PlayerBase):
    id_player: int
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

    class Config:
        orm_mode = True

class TeamSummary(BaseModel):
    id_team: int
    name: str

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
    round_id: int

    class Config:
        orm_mode = True


class PlayerSeasonScoreSummary(BaseModel):
    id_player_season_score: int
    total_points: int
    season_id: int

    class Config:
        orm_mode = True

class PlayerWithTeamsRead(PlayerRead):
    teams: List[TeamSummary] = []


class PlayerWithAwardsRead(PlayerRead):
    awards: List[AwardSummary] = []


class PlayerWithScoresRead(PlayerRead):
    scores: List[PlayerScoreSummary] = []
    season_scores: List[PlayerSeasonScoreSummary] = []


class PlayerFullRead(PlayerRead):
    """
    Retorna o jogador completo com todos os relacionamentos:
    teams, awards, scores e season_scores.
    """
    teams: List[TeamSummary] = []
    awards: List[AwardSummary] = []
    scores: List[PlayerScoreSummary] = []
    season_scores: List[PlayerSeasonScoreSummary] = []