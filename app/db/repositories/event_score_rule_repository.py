from datetime import datetime, timezone
from typing import Optional, Sequence
from sqlalchemy import or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models.event_score_rule import EventScoreRule

class EventScoreRuleRepository:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def create(self, event_score_rule: EventScoreRule) -> EventScoreRule:
        """
        Cria uma nova regra de pontuação de evento.
        """
        self.db.add(event_score_rule)
        await self.db.commit()
        await self.db.refresh(event_score_rule)
        return event_score_rule
    
    async def get_by_id(self, id_event_score_rule: int) -> Optional[EventScoreRule]:
        """
        Busca uma regra de pontuação de evento pelo seu id.
        """
        stmt = select(EventScoreRule).where(
            EventScoreRule.id_event_score_rule == id_event_score_rule
        )
        result = await self.db.execute(stmt)
        return result.scalar_one_or_none()
    
    async def list_by_season(self, season_id: int) -> Sequence[EventScoreRule]:
        """
        Lista todas as regras de pontuação de evento de uma temporada.
        """
        stmt = select(EventScoreRule).where(
            EventScoreRule.season_id == season_id
        )
        result = await self.db.execute(stmt)
        return result.scalars().all()
    
    async def update(self, id_event_score_rule: int, updates: dict) -> Optional[EventScoreRule]:
        """
        Atualiza uma regra de pontuação de evento.
        """
        event_score_rule = await self.get_by_id(id_event_score_rule)
        if not event_score_rule:
            return None
        for key, value in updates.items():
            if hasattr(event_score_rule, key):
                setattr(event_score_rule, key, value)
        event_score_rule.updated_at = datetime.now(timezone.utc)
        await self.db.commit()
        await self.db.refresh(event_score_rule)
        return event_score_rule
    
    async def delete(self, id_event_score_rule: int) -> bool:
        """
        Deleta uma regra de pontuação de evento.
        """
        event_score_rule = await self.get_by_id(id_event_score_rule)
        if not event_score_rule:
            return False
        
        event_score_rule.deleted_at = datetime.now(timezone.utc)
        await self.db.commit()
        return True
        