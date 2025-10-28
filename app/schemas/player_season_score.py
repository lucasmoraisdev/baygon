from typing import Optional
from pydantic import BaseModel
from datetime import datetime

class PlayerSeasonScoreBase(BaseModel):
    """
    Representa a pontuação total de um jogador em uma temporada.
    """
    player_id: int
    season_id: int
    total_points: int

class PlayerSeasonScoreCreate(PlayerSeasonScoreBase):
    """
    Schema usado para criar um registro de pontuação de jogador em uma temporada.
    """
    pass


class PlayerSeasonScoreUpdate(BaseModel):
    """
    Schema usado para atualizar uma pontuação de jogador na temporada.
    """
    total_points: Optional[int] = None

class PlayerSeasonScoreRead(PlayerSeasonScoreBase):
    """
    Schema de retorno completo da pontuação do jogador em uma temporada.
    """
    id_player_season_score: int
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

    class Config:
        orm_mode = True
