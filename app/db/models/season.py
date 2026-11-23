from datetime import datetime
from typing import TYPE_CHECKING, Optional
from app.db.base import Base, Timestamp
from app.db.tenant_mixin import TenantMixin
from sqlalchemy import Date, DateTime, Integer, Boolean, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

if TYPE_CHECKING:
    from app.db.models.round import Round
    from app.db.models.player_score import PlayerScore
    from app.db.models.player_season_score import PlayerSeasonScore
    from app.db.models.event_score_rule import EventScoreRule
    from app.db.models.team import Teams

class Seasons(Base, Timestamp, TenantMixin):
    __tablename__ = "seasons"

    id_season: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    name: Mapped[Optional[str]] = mapped_column(String(150), nullable=True)
    number: Mapped[int] = mapped_column(Integer, nullable=False)
    tournament_format: Mapped[str] = mapped_column(String(30), default="individual_points", nullable=False)
    has_legs: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    teams_per_group: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    advancing_per_group: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    initial_date: Mapped[Date] = mapped_column(DateTime(timezone=True), nullable=False)
    end_date: Mapped[Date] = mapped_column(DateTime(timezone=True), nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    tenant_id: Mapped[Optional[str]] = mapped_column(String(36), index=True, nullable=True)

    rounds: Mapped[list["Round"]] = relationship(
        "Round", 
        back_populates="seasons", 
        cascade="all, delete-orphan"
    )

    fixed_teams: Mapped[list["Teams"]] = relationship(
        "Teams",
        back_populates="season",
        cascade="all, delete-orphan",
        foreign_keys="Teams.season_id",
    )

    player_scores: Mapped[list["PlayerScore"]] = relationship(
        "PlayerScore", 
        back_populates="seasons", 
        cascade="all, delete-orphan"
    )
    
    player_season_scores: Mapped[list["PlayerSeasonScore"]] = relationship(
        "PlayerSeasonScore", 
        back_populates="seasons",
         cascade="all, delete-orphan"
    )

    event_score_rules: Mapped[list["EventScoreRule"]] = relationship(
        "EventScoreRule", 
        back_populates="season",
         cascade="all, delete-orphan"
    )

    def __repr__(self):
        return f"<Season(id={self.id_season}, number={self.number}, initial_date={self.initial_date}, end_date={self.end_date})>"