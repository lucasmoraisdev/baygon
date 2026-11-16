from datetime import datetime
from typing import List, Optional
from pydantic import BaseModel, ConfigDict, Field


class RoulettePrizeBase(BaseModel):
    name: str = Field(..., max_length=100)
    description: Optional[str] = Field(None, max_length=255)
    is_active: bool = True


class RoulettePrizeCreate(RoulettePrizeBase):
    pass


class RoulettePrizeUpdate(BaseModel):
    name: Optional[str] = Field(None, max_length=100)
    description: Optional[str] = Field(None, max_length=255)
    is_active: Optional[bool] = None


class RoulettePrizeRead(RoulettePrizeBase):
    id_roulette_prize: int
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

    model_config = ConfigDict(from_attributes=True)


class RoundRouletteWinnerItem(BaseModel):
    roulette_number: int = Field(1, ge=1, le=2)
    player_id: int
    prize_id: Optional[int] = None


class RoundRouletteWinnerRead(BaseModel):
    id_round_roulette: int
    round_id: int
    player_id: int
    prize_id: Optional[int] = None
    roulette_number: int = 1
    player_name: Optional[str] = None
    prize_name: Optional[str] = None

    model_config = ConfigDict(from_attributes=True)


class RoundRouletteBatchPayload(BaseModel):
    winners: List[RoundRouletteWinnerItem] = Field(default_factory=list)
