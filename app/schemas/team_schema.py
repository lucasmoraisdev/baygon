from typing import Optional
from pydantic import BaseModel


class TeamBase(BaseModel):
    name: str
    round_id: int

class TeamCreate(TeamBase):
    pass

class TeamUpdate(BaseModel):
    name: Optional[str] = None
    round_id: Optional[int] = None

class TeamRead(TeamBase):
    id_team: int
    players: Optional[list[int]] = []
    awards: Optional[list[int]] = []

    class Config:
        orm_mode = True
