from typing import Optional, Sequence
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models import User
from datetime import datetime, timezone

class UserRepository:
    def __init__(self, db: AsyncSession):
        self.db = db
    
    async def get_by_username(self, username: str) -> User | None:
        """
        Busca um usuario pelo seu username
        """
        stmt = select(User).where(
            User.username == username,
            User.deleted_at.is_(None)
        )
        result = await self.db.execute(stmt)
        return result.scalar_one_or_none()

    async def create(self, user: User) -> User:
        """
        Cria um novo usuario.
        """
        self.db.add(user)
        await self.db.commit()
        await self.db.refresh(user)
        return user
    
    async def update(self, iduser: int, updates: dict) -> Optional[User]:
        """
        Atualizar os campos de um usuario ativo.
        Ignora usuarios deletados.
        """
        user = await self.get_by_id(iduser)
        if not user:
            return None
        
        for field, value in updates.items():
            if hasattr(user, field):
                setattr(user, field, value)
        
        user.updated = datetime.now(timezone.utc)
        await self.db.commit()
        await self.db.refresh(user)
        return user
    
    async def list_all_users(self) -> Sequence[User]:
        """
        Lista todos os usuarios.
        """
        stmt = select(User)
        result = await self.db.execute(stmt)
        users = result.scalars().all()
        return users
    
    async def list_all_active_users(self) -> Sequence[User]:
        """
        Lista todos os usuarios ativos.
        """
        stmt = select(User).where(
            User.deleted_at.is_(None)
        ).order_by(User.created_at.desc())
        result = await self.db.execute(stmt)
        users = result.scalars().all()
        return users
    
    async def list_all_deleted_users(self) -> Sequence[User]:
        """
        Lista todos os usuarios deletados.
        """
        stmt = select(User).where(
            User.deleted_at.isnot(None)
        ).order_by(User.created_at.desc())
        result = await self.db.execute(stmt)
        users = result.scalars().all()
        return users
    
    async def get_by_id(self, iduser: int) -> User | None:
        """
        Busca um usuario (ativo) pelo seu id.
        """
        stmt = select(User).where(
            User.iduser == iduser,
            User.deleted_at.is_(None)
        )
        result = await self.db.execute(stmt)
        return result.scalar_one_or_none()
        
    async def delete_user(self, iduser: int) -> bool:
        """
        Marca um usuario como deletado (soft delete).
        Retorna falso caso o usuario nao exista.
        """
        user = await self.get_by_id(iduser)
        if not user:
            return False
        
        user.deleted_at = datetime.now(timezone.utc)
        
        await self.db.commit()
        return True