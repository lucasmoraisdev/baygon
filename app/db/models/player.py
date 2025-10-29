from typing import TYPE_CHECKING, Optional
from sqlalchemy import ForeignKey, Integer, String, Boolean, func
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.db.base import Base, Timestamp

from app.db.models.user import User

if TYPE_CHECKING:
    from app.db.models.team import Teams
    from app.db.models.match_event import MatchEvent
    from app.db.models.award import Awards
    from app.db.models.player_score import PlayerScore
    from app.db.models.player_season_score import PlayerSeasonScore


class Player(Base, Timestamp):
    __tablename__ = "players"

    id_player: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    nome: Mapped[str] = mapped_column(String(255), nullable=False)
    user_id: Mapped[Optional[int]] = mapped_column(ForeignKey("users.id_user"), nullable=True)
    is_associate: Mapped[bool] = mapped_column(Boolean, default=True)

    user: Mapped[Optional["User"]] = relationship(
        "User", 
        back_populates="players"
    )
    
    teams: Mapped[list["Teams"]] = relationship(
        "Teams",
        secondary="team_players",
        back_populates="players"
    )

    events: Mapped[list["MatchEvent"]] = relationship(
        "MatchEvent",
        back_populates="player",
        foreign_keys="MatchEvent.player_id"
    )

    awards: Mapped[list["Awards"]] = relationship(
        "Awards",
        secondary="award_players",
        back_populates="player"
    )

    scores: Mapped[list["PlayerScore"]] = relationship(
        "PlayerScore", 
        back_populates="player", 
        cascade="all, delete-orphan"
    )
    season_scores: Mapped[list["PlayerSeasonScore"]] = relationship(
        "PlayerSeasonScore",
        back_populates="player", 
        cascade="all, delete-orphan"
    )

    def __repr__(self) -> str:
        return f"<Player(id_player={self.id_player}, nome='{self.nome}', is_associate={self.is_associate})>"
