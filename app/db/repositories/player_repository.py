from datetime import datetime, timezone
from typing import Optional, Sequence
from sqlalchemy import or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models.player import Player

class PlayerRepository:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def create(self, player: Player) -> Player:
        """
        Cria um novo jogador.
        """
        self.db.add(player)
        await self.db.commit()
        await self.db.refresh(player)
        return player
    
    async def list_all_players(self) -> Sequence[Player]:
        """
        Lista todos os jogadores.
        """
        stmt = select(Player)
        result = await self.db.execute(stmt)
        return result.scalars().all()
    
    async def get_by_id(self, id_player: int) -> Optional[Player]:
        """
        Busca um jogador pelo seu id.
        """
        stmt = select(Player).where(
            Player.id_player == id_player
        )
        result = await self.db.execute(stmt)
        return result.scalar_one_or_none()
    
    async def update_player(self, id_player: int, updates: dict) -> Optional[Player]:
        """
        Atualiza um jogador.
        """
        player = await self.get_by_id(id_player)
        if not player:
            return None
        for key, value in updates.items():
            if hasattr(player, key):
                setattr(player, key, value)
        player.updated_at = datetime.now(timezone.utc)
        await self.db.commit()
        await self.db.refresh(player)
        return player
    
    async def delete_player(self, id_player: int) -> bool:
        """
        Deleta um jogador.
        """
        player = await self.get_by_id(id_player)
        if not player:
            return False
        
        player.deleted_at = datetime.now(timezone.utc)
        await self.db.commit()
        return True