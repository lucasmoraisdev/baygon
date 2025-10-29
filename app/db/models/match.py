from typing import TYPE_CHECKING, Optional

from app.core.enum.events_enum import EventTypeEnum
from app.db.base import Base, Timestamp
from sqlalchemy import Enum, ForeignKey, Integer
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.models.user import User

if TYPE_CHECKING:
    from app.db.models.round import Round
    from app.db.models.team import Teams
    from app.db.models.match_event import MatchEvent

class Match(Base, Timestamp):
    __tablename__ = "matches"

    id_match: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    round_id: Mapped[int] = mapped_column(ForeignKey("round.id_round"), nullable=False)
    home_team_id: Mapped[int] = mapped_column(ForeignKey("teams.id_team"), nullable=False)
    away_team_id: Mapped[int] = mapped_column(ForeignKey("teams.id_team"), nullable=False)

    filmed_by: Mapped[User] = mapped_column(ForeignKey("users.id_user"), nullable=False)
    event_type: Mapped[EventTypeEnum] = mapped_column(Enum(EventTypeEnum), nullable=False)

    score_home: Mapped[int] = mapped_column(Integer, default=0)
    score_away: Mapped[int] = mapped_column(Integer, default=0)

    round: Mapped["Round"] = relationship(
        "Round", 
        back_populates="matches"
    )
    home_team: Mapped["Teams"] = relationship(
        "Teams", 
        foreign_keys=[home_team_id]
    )
    away_team: Mapped["Teams"] = relationship(
        "Teams", 
        foreign_keys=[away_team_id]
    )
    filmed_by_user: Mapped["User"] = relationship(
        "User",
        back_populates="matches_filmed"
    )

    events: Mapped[list["MatchEvent"]] = relationship(
        "MatchEvent",
        back_populates="match",
        cascade="all, delete-orphan"
    )
    

    def __repr__(self):
        return f"<Match(id={self.id_match}, round={self.round_id}, home={self.home_team_id}, away={self.away_team_id}, result={self.result})>"
