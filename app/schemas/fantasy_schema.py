from datetime import datetime
from decimal import Decimal
from typing import List, Optional
from pydantic import BaseModel, ConfigDict, Field


# ---------------- SETTINGS & CONFIG ----------------

class FantasySettingBase(BaseModel):
    is_enabled: bool = True
    initial_budget: Decimal = Field(default=Decimal("100.00"), ge=10)
    min_player_price: Decimal = Field(default=Decimal("1.00"), ge=0.5)
    max_price_variation: Decimal = Field(default=Decimal("5.00"), ge=0.5)
    appreciation_factor: Decimal = Field(default=Decimal("0.5000"), ge=0.01)


class FantasySettingUpdate(BaseModel):
    is_enabled: Optional[bool] = None
    initial_budget: Optional[Decimal] = None
    min_player_price: Optional[Decimal] = None
    max_price_variation: Optional[Decimal] = None
    appreciation_factor: Optional[Decimal] = None


class FantasySettingRead(FantasySettingBase):
    model_config = ConfigDict(from_attributes=True)

    id_fantasy_setting: int
    season_id: int
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None


# ---------------- SLOTS & ROUND CONFIG ----------------

class FantasySlotRuleBase(BaseModel):
    slot_type: str = "POSITION"  # POSITION ou POT
    target_value: str
    required_quantity: int = Field(default=1, ge=1)


class FantasySlotRuleRead(FantasySlotRuleBase):
    model_config = ConfigDict(from_attributes=True)

    id_slot_rule: int


class FantasyRoundConfigUpdate(BaseModel):
    total_slots: Optional[int] = Field(None, ge=1, le=22)
    is_market_open: Optional[bool] = None
    market_closes_at: Optional[datetime] = None
    status: Optional[str] = None  # OPEN, CLOSED, FINALIZED
    slot_rules: Optional[List[FantasySlotRuleBase]] = None


class FantasyRoundConfigRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id_round_config: int
    round_id: int
    total_slots: int
    is_market_open: bool
    market_closes_at: Optional[datetime] = None
    status: str
    slot_rules: List[FantasySlotRuleRead] = []


# ---------------- PLAYERS IN MARKET ----------------

class FantasyPlayerRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id_fantasy_player: int
    player_id: int
    season_id: int
    player_name: str
    player_nickname: Optional[str] = None
    position: Optional[str] = None
    pot: Optional[int] = None
    current_price: Decimal
    last_variation: Decimal
    status: str
    last_round_points: Optional[Decimal] = Decimal("0.00")
    matches_played: int = 0


# ---------------- TEAM & LINEUP ----------------

class FantasyTeamRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id_fantasy_team: int
    user_id: int
    season_id: int
    name: str
    budget: Decimal
    total_wealth: Decimal
    total_points: Decimal


class FantasyTeamUpdate(BaseModel):
    name: str = Field(..., min_length=3, max_length=100)


class FantasyLineupPlayerItem(BaseModel):
    player_id: int
    slot_label: str


class FantasyLineupSavePayload(BaseModel):
    players: List[FantasyLineupPlayerItem]


class FantasyLineupPlayerRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id_lineup_player: int
    player_id: int
    player_name: str
    player_nickname: Optional[str] = None
    position: Optional[str] = None
    slot_label: str
    purchase_price: Decimal
    points_earned: Decimal
    price_variation: Decimal


class FantasyLineupRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id_fantasy_lineup: int
    fantasy_team_id: int
    round_id: int
    total_spent: Decimal
    cash_remaining: Decimal
    points_scored: Decimal
    wealth_variation: Decimal
    is_finalized: bool
    team_name: Optional[str] = None
    user_name: Optional[str] = None
    players: List[FantasyLineupPlayerRead] = []


# ---------------- RANKINGS ----------------

class FantasyRankingEntry(BaseModel):
    position: int
    team_id: int
    team_name: str
    user_name: str
    user_id: int
    points: Decimal
    total_wealth: Decimal
    has_lineup: bool = True


class FantasyRoundRankingResponse(BaseModel):
    round_id: int
    round_number: int
    rankings: List[FantasyRankingEntry]


class FantasySeasonRankingResponse(BaseModel):
    season_id: int
    rankings: List[FantasyRankingEntry]


class FantasyCalculationSummary(BaseModel):
    message: str
    round_id: int
    lineups_processed: int
    players_updated: int
