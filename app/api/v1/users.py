from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from typing import List

from app.core.services.user_service import UserService
from app.db.models.user import User
from app.db.repositories.user_repository import UserRepository
from app.db.base import get_db
from app.schemas.user_schema import UserCreate, UserRead, UserUpdate

router = APIRouter(prefix="/users", tags=["Users"])

@router.get("/", response_model=List[UserRead])
async def list_users(db: AsyncSession = Depends(get_db)):
    repo = UserRepository(db)
    users = await repo.list_all_users()
    return users

@router.post("/", response_model=UserRead, status_code=status.HTTP_201_CREATED)
async def create_user(user_create: UserCreate, db: AsyncSession = Depends(get_db)):
    repo = UserRepository(db)
    service = UserService(repo)
    return await service.create_user_with_invite(user_create.model_dump())

@router.get("/{user_id}", response_model=UserRead)
async def get_user(user_id: int, db: AsyncSession = Depends(get_db)):
    repo = UserRepository(db)
    user = await repo.get_by_id(user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return user

@router.put("/{user_id}", response_model=UserRead)
async def update_user(user_id: int, user_update: UserUpdate, db: AsyncSession = Depends(get_db)):
    repo = UserRepository(db)
    user = await repo.update(user_id, user_update.dict(exclude_unset=True))
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return user

@router.delete("/{user_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_user(user_id: int, db: AsyncSession = Depends(get_db)):
    repo = UserRepository(db)
    deleted = await repo.delete_user(user_id)
    if not deleted:
        raise HTTPException(status_code=404, detail="User not found")
