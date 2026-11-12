from typing import TYPE_CHECKING, Optional
from sqlalchemy import ForeignKey, Integer, String, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.db.base import Base, Timestamp

if TYPE_CHECKING:
    from app.db.models.player import Player
    from app.db.models.round import Round


class RoundAttendance(Base, Timestamp):
    __tablename__ = "round_attendance"
    __table_args__ = (
        UniqueConstraint("round_id", "player_id", name="uq_round_attendance_round_player"),
    )

    id_attendance: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    round_id: Mapped[int] = mapped_column(ForeignKey("round.id_round"), nullable=False)
    player_id: Mapped[int] = mapped_column(ForeignKey("players.id_player"), nullable=False)
    status: Mapped[str] = mapped_column(String(20), nullable=False, default="confirmed")
    updated_by_user_id: Mapped[Optional[int]] = mapped_column(ForeignKey("users.id_user"), nullable=True)
    note: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)

    player: Mapped["Player"] = relationship("Player", lazy="selectin")
    round: Mapped["Round"] = relationship("Round")
