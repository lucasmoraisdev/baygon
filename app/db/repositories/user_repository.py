from typing import Optional
from sqlalchemy.orm import Session
from app.db.models import User
from datetime import datetime, timezone

class UserRepository:
    def __init__(self, db: Session):
        self.db = db
    
    def get_by_username(self, username: str) -> User:
        """
        Busca um usuario pelo seu username
        """
        return self.db.query(User).filter(
            User.username == username,
            User.deleted_at.is_(None)
        ).first()

    def create(self, user: User) -> User:
        """
        Cria um novo usuario.
        """
        self.db.add(user)
        self.db.commit()
        self.db.refresh(user)
        return user
    
    def edit(self, iduser: int, updates: dict) -> Optional[User]:
        """
        Atualizar os campos de um usuario ativo.
        Ignora usuarios deletados.
        """
        user = self.get_by_id(iduser)
        if not user:
            return None
        
        for field, value in updates.items():
            if hasattr(user, field):
                setattr(user, field, value)
        
        user.updated = datetime.now(timezone.utc)
        self.db.commit()
        self.db.refresh(user)
        return user
    
    def list_all_users(self) -> list[User]:
        """
        Lista todos os usuarios.
        """
        return self.db.query(User).all()
    
    def list_all_active_users(self) -> list[User]:
        """
        Lista todos os usuarios ativos.
        """
        return (
            self.db.query(User)
                .filter(User.deleted_at.is_(None))
                .order_by(User.created_at.desc())
                .all()
        )
    
    def list_all_deleted_users(self) -> list[User]:
        """
        Lista todos os usuarios deletados.
        """
        return (
            self.db.query(User)
                .filter(User.deleted_at.isnot(None))
                .order_by(User.created_at.desc())
                .all()
        )
    
    def get_by_id(self, iduser: int) -> User:
        """
        Busca um usuario (ativo) pelo seu id.
        """
        return self.db.query(User).filter(
            User.iduser == iduser,
            User.deleted_at.is_(None)
        ).first()
        
    def delete_user(self, iduser: int) -> bool:
        """
        Marca um usuario como deletado (soft delete).
        Retorna falso caso o usuario nao exista.
        """
        user = self.get_by_id(iduser)
        if not user:
            return False
        
        user.deleted_at = datetime.now(timezone.utc)
        self.db.commit()
        return True