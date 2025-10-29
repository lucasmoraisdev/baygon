from git import TYPE_CHECKING
from sqlalchemy import ForeignKey, Column, Integer, String, Boolean, DateTime, func
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.db.base import Base, Timestamp
from datetime import datetime, timezone

if TYPE_CHECKING:
    from app.db.models.round import Round
    from app.db.models.player import Player
    from app.db.models.award import Awards


class Teams(Base, Timestamp):
    __tablename__ = "teams"

    id_team: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    round_id: Mapped[int] = mapped_column(ForeignKey("round.id_round", nullable=False))

    round: Mapped["Round"] = relationship("Round", back_populates="teams")
    players: Mapped[list["Player"]] = relationship(
        "Player",
        secondary="team_players",
        back_populates="teams"
    )
    awards: Mapped[list["Awards"]] = relationship(
        "Awards",
        secondary="award_teams",
        back_populates="teams"
    )

    def __repr__(self):
        return f"<Team(id={self.id_team}, name='{self.name}', round_id={self.id_round})>"