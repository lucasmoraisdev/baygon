from typing import Optional
from sqlalchemy import Integer, String, DateTime, func
from sqlalchemy.orm import Mapped, mapped_column
from app.db.base import Base, Timestamp


class Plan(Base, Timestamp):
    __tablename__ = "plans"

    id_plan: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    code: Mapped[str] = mapped_column(String(50), unique=True, index=True, nullable=False)
    price_monthly_cents: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    max_players: Mapped[int] = mapped_column(Integer, default=100, nullable=False)
    max_seasons: Mapped[int] = mapped_column(Integer, default=2, nullable=False)
    is_active: Mapped[bool] = mapped_column(default=True, nullable=False)

    @property
    def max_tournaments(self) -> int:
        """Alias para max_seasons, refletindo a cota de torneios/campeonatos."""
        return self.max_seasons

    @property
    def is_unlimited_tournaments(self) -> bool:
        """Verifica se o plano possui cota ilimitada de torneios (-1)."""
        return self.max_seasons == -1 or self.max_seasons >= 999999

    def __repr__(self):
        return f"<Plan(code='{self.code}', name='{self.name}', price={self.price_monthly_cents}, max_seasons={self.max_seasons})>"
