from typing import TYPE_CHECKING, Optional
from sqlalchemy import Boolean, ForeignKey, Integer, String, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.db.base import Base, Timestamp

if TYPE_CHECKING:
    from app.db.models.round import Round
    from app.db.models.user import User
    from app.db.models.player import Player


class RoundAwardVoter(Base, Timestamp):
    """
    Usuário designado pelo admin para votar nos destaques de uma rodada específica.
    """
    __tablename__ = "round_award_voters"

    id_voter: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    round_id: Mapped[int] = mapped_column(ForeignKey("round.id_round", ondelete="CASCADE"), nullable=False)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id_user", ondelete="CASCADE"), nullable=False)

    round: Mapped["Round"] = relationship("Round", back_populates="voters")
    user: Mapped["User"] = relationship("User", lazy="selectin")

    __table_args__ = (
        UniqueConstraint("round_id", "user_id", name="uq_round_award_voter"),
    )


class RoundAwardVote(Base, Timestamp):
    """
    Voto registrado por um jurado designado para uma premiação/destaque da rodada.
    Categorias aceitas: bola_cheia, bola_murcha, gol_rodada, defesa_rodada, drible_rodada, inacreditavel.
    """
    __tablename__ = "round_award_votes"

    id_vote: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    round_id: Mapped[int] = mapped_column(ForeignKey("round.id_round", ondelete="CASCADE"), nullable=False)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id_user", ondelete="CASCADE"), nullable=False)
    award_type: Mapped[str] = mapped_column(String(50), nullable=False)
    player_id: Mapped[int] = mapped_column(ForeignKey("players.id_player", ondelete="CASCADE"), nullable=False)

    round: Mapped["Round"] = relationship("Round", back_populates="votes")
    user: Mapped["User"] = relationship("User", lazy="selectin")
    player: Mapped["Player"] = relationship("Player", lazy="selectin")

    __table_args__ = (
        UniqueConstraint("round_id", "user_id", "award_type", name="uq_round_user_award_type"),
    )
