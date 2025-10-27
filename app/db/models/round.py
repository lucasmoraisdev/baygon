from datetime import datetime
from MySQLdb import Date
from git import TYPE_CHECKING
from sqlalchemy import ForeignKey, Mapped, mapped_column, Integer, String, DateTime, func
from sqlalchemy.orm import relationship
from app.db.base import Base, Timestamp

if TYPE_CHECKING:
    from app.db.models.team import Teams
    from app.db.models.season import Seasons
    from app.db.models.match import Match
    from app.db.models.award import Awards
    from app.db.models.player_score import PlayerScore

class Round(Base, Timestamp):
    __tablename__ = "round"

    id_round = Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    date: Mapped[Date] = mapped_column(DateTime(timezone=True), nullable=False)
    location: Mapped[str] = mapped_column(String(255), nullable=False)
    referee: Mapped[str] = mapped_column(String(255), nullable=False)
    initial_time: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=True)
    end_time: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=True)
    round_number: Mapped[int] = mapped_column(Integer, nullable=False)
    season_id: Mapped[int] = mapped_column(ForeignKey("seasons.id_season"), nullable=False)

    teams: Mapped[list["Teams"]] = relationship("Teams", back_populates="round", cascade="all, delete-orphan")
    season: Mapped["Seasons"] = relationship("Seasons", back_populates="round")

    matches: Mapped[list["Match"]] = relationship("Match", back_populates="round", cascade="all, delete-orphan")

    premiacoes: Mapped[list["Awards"]] = relationship("Awards", back_populates="round", cascade="all, delete-orphan")

    player_scores: Mapped[list["PlayerScore"]] = relationship(
        "PlayerScore", back_populates="round", cascade="all, delete-orphan"
    )

    @property
    def duration(self):
        if self.initial_time and self.end_time:
            return self.end_time - self.initial_time
        return None

    def __repr__(self):
        return f"<GameDay(id={self.id_round}, date={self.date}, location={self.location})>"