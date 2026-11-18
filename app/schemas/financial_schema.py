from datetime import datetime
from typing import List, Optional
from pydantic import BaseModel, ConfigDict, Field


class MonthlyFeePlayerRead(BaseModel):
    id_player: int
    nome: str
    apelido: Optional[str] = None
    is_associate: bool = True
    is_guest: bool = False

    model_config = ConfigDict(from_attributes=True)


class MonthlyFeeBase(BaseModel):
    player_id: int
    year: int
    month: int = Field(..., ge=1, le=12)
    amount: float = Field(..., ge=0)
    status: str = Field("pending", pattern="^(paid|pending|exempt)$")
    paid_at: Optional[datetime] = None
    payment_method: Optional[str] = Field(None, max_length=50)
    notes: Optional[str] = Field(None, max_length=500)
    season_id: Optional[int] = None


class MonthlyFeeCreate(MonthlyFeeBase):
    pass


class MonthlyFeeUpdate(BaseModel):
    amount: Optional[float] = Field(None, ge=0)
    status: Optional[str] = Field(None, pattern="^(paid|pending|exempt)$")
    paid_at: Optional[datetime] = None
    payment_method: Optional[str] = Field(None, max_length=50)
    notes: Optional[str] = Field(None, max_length=500)
    season_id: Optional[int] = None


class MonthlyFeeStatusPatch(BaseModel):
    status: str = Field(..., pattern="^(paid|pending|exempt)$")
    payment_method: Optional[str] = Field(None, max_length=50)
    paid_at: Optional[datetime] = None


class MonthlyFeeBatchStatusPayload(BaseModel):
    fee_ids: List[int]
    status: str = Field(..., pattern="^(paid|pending|exempt)$")
    payment_method: Optional[str] = Field(None, max_length=50)
    paid_at: Optional[datetime] = None


class MonthlyFeeGenerateMonthPayload(BaseModel):
    year: int
    month: int = Field(..., ge=1, le=12)
    default_amount: float = Field(50.0, ge=0)
    only_associates: bool = True
    season_id: Optional[int] = None


class MonthlyFeeRead(BaseModel):
    id_fee: int
    player_id: int
    year: int
    month: int
    amount: float
    status: str
    paid_at: Optional[datetime] = None
    payment_method: Optional[str] = None
    notes: Optional[str] = None
    season_id: Optional[int] = None
    player: Optional[MonthlyFeePlayerRead] = None
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

    model_config = ConfigDict(from_attributes=True)


class CostBase(BaseModel):
    description: str = Field(..., min_length=1, max_length=255)
    category: str = Field("Outros", max_length=100)
    amount: float = Field(..., ge=0)
    cost_date: datetime
    status: str = Field("paid", pattern="^(paid|pending)$")
    paid_at: Optional[datetime] = None
    payment_method: Optional[str] = Field(None, max_length=50)
    notes: Optional[str] = Field(None, max_length=500)
    season_id: Optional[int] = None


class CostCreate(CostBase):
    pass


class CostUpdate(BaseModel):
    description: Optional[str] = Field(None, min_length=1, max_length=255)
    category: Optional[str] = Field(None, max_length=100)
    amount: Optional[float] = Field(None, ge=0)
    cost_date: Optional[datetime] = None
    status: Optional[str] = Field(None, pattern="^(paid|pending)$")
    paid_at: Optional[datetime] = None
    payment_method: Optional[str] = Field(None, max_length=50)
    notes: Optional[str] = Field(None, max_length=500)
    season_id: Optional[int] = None


class CostRead(CostBase):
    id_cost: int
    created_by_user_id: Optional[int] = None
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

    model_config = ConfigDict(from_attributes=True)


class FinancialSummaryPeriod(BaseModel):
    year: int
    month: int
    total_fees_paid: float
    total_fees_pending: float
    fees_count_paid: int
    fees_count_pending: int
    fees_count_exempt: int
    total_costs_paid: float
    total_costs_pending: float
    period_balance: float


class FinancialSummaryOverall(BaseModel):
    total_revenue: float
    total_expenses: float
    total_balance: float
    total_pending_receivables: float


class FinancialMonthlyTrendItem(BaseModel):
    year: int
    month: int
    label: str
    revenue: float
    costs: float
    balance: float


class FinancialSummaryResponse(BaseModel):
    period: FinancialSummaryPeriod
    overall: FinancialSummaryOverall
    trends: List[FinancialMonthlyTrendItem]
