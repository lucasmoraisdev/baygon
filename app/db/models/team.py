from typing import Optional
from git import TYPE_CHECKING
from sqlalchemy import ForeignKey, Column, Integer, String, Boolean, DateTime, func
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.db.base import Base, Timestamp
from app.db.tenant_mixin import TenantMixin
from datetime import datetime, timezone

if TYPE_CHECKING:
    from app.db.models.round import Round
    from app.db.models.player import Player
    from app.db.models.award import Awards
    from app.db.models.season import Seasons


class Teams(Base, Timestamp, TenantMixin):
    __tablename__ = "teams"

    id_team: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    color: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)
    round_id: Mapped[Optional[int]] = mapped_column(ForeignKey("round.id_round"), nullable=True)
    season_id: Mapped[Optional[int]] = mapped_column(ForeignKey("seasons.id_season", ondelete="CASCADE"), nullable=True)
    group_name: Mapped[Optional[str]] = mapped_column(String(20), nullable=True)
    tenant_id: Mapped[Optional[str]] = mapped_column(String(36), index=True, nullable=True)

    round: Mapped[Optional["Round"]] = relationship(
        "Round", 
        back_populates="teams",
        foreign_keys=[round_id],
    )

    season: Mapped[Optional["Seasons"]] = relationship(
        "Seasons",
        back_populates="fixed_teams",
        foreign_keys=[season_id],
    )

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
        return f"<Team(id={self.id_team}, name='{self.name}', round_id={self.round_id})>"