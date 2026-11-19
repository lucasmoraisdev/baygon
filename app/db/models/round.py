from datetime import datetime
from git import TYPE_CHECKING
from sqlalchemy import Boolean, Date, ForeignKey, Integer, String, DateTime, func
from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy.orm import relationship
from app.db.base import Base, Timestamp

if TYPE_CHECKING:
    from app.db.models.team import Teams
    from app.db.models.season import Seasons
    from app.db.models.match import Match
    from app.db.models.award import Awards
    from app.db.models.player_score import PlayerScore
    from app.db.models.round_award_vote import RoundAwardVoter, RoundAwardVote
    from app.db.models.round_media import RoundMedia

class Round(Base, Timestamp):
    __tablename__ = "round"

    id_round: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    date: Mapped[Date] = mapped_column(DateTime(timezone=True), nullable=False)
    location: Mapped[str] = mapped_column(String(255), nullable=False)
    referee: Mapped[str] = mapped_column(String(255), nullable=False)
    initial_time: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=True)
    end_time: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=True)
    round_number: Mapped[int] = mapped_column(Integer, nullable=False)
    season_id: Mapped[int] = mapped_column(ForeignKey("seasons.id_season"), nullable=False)
    is_voting_open: Mapped[bool] = mapped_column(Boolean, default=False, server_default="0", nullable=False)

    teams: Mapped[list["Teams"]] = relationship(
        "Teams", 
        back_populates="round", 
        cascade="all, delete-orphan"
    )
    
    seasons: Mapped["Seasons"] = relationship(
        "Seasons", 
        back_populates="rounds"  
    )

    matches: Mapped[list["Match"]] = relationship(
        "Match", 
        back_populates="round", 
        cascade="all, delete-orphan"
    )

    awards: Mapped[list["Awards"]] = relationship(
        "Awards", 
        back_populates="round", 
        cascade="all, delete-orphan"
    )

    player_scores: Mapped[list["PlayerScore"]] = relationship(
        "PlayerScore",
        back_populates="round", 
        cascade="all, delete-orphan"
    )

    voters: Mapped[list["RoundAwardVoter"]] = relationship(
        "RoundAwardVoter",
        back_populates="round",
        cascade="all, delete-orphan",
        lazy="selectin",
    )

    votes: Mapped[list["RoundAwardVote"]] = relationship(
        "RoundAwardVote",
        back_populates="round",
        cascade="all, delete-orphan",
        lazy="selectin",
    )

    media: Mapped[list["RoundMedia"]] = relationship(
        "RoundMedia",
        back_populates="round",
        cascade="all, delete-orphan",
        lazy="selectin",
    )

    @property
    def duration(self):
        if self.initial_time and self.end_time:
            return self.end_time - self.initial_time
        return None

    def __repr__(self):
        return f"<GameDay(id={self.id_round}, date={self.date}, location={self.location})>"