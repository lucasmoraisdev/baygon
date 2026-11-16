from typing import TYPE_CHECKING, Optional
from sqlalchemy import ForeignKey, Integer
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.db.base import Base, Timestamp

if TYPE_CHECKING:
    from app.db.models.round import Round
    from app.db.models.player import Player
    from app.db.models.roulette_prize import RoulettePrize

class RoundRouletteWinner(Base, Timestamp):
    __tablename__ = "round_roulette_winners"

    id_round_roulette: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    round_id: Mapped[int] = mapped_column(ForeignKey("round.id_round"), nullable=False)
    player_id: Mapped[int] = mapped_column(ForeignKey("players.id_player"), nullable=False)
    prize_id: Mapped[Optional[int]] = mapped_column(ForeignKey("roulette_prizes.id_roulette_prize"), nullable=True)
    roulette_number: Mapped[int] = mapped_column(Integer, default=1, nullable=False)

    round: Mapped["Round"] = relationship("Round", lazy="selectin")
    player: Mapped["Player"] = relationship("Player", lazy="selectin")
    prize: Mapped[Optional["RoulettePrize"]] = relationship("RoulettePrize", back_populates="winners", lazy="selectin")

    def __repr__(self):
        return f"<RoundRouletteWinner(round={self.round_id}, player={self.player_id}, prize={self.prize_id}, num={self.roulette_number})>"
