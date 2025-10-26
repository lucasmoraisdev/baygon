from pydantic import BaseModel, EmailStr
from typing import Optional

class UserCreate(BaseModel):
    name: str
    email: EmailStr
    username: str
    password: str
    is_admin: bool = False
    setup_token: Optional[str] = None
    phone_number: Optional[str] = None

class UserOut(BaseModel): # schema de saida
    iduser: int
    name: str
    email: str
    username: str
    is_admin: bool
    setup_token: Optional[str] = None
    phone_number: Optional[str] = None

class UserInDB(UserOut): # usada em repositorio
    hashed_password: str