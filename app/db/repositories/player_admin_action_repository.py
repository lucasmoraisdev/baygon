from datetime import datetime, timezone, timedelta
from typing import Optional, Sequence
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models.player_admin_action import PlayerAdminAction, AdminActionTypeEnum


class PlayerAdminActionRepository:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def create(self, action: PlayerAdminAction) -> PlayerAdminAction:
        """Cria uma nova ação administrativa."""
        self.db.add(action)
        await self.db.commit()
        await self.db.refresh(action)
        return action

    async def get_by_id(self, id_action: int) -> Optional[PlayerAdminAction]:
        """Busca uma ação por ID."""
        stmt = select(PlayerAdminAction).where(
            PlayerAdminAction.id_action == id_action
        )
        result = await self.db.execute(stmt)
        return result.scalar_one_or_none()

    async def get_player_actions(self, player_id: int) -> Sequence[PlayerAdminAction]:
        """Obtém todas as ações administrativas de um jogador."""
        stmt = select(PlayerAdminAction).where(
            PlayerAdminAction.player_id == player_id
        ).order_by(PlayerAdminAction.created_at.desc())
        result = await self.db.execute(stmt)
        return result.scalars().all()

    async def get_active_suspension(self, player_id: int) -> Optional[PlayerAdminAction]:
        """Obtém a suspensão ativa de um jogador, se existir."""
        from sqlalchemy import or_
        stmt = select(PlayerAdminAction).where(
            PlayerAdminAction.player_id == player_id,
            PlayerAdminAction.action_type == AdminActionTypeEnum.SUSPEND,
            PlayerAdminAction.is_active == True,
            or_(
                PlayerAdminAction.suspension_until > datetime.now(timezone.utc),
                PlayerAdminAction.suspension_until.is_(None)
            )
        ).order_by(PlayerAdminAction.id_action.desc()).limit(1)
        result = await self.db.execute(stmt)
        return result.scalar_one_or_none()

    async def get_is_blocked(self, player_id: int) -> bool:
        """Verifica se um jogador está bloqueado."""
        stmt = select(PlayerAdminAction).where(
            PlayerAdminAction.player_id == player_id,
            PlayerAdminAction.action_type == AdminActionTypeEnum.BLOCK,
            PlayerAdminAction.is_active == True
        ).limit(1)
        result = await self.db.execute(stmt)
        return result.scalar_one_or_none() is not None

    async def deactivate_block(self, player_id: int) -> bool:
        """Desativa o bloqueio de um jogador."""
        stmt = select(PlayerAdminAction).where(
            PlayerAdminAction.player_id == player_id,
            PlayerAdminAction.action_type == AdminActionTypeEnum.BLOCK,
            PlayerAdminAction.is_active == True
        )
        result = await self.db.execute(stmt)
        action = result.scalar_one_or_none()
        
        if not action:
            return False
        
        action.is_active = False
        action.updated_at = datetime.now(timezone.utc)
        await self.db.commit()
        return True

    async def update(self, id_action: int, updates: dict) -> Optional[PlayerAdminAction]:
        """Atualiza uma ação administrativa."""
        action = await self.get_by_id(id_action)
        if not action:
            return None
        
        for key, value in updates.items():
            if hasattr(action, key):
                setattr(action, key, value)
        
        action.updated_at = datetime.now(timezone.utc)
        await self.db.commit()
        await self.db.refresh(action)
        return action

    async def deactivate_suspension(self, player_id: int) -> bool:
        """Desativa a suspensão de um jogador (quando ela expira)."""
        stmt = select(PlayerAdminAction).where(
            PlayerAdminAction.player_id == player_id,
            PlayerAdminAction.action_type == AdminActionTypeEnum.SUSPEND,
            PlayerAdminAction.is_active == True,
            PlayerAdminAction.suspension_until <= datetime.now(timezone.utc)
        )
        result = await self.db.execute(stmt)
        action = result.scalar_one_or_none()
        
        if not action:
            return False
        
        action.is_active = False
        await self.db.commit()
        return True
