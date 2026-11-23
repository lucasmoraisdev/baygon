from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.dependencies.auth_dependencies import user_has_permission
from app.core.services.financial_service import FinancialService
from app.db.base import get_db
from app.db.models.user import User
from app.db.repositories.financial_repository import FinancialRepository
from app.schemas.financial_schema import (
    CostCreate,
    CostRead,
    CostUpdate,
    FinancialSummaryResponse,
    MonthlyFeeBatchStatusPayload,
    MonthlyFeeCreate,
    MonthlyFeeGenerateMonthPayload,
    MonthlyFeeRead,
    MonthlyFeeStatusPatch,
    MonthlyFeeUpdate,
)

from app.core.dependencies.modules import require_module

router = APIRouter(
    prefix="/financial", 
    tags=["Financial"], 
    dependencies=[Depends(require_module("financial"))]
)


def get_financial_service(db: AsyncSession = Depends(get_db)) -> FinancialService:
    repo = FinancialRepository(db)
    return FinancialService(repo, db)


# ---------------- RESUMO & SALDO ----------------

@router.get("/summary", response_model=FinancialSummaryResponse, status_code=status.HTTP_200_OK)
async def get_summary(
    year: Optional[int] = Query(None, description="Ano de competência"),
    month: Optional[int] = Query(None, ge=1, le=12, description="Mês de competência (1-12)"),
    service: FinancialService = Depends(get_financial_service),
    current_user: User = Depends(user_has_permission),
):
    return await service.get_summary(year=year, month=month)


# ---------------- MENSALIDADES ----------------

@router.get("/fees", response_model=List[MonthlyFeeRead], status_code=status.HTTP_200_OK)
async def list_fees(
    year: Optional[int] = Query(None, description="Ano"),
    month: Optional[int] = Query(None, ge=1, le=12, description="Mês"),
    status_filter: Optional[str] = Query(None, alias="status", description="Status (paid, pending, exempt, all)"),
    search: Optional[str] = Query(None, description="Busca por nome/apelido"),
    service: FinancialService = Depends(get_financial_service),
    current_user: User = Depends(user_has_permission),
):
    return await service.list_fees(
        year=year,
        month=month,
        status_filter=status_filter,
        search=search,
    )


@router.post("/fees", response_model=MonthlyFeeRead, status_code=status.HTTP_201_CREATED)
async def create_fee(
    payload: MonthlyFeeCreate,
    service: FinancialService = Depends(get_financial_service),
    current_user: User = Depends(user_has_permission),
):
    return await service.create_fee(payload.model_dump(), user_id=current_user.id_user)


@router.post("/fees/generate-month", status_code=status.HTTP_200_OK)
async def generate_month_fees(
    payload: MonthlyFeeGenerateMonthPayload,
    service: FinancialService = Depends(get_financial_service),
    current_user: User = Depends(user_has_permission),
):
    return await service.generate_month_fees(
        year=payload.year,
        month=payload.month,
        default_amount=payload.default_amount,
        only_associates=payload.only_associates,
        season_id=payload.season_id,
        user_id=current_user.id_user,
    )


@router.patch("/fees/{fee_id}/status", response_model=MonthlyFeeRead, status_code=status.HTTP_200_OK)
async def patch_fee_status(
    fee_id: int,
    payload: MonthlyFeeStatusPatch,
    service: FinancialService = Depends(get_financial_service),
    current_user: User = Depends(user_has_permission),
):
    return await service.patch_fee_status(
        fee_id=fee_id,
        new_status=payload.status,
        payment_method=payload.payment_method,
        paid_at=payload.paid_at,
    )


@router.post("/fees/batch-status", status_code=status.HTTP_200_OK)
async def batch_update_fees_status(
    payload: MonthlyFeeBatchStatusPayload,
    service: FinancialService = Depends(get_financial_service),
    current_user: User = Depends(user_has_permission),
):
    count = await service.batch_update_status(
        fee_ids=payload.fee_ids,
        new_status=payload.status,
        payment_method=payload.payment_method,
        paid_at=payload.paid_at,
    )
    return {"updated_count": count}


@router.put("/fees/{fee_id}", response_model=MonthlyFeeRead, status_code=status.HTTP_200_OK)
async def update_fee(
    fee_id: int,
    payload: MonthlyFeeUpdate,
    service: FinancialService = Depends(get_financial_service),
    current_user: User = Depends(user_has_permission),
):
    return await service.update_fee(fee_id, payload.model_dump(exclude_unset=True))


@router.delete("/fees/{fee_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_fee(
    fee_id: int,
    service: FinancialService = Depends(get_financial_service),
    current_user: User = Depends(user_has_permission),
):
    await service.delete_fee(fee_id)
    return None


# ---------------- CUSTOS / DESPESAS ----------------

@router.get("/costs", response_model=List[CostRead], status_code=status.HTTP_200_OK)
async def list_costs(
    year: Optional[int] = Query(None, description="Ano"),
    month: Optional[int] = Query(None, ge=1, le=12, description="Mês"),
    category: Optional[str] = Query(None, description="Categoria"),
    status_filter: Optional[str] = Query(None, alias="status", description="Status (paid, pending, all)"),
    search: Optional[str] = Query(None, description="Busca"),
    service: FinancialService = Depends(get_financial_service),
    current_user: User = Depends(user_has_permission),
):
    return await service.list_costs(
        year=year,
        month=month,
        category=category,
        status_filter=status_filter,
        search=search,
    )


@router.post("/costs", response_model=CostRead, status_code=status.HTTP_201_CREATED)
async def create_cost(
    payload: CostCreate,
    service: FinancialService = Depends(get_financial_service),
    current_user: User = Depends(user_has_permission),
):
    return await service.create_cost(payload.model_dump(), user_id=current_user.id_user)


@router.put("/costs/{cost_id}", response_model=CostRead, status_code=status.HTTP_200_OK)
async def update_cost(
    cost_id: int,
    payload: CostUpdate,
    service: FinancialService = Depends(get_financial_service),
    current_user: User = Depends(user_has_permission),
):
    return await service.update_cost(cost_id, payload.model_dump(exclude_unset=True))


@router.delete("/costs/{cost_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_cost(
    cost_id: int,
    service: FinancialService = Depends(get_financial_service),
    current_user: User = Depends(user_has_permission),
):
    await service.delete_cost(cost_id)
    return None
