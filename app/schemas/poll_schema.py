from datetime import datetime
from typing import List, Optional
from pydantic import BaseModel, ConfigDict


class PollOptionBase(BaseModel):
    title: str
    description: Optional[str] = None


class PollOptionCreate(PollOptionBase):
    pass


class PollOptionRead(PollOptionBase):
    id_option: int
    poll_id: int
    votes_count: int = 0
    percentage: float = 0.0

    model_config = ConfigDict(from_attributes=True)


class PollCreate(BaseModel):
    season_id: int
    title: str
    description: Optional[str] = None
    multiple_choices: bool = False
    starts_at: Optional[datetime] = None
    ends_at: Optional[datetime] = None
    options: List[PollOptionCreate]


class PollUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    is_active: Optional[bool] = None
    multiple_choices: Optional[bool] = None
    starts_at: Optional[datetime] = None
    ends_at: Optional[datetime] = None


class PollVoteRequest(BaseModel):
    option_ids: List[int]


class PollRead(BaseModel):
    id_poll: int
    season_id: int
    title: str
    description: Optional[str] = None
    is_active: bool = True
    multiple_choices: bool = False
    starts_at: Optional[datetime] = None
    ends_at: Optional[datetime] = None
    created_by_user_id: Optional[int] = None
    created_at: Optional[datetime] = None
    options: List[PollOptionRead] = []
    total_votes: int = 0
    has_voted: bool = False
    user_voted_option_ids: List[int] = []

    model_config = ConfigDict(from_attributes=True)
