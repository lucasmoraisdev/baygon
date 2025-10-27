from typing import Optional, Sequence
from sqlalchemy import or_
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from datetime import datetime, timezone


from app.db.models.match_event import MatchEvent

class MatchEventRepository:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def add_events(self, match_event: MatchEvent) -> MatchEvent:
        """
        Adiciona um evento a uma partida.
        """
        self.db.add(match_event)
        await self.db.commit()
        await self.db.refresh(match_event)
        return match_event
    
    async def list_events_from_match_id(self, match_id: int) -> Sequence[MatchEvent]:
        """
        Lista todos os eventos de uma partida.
        """
        stmt = select(MatchEvent).where(
            MatchEvent.match_id == match_id
        )
        result = await self.db.execute(stmt)
        return result.scalars().all()
    
    async def get_event_by_id(self, event_id: int) -> Optional[MatchEvent]:
        """
        Busca um evento de uma partida pelo seu id.
        """
        stmt = select(MatchEvent).where(
            MatchEvent.id_event == event_id
        )
        result = await self.db.execute(stmt)
        return result.scalar_one_or_none()

    async def edit_event(self, event_id: int, updates: dict) -> Optional[MatchEvent]:
        """
        Edita um evento de uma partida.
        """
        event = await self.get_event_by_id(event_id)
        if not event:
            return None
        for key, value in updates.items():
            if hasattr(event, key):
                setattr(event, key, value)
        event.updated_at = datetime.now(timezone.utc)
        await self.db.commit()
        await self.db.refresh(event)
        return event
    
    async def delete_event(self, event_id: int) -> bool:
        """
        Deleta um evento de uma partida.
        """
        event = await self.get_event_by_id(event_id)
        if not event:
            return False

        event.deleted_at = datetime.now(timezone.utc)
        await self.db.commit()
        return True