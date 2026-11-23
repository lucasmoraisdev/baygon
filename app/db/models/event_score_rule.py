from typing import TYPE_CHECKING, Optional
from sqlalchemy import Enum, ForeignKey, Integer, String
from sqlalchemy.orm import Mapped, mapped_column, relationship
from streamlit import context
from app.core.enum.events_enum import EventContextEnum, EventTypeEnum
from app.db.base import Base, Timestamp
from app.db.tenant_mixin import TenantMixin

if TYPE_CHECKING:
    from app.db.models.season import Seasons

class EventScoreRule(Base, Timestamp, TenantMixin):
    __tablename__ = "event_score_rules"

    id_event_score_rule: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    season_id: Mapped[int] = mapped_column(ForeignKey("seasons.id_season"), nullable=False)
    event_type: Mapped[EventTypeEnum] = mapped_column(Enum(EventTypeEnum), nullable=False)
    points: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    context: Mapped[EventContextEnum] = mapped_column(Enum(EventContextEnum), nullable=False)
    tenant_id: Mapped[Optional[str]] = mapped_column(String(36), index=True, nullable=True)

    # relacionamento ORM
    season: Mapped["Seasons"] = relationship(
        "Seasons", 
        back_populates="event_score_rules"
    )

    def __repr__(self):
        return f"<EventScoreRule(season_id={self.season_id}, event_type={self.event_type}, points={self.points})>"