from typing import TYPE_CHECKING, Optional

from app.core.enum.events_enum import EventTypeEnum
from app.db.base import Base, Timestamp
from sqlalchemy import Enum, ForeignKey, Integer
from sqlalchemy.orm import Mapped, mapped_column, relationship

if TYPE_CHECKING:
    from app.db.models.match import Match
    from app.db.models.player import Player

class MatchEvent(Base, Timestamp):
    __tablename__ = "match_events"

    id_event: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    match_id: Mapped[int] = mapped_column(ForeignKey("matches.id_match"), nullable=False)
    player_id: Mapped[int] = mapped_column(ForeignKey("player.id_player"), nullable=False)
    event_type: Mapped[EventTypeEnum] = mapped_column(Enum(EventTypeEnum), nullable=False)

    play_id: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)

    match: Mapped["Match"] = relationship("Match", back_populates="events")
    player: Mapped["Player"] = relationship("Player", back_populates="events")

    def __repr__(self):
        return f"<MatchEvent(id={self.id_event}, match={self.match_id}, player={self.player_id}, type={self.event_type}, play_id={self.play_id})>"
