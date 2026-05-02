from typing import Optional, List
from datetime import datetime
from pydantic import BaseModel
from app.core.enum.events_enum import PosicaoEnum, PeEnum

class PlayerBase(BaseModel):
    nome: str
    apelido: Optional[str] = None
    email: Optional[str] = None
    telefone: Optional[str] = None
    posicao: Optional[PosicaoEnum] = None
    pe: Optional[PeEnum] = None
    potes: Optional[int] = None
    user_id: Optional[int] = None
    is_associate: bool = True
    is_guest: bool = False

class PlayerCreate(PlayerBase):
    pass


class PlayerUpdate(BaseModel):
    nome: Optional[str] = None
    apelido: Optional[str] = None
    email: Optional[str] = None
    telefone: Optional[str] = None
    posicao: Optional[PosicaoEnum] = None
    pe: Optional[PeEnum] = None
    potes: Optional[int] = None
    user_id: Optional[int] = None
    is_associate: Optional[bool] = None
    is_guest: Optional[bool] = None

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


class PlayerStatsRead(BaseModel):
    """Estatísticas gerais do jogador"""
    total_matches: int = 0
    total_wins: int = 0
    total_losses: int = 0
    total_draws: int = 0
    total_goals: int = 0
    total_assists: int = 0
    total_awards: int = 0
    total_seasons: int = 0


class SeasonStatsDetail(BaseModel):
    """Estatísticas de uma temporada específica"""
    season_id: int
    season_name: Optional[str] = None
    total_matches: int = 0
    total_wins: int = 0
    total_losses: int = 0
    total_draws: int = 0
    total_goals: int = 0
    total_assists: int = 0
    total_points: int = 0


class PlayerProfileRead(PlayerRead):
    """Perfil completo do jogador com estatísticas"""
    stats: PlayerStatsRead
    season_stats: List[SeasonStatsDetail] = []
    teams: List[TeamSummary] = []
    awards: List[AwardSummary] = []