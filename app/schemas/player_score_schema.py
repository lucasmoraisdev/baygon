from typing import Optional
from pydantic import BaseModel
from datetime import datetime

class PlayerScoreBase(BaseModel):
    """
    Representa a pontuação de um jogador em uma rodada específica de uma temporada.
    """
    player_id: int
    round_id: int
    season_id: int
    points_individual: int
    points_team: int
    points_collaboration: int = 0
    extra_matches_won: int = 0
    extra_matches_drawn: int = 0
    extra_matches_lost: int = 0
    total_points: int

class PlayerScoreCreate(PlayerScoreBase):
    """
    Schema usado para criar um registro de pontuação de jogador.
    """
    pass


class PlayerScoreUpdate(BaseModel):
    """
    Schema usado para atualizar uma pontuação existente de jogador.
    """
    points_individual: Optional[int] = None
    points_team: Optional[int] = None
    points_collaboration: Optional[int] = None
    extra_matches_won: Optional[int] = None
    extra_matches_drawn: Optional[int] = None
    extra_matches_lost: Optional[int] = None
    total_points: Optional[int] = None

class PlayerScoreRead(PlayerScoreBase):
    """
    Schema de retorno completo de uma pontuação de jogador.
    """
    id_player_score: int
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

    class Config:
        orm_mode = True
