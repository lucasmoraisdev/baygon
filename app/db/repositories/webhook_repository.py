from typing import Optional
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from app.db.models.webhook_event import WebhookEvent


class WebhookRepository:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def get_by_event_id(self, event_id: str) -> Optional[WebhookEvent]:
        """Busca evento pelo ID do gateway para validação de idempotência."""
        stmt = select(WebhookEvent).where(WebhookEvent.event_id == event_id)
        result = await self.db.execute(stmt)
        return result.scalars().first()

    async def create_event(
        self,
        event_id: str,
        gateway: str,
        event_type: str,
        status: str = "processed",
        payload: Optional[str] = None,
        error_message: Optional[str] = None,
    ) -> WebhookEvent:
        event = WebhookEvent(
            event_id=event_id,
            gateway=gateway,
            event_type=event_type,
            status=status,
            payload=payload,
            error_message=error_message,
        )
        self.db.add(event)
        await self.db.commit()
        await self.db.refresh(event)
        return event

    async def update_status(
        self,
        event_id: str,
        status: str,
        error_message: Optional[str] = None,
    ) -> Optional[WebhookEvent]:
        event = await self.get_by_event_id(event_id)
        if event:
            event.status = status
            event.error_message = error_message
            await self.db.commit()
            await self.db.refresh(event)
        return event
