from typing import TYPE_CHECKING
from app.core.enum.events_enum import EventTypeEnum
from app.db.base import Base, Timestamp
from sqlalchemy import Enum, ForeignKey, Mapped, mapped_column, Integer
from sqlalchemy.orm import relationship

if TYPE_CHECKING:
    from app.db.models.round import Round
    from app.db.models.team import Teams
    from app.db.models.player import Player

class Awards(Base, Timestamp):
    __tablename__ = "awards"

    id_award: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    round_id: Mapped[int] = mapped_column(ForeignKey("round.id_round"), nullable=False)
    event_type: Mapped[EventTypeEnum] = mapped_column(Enum(EventTypeEnum), nullable=False)


    round: Mapped["Round"] = relationship("Round", back_populates="awards")
    teams: Mapped[list["Teams"]] = relationship(
        "Teams", 
        secondary="awards_teams",
        back_populates="awards"
    )
    players: Mapped[list["Player"]] = relationship(
        "Player", 
        secondary="awards_players",
        back_populates="awards"
    )