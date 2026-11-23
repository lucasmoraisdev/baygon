from datetime import datetime
from decimal import Decimal
from typing import TYPE_CHECKING, List, Optional
from sqlalchemy import Boolean, DateTime, ForeignKey, Integer, Numeric, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base, Timestamp
from app.db.tenant_mixin import TenantMixin

if TYPE_CHECKING:
    from app.db.models.player import Player
    from app.db.models.round import Round
    from app.db.models.season import Seasons
    from app.db.models.user import User


class FantasySetting(Base, Timestamp, TenantMixin):
    __tablename__ = "fantasy_settings"

    id_fantasy_setting: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    season_id: Mapped[int] = mapped_column(ForeignKey("seasons.id_season", ondelete="CASCADE"), nullable=False, unique=True)
    is_enabled: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    initial_budget: Mapped[Decimal] = mapped_column(Numeric(10, 2), default=Decimal("100.00"), nullable=False)
    min_player_price: Mapped[Decimal] = mapped_column(Numeric(10, 2), default=Decimal("1.00"), nullable=False)
    max_price_variation: Mapped[Decimal] = mapped_column(Numeric(10, 2), default=Decimal("5.00"), nullable=False)
    appreciation_factor: Mapped[Decimal] = mapped_column(Numeric(10, 4), default=Decimal("0.5000"), nullable=False)
    tenant_id: Mapped[Optional[str]] = mapped_column(String(36), index=True, nullable=True)

    season: Mapped["Seasons"] = relationship("Seasons")


class FantasyRoundConfig(Base, Timestamp, TenantMixin):
    __tablename__ = "fantasy_round_configs"

    id_round_config: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    round_id: Mapped[int] = mapped_column(ForeignKey("round.id_round", ondelete="CASCADE"), nullable=False, unique=True)
    total_slots: Mapped[int] = mapped_column(Integer, default=5, nullable=False)
    is_market_open: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    market_closes_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    status: Mapped[str] = mapped_column(String(20), default="OPEN", nullable=False)  # OPEN, CLOSED, FINALIZED
    tenant_id: Mapped[Optional[str]] = mapped_column(String(36), index=True, nullable=True)

    round: Mapped["Round"] = relationship("Round")
    slot_rules: Mapped[List["FantasyRoundSlotRule"]] = relationship(
        "FantasyRoundSlotRule",
        back_populates="round_config",
        cascade="all, delete-orphan",
        lazy="selectin",
    )


class FantasyRoundSlotRule(Base, Timestamp):
    __tablename__ = "fantasy_round_slot_rules"

    id_slot_rule: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    round_config_id: Mapped[int] = mapped_column(ForeignKey("fantasy_round_configs.id_round_config", ondelete="CASCADE"), nullable=False)
    slot_type: Mapped[str] = mapped_column(String(20), default="POSITION", nullable=False)  # POSITION, POT
    target_value: Mapped[str] = mapped_column(String(50), nullable=False)  # ex: Goleiro, Defensor, Atacante, Pote 1
    required_quantity: Mapped[int] = mapped_column(Integer, default=1, nullable=False)

    round_config: Mapped["FantasyRoundConfig"] = relationship("FantasyRoundConfig", back_populates="slot_rules")


class FantasyPlayer(Base, Timestamp):
    __tablename__ = "fantasy_players"

    id_fantasy_player: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    player_id: Mapped[int] = mapped_column(ForeignKey("players.id_player", ondelete="CASCADE"), nullable=False)
    season_id: Mapped[int] = mapped_column(ForeignKey("seasons.id_season", ondelete="CASCADE"), nullable=False)
    current_price: Mapped[Decimal] = mapped_column(Numeric(10, 2), default=Decimal("10.00"), nullable=False)
    last_variation: Mapped[Decimal] = mapped_column(Numeric(10, 2), default=Decimal("0.00"), nullable=False)
    status: Mapped[str] = mapped_column(String(20), default="PROBABLE", nullable=False)  # PROBABLE, DOUBT, OUT

    player: Mapped["Player"] = relationship("Player")
    season: Mapped["Seasons"] = relationship("Seasons")


