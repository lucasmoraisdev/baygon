from git import TYPE_CHECKING
from app.db.base import Base, Timestamp
from sqlalchemy import ForeignKey, Integer, String, Boolean, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

if TYPE_CHECKING:
    from app.db.models.player import Player
    from app.db.models.round import Round
    from app.db.models.season import Seasons

class PlayerScore(Base, Timestamp):
    __tablename__ = "player_scores"

    id_player_score: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    
    player_id: Mapped[int] = mapped_column(Integer, ForeignKey("players.id_player"), nullable=False)
    round_id: Mapped[int] = mapped_column(Integer, ForeignKey("round.id_round"), nullable=False)
    season_id: Mapped[int] = mapped_column(Integer, ForeignKey("seasons.id_season"), nullable=False)

    points_individual: Mapped[int] = mapped_column(Integer, default=0)
    points_team: Mapped[int] = mapped_column(Integer, default=0)
    total_points: Mapped[int] = mapped_column(Integer, default=0)

    player: Mapped["Player"] = relationship(
        "Player", 
        back_populates="scores"
    )
    round: Mapped["Round"] = relationship(
        "Round", 
        back_populates="player_scores"
    )
    seasons: Mapped["Seasons"] = relationship(
        "Seasons", 
        back_populates="player_scores"
    )

    def __repr__(self):
        return f"<PlayerScore(player_id={self.player_id}, round_id={self.round_id}, total_points={self.total_points})>"
