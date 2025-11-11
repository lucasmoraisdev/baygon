from typing import Optional, Sequence
from sqlalchemy import or_, select
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
    
    async def get_by_identifier(self, identifier: str) -> User | None:
        """
        Busca um usuario pelo seu identifier (email, telefone, username)
        """
        stmt = select(User).where(
            or_(
                User.email == identifier,
                User.phone_number == identifier,
                User.username == identifier
            ),
            User.deleted_at.is_(None)
        )
        result = await self.db.execute(stmt)
        return result.scalar_one_or_none()

    async def get_by_email(self, email: str) -> User | None:
        """
        Busca um usuario pelo seu email
        """
        stmt = select(User).where(
            User.email == email,
            User.deleted_at.is_(None)
        )
        result = await self.db.execute(stmt)
        return result.scalar_one_or_none()
    
    async def validate_if_user_data_exists(self, username: str, phone_number: str, email: str) -> bool:
        """
        Verifica se algum dos dados unicos de
        um usuario (ativo) ja existe
        """
        stmt = select(User).where(
            or_(
                User.email == email,
                User.username == username,
                User.phone_number == phone_number
            ),
            User.deleted_at.is_(None)
        )
        result = await self.db.execute(stmt)
    
        return result.scalar_one_or_none() is not None

    async def get_by_phone_number(self, phone_number: str) -> User | None:
        """
        Busca um usuario pelo seu phone_number
        """
        stmt = select(User).where(
            User.phone_number == phone_number,
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
            User.id_user == iduser,
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
    
    async def get_by_setup_token(self, setup_token: str) -> User | None:
        """
        Busca um usuario pelo seu token de setup.
        """
        stmt = select(User).where(
            User.setup_token == setup_token,
            User.deleted_at.is_(None)
        )
        result = await self.db.execute(stmt)
        return result.scalar_one_or_none()
    
    async def update_password(self, iduser: int, new_password: str, is_finishing_registration: bool = False) -> Optional[User]:
        """
        Altera a senha de um usuario.
        """
        user = await self.get_by_id(iduser)
        if not user:
            return None
        
        user.password = new_password
        user.updated_at = datetime.now(timezone.utc)

        if is_finishing_registration:
            user.setup_token = None
            user.invite_token_expires = None
        await self.db.commit()
        await self.db.refresh(user)
        return user

        