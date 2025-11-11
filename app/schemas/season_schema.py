from datetime import datetime
from typing import List, Optional
from pydantic import BaseModel

class RoundSummary(BaseModel):
    id_round: int
    round_number: int
    date: datetime

    class Config:
        orm_mode = True

class PlayerScoreSummary(BaseModel):
    id_player_score: int
    player_id: int
    total_points: int

    class Config:
        orm_mode = True

class PlayerSeasonScoreSummary(BaseModel):
    id_player_season_score: int
    player_id: int
    total_points: int

    class Config:
        orm_mode = True

class SeasonBase(BaseModel):
    initial_date: datetime
    end_date: datetime

class SeasonCreate(SeasonBase):
    pass

class SeasonUpdate(BaseModel):
    initial_date: Optional[datetime] = None
    end_date: Optional[datetime] = None

class SeasonRead(SeasonBase):
    id_season: int
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None
    number: int

    class Config:
        orm_mode = True

class SeasonWithRoundsRead(SeasonRead):
    rounds: List[RoundSummary] = []

class SeasonWithPlayerScoresRead(SeasonRead):
    player_scores: List[PlayerScoreSummary] = []

class SeasonWithPlayerSeasonScoresRead(SeasonRead):
    player_season_scores: List[PlayerSeasonScoreSummary] = []

class SeasonFullRead(SeasonRead):
    rounds: List[RoundSummary] = []
    player_scores: List[PlayerScoreSummary] = []
    player_season_scores: List[PlayerSeasonScoreSummary] = []