class FantasyTeam(Base, Timestamp, TenantMixin):
    __tablename__ = "fantasy_teams"

    id_fantasy_team: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id_user", ondelete="CASCADE"), nullable=False)
    season_id: Mapped[int] = mapped_column(ForeignKey("seasons.id_season", ondelete="CASCADE"), nullable=False)
    name: Mapped[str] = mapped_column(String(100), default="Meu Time Fantasy", nullable=False)
    budget: Mapped[Decimal] = mapped_column(Numeric(10, 2), default=Decimal("100.00"), nullable=False)
    total_wealth: Mapped[Decimal] = mapped_column(Numeric(10, 2), default=Decimal("100.00"), nullable=False)
    total_points: Mapped[Decimal] = mapped_column(Numeric(10, 2), default=Decimal("0.00"), nullable=False)
    tenant_id: Mapped[Optional[str]] = mapped_column(String(36), index=True, nullable=True)

    user: Mapped["User"] = relationship("User")
    season: Mapped["Seasons"] = relationship("Seasons")
    lineups: Mapped[List["FantasyLineup"]] = relationship("FantasyLineup", back_populates="fantasy_team", cascade="all, delete-orphan")


class FantasyLineup(Base, Timestamp, TenantMixin):
    __tablename__ = "fantasy_lineups"

    id_fantasy_lineup: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    fantasy_team_id: Mapped[int] = mapped_column(ForeignKey("fantasy_teams.id_fantasy_team", ondelete="CASCADE"), nullable=False)
    round_id: Mapped[int] = mapped_column(ForeignKey("round.id_round", ondelete="CASCADE"), nullable=False)
    total_spent: Mapped[Decimal] = mapped_column(Numeric(10, 2), default=Decimal("0.00"), nullable=False)
    cash_remaining: Mapped[Decimal] = mapped_column(Numeric(10, 2), default=Decimal("0.00"), nullable=False)
    points_scored: Mapped[Decimal] = mapped_column(Numeric(10, 2), default=Decimal("0.00"), nullable=False)
    wealth_variation: Mapped[Decimal] = mapped_column(Numeric(10, 2), default=Decimal("0.00"), nullable=False)
    is_finalized: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    tenant_id: Mapped[Optional[str]] = mapped_column(String(36), index=True, nullable=True)

    fantasy_team: Mapped["FantasyTeam"] = relationship("FantasyTeam", back_populates="lineups")
    round: Mapped["Round"] = relationship("Round")
    players: Mapped[List["FantasyLineupPlayer"]] = relationship(
        "FantasyLineupPlayer",
        back_populates="lineup",
        cascade="all, delete-orphan",
        lazy="selectin",
    )


class FantasyLineupPlayer(Base, Timestamp):
    __tablename__ = "fantasy_lineup_players"

    id_lineup_player: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    lineup_id: Mapped[int] = mapped_column(ForeignKey("fantasy_lineups.id_fantasy_lineup", ondelete="CASCADE"), nullable=False)
    player_id: Mapped[int] = mapped_column(ForeignKey("players.id_player", ondelete="CASCADE"), nullable=False)
    slot_label: Mapped[str] = mapped_column(String(50), nullable=False)
    purchase_price: Mapped[Decimal] = mapped_column(Numeric(10, 2), default=Decimal("0.00"), nullable=False)
    points_earned: Mapped[Decimal] = mapped_column(Numeric(10, 2), default=Decimal("0.00"), nullable=False)
    price_variation: Mapped[Decimal] = mapped_column(Numeric(10, 2), default=Decimal("0.00"), nullable=False)

    lineup: Mapped["FantasyLineup"] = relationship("FantasyLineup", back_populates="players")
    player: Mapped["Player"] = relationship("Player")
