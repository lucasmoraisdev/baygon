from git import TYPE_CHECKING
from app.db.base import Base, Timestamp
from sqlalchemy import ForeignKey, Integer, String, Boolean, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

if TYPE_CHECKING:
    from app.db.models.player import Player
    from app.db.models.round import Round
    from app.db.models.season import Seasons

class PlayerSeasonScore(Base, Timestamp):
    __tablename__ = "player_season_scores"

    id_player_season_score: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)

    # relacionamentos
    player_id: Mapped[int] = mapped_column(Integer, ForeignKey("players.id_player"), nullable=False)
    season_id: Mapped[int] = mapped_column(Integer, ForeignKey("seasons.id_season"), nullable=False)

    # pontuacao total da temporada
    total_points: Mapped[int] = mapped_column(Integer, default=0)

    # relacionamentos ORM
    player: Mapped["Player"] = relationship(
        "Player", 
        back_populates="season_scores"
    )
    seasons: Mapped["Seasons"] = relationship(
        "Seasons", 
        back_populates="player_season_scores"
    )

    def __repr__(self):
        return f"<PlayerSeasonScore(player_id={self.player_id}, season_id={self.season_id}, total_points={self.total_points})>"
