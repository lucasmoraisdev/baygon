from pydantic import BaseModel, EmailStr
from typing import Optional, List
from datetime import datetime

from app.schemas.player_schema import PlayerRead

class UserBase(BaseModel):
    name: str
    email: EmailStr
    username: str
    phone_number: str
    is_admin: bool = False

class UserCreate(UserBase):
    password: str
    setup_token: Optional[str] = None

class UserUpdate(BaseModel):
    name: Optional[str] = None
    email: Optional[EmailStr] = None
    username: Optional[str] = None
    password: Optional[str] = None
    phone_number: Optional[str] = None
    is_admin: Optional[bool] = None
    setup_token: Optional[str] = None

class UserRead(UserBase):
    id_user: int
    setup_token: str
    created_at: datetime
    updated_at: datetime

    players: Optional[List[PlayerRead]] = None 

    class Config:
        orm_mode = True


class UserInvite(UserRead):
    invite_link: str