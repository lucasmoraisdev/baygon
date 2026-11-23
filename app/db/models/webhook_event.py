import uuid
from typing import Optional
from sqlalchemy import Column, Integer, String, Text, DateTime, func, Index
from sqlalchemy.orm import Mapped, mapped_column
from app.db.base import Base, Timestamp


class WebhookEvent(Base, Timestamp):
    __tablename__ = "webhook_events"

    id_webhook_event: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    event_id: Mapped[str] = mapped_column(String(100), unique=True, index=True, nullable=False)
    gateway: Mapped[str] = mapped_column(String(50), default="stripe", nullable=False)
    event_type: Mapped[str] = mapped_column(String(100), nullable=False, index=True)
    status: Mapped[str] = mapped_column(String(30), default="processed", nullable=False)  # processed, failed, ignored
    payload: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    error_message: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    def __repr__(self):
        return f"<WebhookEvent(event_id='{self.event_id}', gateway='{self.gateway}', type='{self.event_type}', status='{self.status}')>"
