from typing import TYPE_CHECKING, Optional
from sqlalchemy import Boolean, Integer, String
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.db.base import Base, Timestamp
from app.db.tenant_mixin import TenantMixin

if TYPE_CHECKING:
    from app.db.models.round_roulette_winner import RoundRouletteWinner

class RoulettePrize(Base, Timestamp, TenantMixin):
    __tablename__ = "roulette_prizes"

    id_roulette_prize: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    description: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    tenant_id: Mapped[Optional[str]] = mapped_column(String(36), index=True, nullable=True)

    winners: Mapped[list["RoundRouletteWinner"]] = relationship(
        "RoundRouletteWinner",
        back_populates="prize",
        lazy="selectin",
    )

    def __repr__(self):
        return f"<RoulettePrize(id={self.id_roulette_prize}, name='{self.name}')>"
