from datetime import datetime
from typing import TYPE_CHECKING
from app.db.base import Base, Timestamp
from sqlalchemy import Date, DateTime, Integer
from sqlalchemy.orm import Mapped, mapped_column, relationship

if TYPE_CHECKING:
    from app.db.models.round import Round
    from app.db.models.player_score import PlayerScore
    from app.db.models.player_season_score import PlayerSeasonScore

class Seasons(Base, Timestamp):
    __tablename__ = "seasons"

    id_season: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    number: Mapped[int] = mapped_column(Integer, nullable=False)
    initial_date: Mapped[Date] = mapped_column(DateTime(timezone=True), nullable=False)
    end_date: Mapped[Date] = mapped_column(DateTime(timezone=True), nullable=False)

    rounds: Mapped[list["Round"]] = relationship("Round", back_populates="seasons", cascade="all, delete-orphan")

    player_scores: Mapped[list["PlayerScore"]] = relationship(
        "PlayerScore", back_populates="seasons", cascade="all, delete-orphan"
    )
    player_season_scores: Mapped[list["PlayerSeasonScore"]] = relationship(
        "PlayerSeasonScore", back_populates="seasons", cascade="all, delete-orphan"
    )

    def __repr__(self):
        return f"<Season(id={self.id_season}, number={self.number}, initial_date={self.initial_date}, end_date={self.end_date})>"