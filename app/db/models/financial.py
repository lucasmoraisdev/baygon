from datetime import datetime, timezone
from typing import TYPE_CHECKING, Optional
from sqlalchemy import (
    DateTime,
    ForeignKey,
    Integer,
    Numeric,
    String,
    UniqueConstraint,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.db.base import Base, Timestamp
from app.db.tenant_mixin import TenantMixin

if TYPE_CHECKING:
    from app.db.models.player import Player
    from app.db.models.season import Seasons
    from app.db.models.user import User


class FinancialMonthlyFee(Base, Timestamp, TenantMixin):
    __tablename__ = "financial_monthly_fees"

    id_fee: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    player_id: Mapped[int] = mapped_column(ForeignKey("players.id_player", ondelete="CASCADE"), nullable=False)
    year: Mapped[int] = mapped_column(Integer, nullable=False)
    month: Mapped[int] = mapped_column(Integer, nullable=False)  # 1 a 12
    amount: Mapped[float] = mapped_column(Numeric(10, 2), nullable=False, default=0.0)
    status: Mapped[str] = mapped_column(String(20), nullable=False, default="pending")  # "paid", "pending", "exempt"
    paid_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    payment_method: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)  # "PIX", "Dinheiro", etc.
    notes: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)
    season_id: Mapped[Optional[int]] = mapped_column(ForeignKey("seasons.id_season", ondelete="SET NULL"), nullable=True)
    created_by_user_id: Mapped[Optional[int]] = mapped_column(ForeignKey("users.id_user", ondelete="SET NULL"), nullable=True)
    tenant_id: Mapped[Optional[str]] = mapped_column(String(36), index=True, nullable=True)

    player: Mapped["Player"] = relationship("Player", lazy="selectin")
    season: Mapped[Optional["Seasons"]] = relationship("Seasons", lazy="selectin")

    __table_args__ = (
        UniqueConstraint("player_id", "year", "month", name="uq_player_month_fee"),
    )


class FinancialCost(Base, Timestamp, TenantMixin):
    __tablename__ = "financial_costs"

    id_cost: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    description: Mapped[str] = mapped_column(String(255), nullable=False)
    category: Mapped[str] = mapped_column(String(100), nullable=False, default="Outros")  # Campo, Arbitragem, Material, Confraternização, Premiações, Outros
    amount: Mapped[float] = mapped_column(Numeric(10, 2), nullable=False)
    cost_date: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    status: Mapped[str] = mapped_column(String(20), nullable=False, default="paid")  # "paid", "pending"
    paid_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    payment_method: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)
    notes: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)
    season_id: Mapped[Optional[int]] = mapped_column(ForeignKey("seasons.id_season", ondelete="SET NULL"), nullable=True)
    created_by_user_id: Mapped[Optional[int]] = mapped_column(ForeignKey("users.id_user", ondelete="SET NULL"), nullable=True)
    tenant_id: Mapped[Optional[str]] = mapped_column(String(36), index=True, nullable=True)

    season: Mapped[Optional["Seasons"]] = relationship("Seasons", lazy="selectin")
