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
