from datetime import datetime
from typing import Optional, Literal
from pydantic import BaseModel, ConfigDict, Field

MediaType = Literal["youtube", "instagram", "tiktok", "other"]


class RoundMediaBase(BaseModel):
    url: str = Field(..., min_length=5, max_length=1000)
    title: Optional[str] = Field(None, max_length=255)
    media_type: Optional[str] = Field(None, max_length=50)
    description: Optional[str] = None


class RoundMediaCreate(RoundMediaBase):
    pass


class RoundMediaRead(BaseModel):
    id_round_media: int
    round_id: int
    media_type: str
    url: str
    title: Optional[str] = None
    description: Optional[str] = None
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

    model_config = ConfigDict(from_attributes=True)
