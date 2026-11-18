from datetime import datetime, timezone
from typing import Any, Dict, List, Optional
from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models.financial import FinancialMonthlyFee, FinancialCost
from app.db.models.player import Player
from app.db.repositories.financial_repository import FinancialRepository


class FinancialService:
    def __init__(self, repo: FinancialRepository, db: AsyncSession):
        self.repo = repo
        self.db = db

    # ---------------- RESUMO (SUMMARY) ----------------

    async def get_summary(self, year: Optional[int] = None, month: Optional[int] = None) -> dict:
        now = datetime.now(timezone.utc)
        target_year = year or now.year
        target_month = month or now.month
        return await self.repo.get_financial_summary(target_year, target_month)

    # ---------------- MENSALIDADES (FEES) ----------------

    async def list_fees(
        self,
        year: Optional[int] = None,
        month: Optional[int] = None,
        status_filter: Optional[str] = None,
        search: Optional[str] = None,
    ):
        return await self.repo.list_fees(
            year=year,
            month=month,
            status=status_filter,
            search=search,
        )

    async def create_fee(self, data: Dict[str, Any], user_id: Optional[int] = None) -> FinancialMonthlyFee:
        # Verifica se já existe
        existing = await self.repo.get_fee_by_player_month(
            player_id=data["player_id"],
            year=data["year"],
            month=data["month"],
        )
        if existing:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Já existe uma mensalidade cadastrada para este jogador na referência {data['month']:02d}/{data['year']}.",
            )

        # Se marcado como pago e sem paid_at, define paid_at
        paid_at = data.get("paid_at")
        if data.get("status") == "paid" and not paid_at:
            paid_at = datetime.now(timezone.utc)

        fee = FinancialMonthlyFee(
            player_id=data["player_id"],
            year=data["year"],
            month=data["month"],
            amount=data["amount"],
            status=data.get("status", "pending"),
            paid_at=paid_at,
            payment_method=data.get("payment_method"),
            notes=data.get("notes"),
            season_id=data.get("season_id"),
            created_by_user_id=user_id,
        )
        return await self.repo.create_fee(fee)

    async def generate_month_fees(
        self,
        year: int,
        month: int,
        default_amount: float,
        only_associates: bool = True,
        season_id: Optional[int] = None,
        user_id: Optional[int] = None,
    ) -> Dict[str, int]:
        # Busca jogadores ativos
        query = select(Player).where(Player.deleted_at.is_(None))
        if only_associates:
            query = query.where(Player.is_associate.is_(True))
        result = await self.db.execute(query)
        players = result.scalars().all()

        created_count = 0
        skipped_count = 0

        for player in players:
            existing = await self.repo.get_fee_by_player_month(player.id_player, year, month)
            if existing:
                skipped_count += 1
                continue

            fee = FinancialMonthlyFee(
                player_id=player.id_player,
                year=year,
                month=month,
                amount=default_amount,
                status="pending",
                season_id=season_id,
                created_by_user_id=user_id,
            )
            self.db.add(fee)
            created_count += 1

        if created_count > 0:
            await self.db.commit()

        return {
            "created_count": created_count,
            "skipped_count": skipped_count,
            "total_players": len(players),
        }

    async def update_fee(self, fee_id: int, updates: Dict[str, Any]) -> FinancialMonthlyFee:
        fee = await self.repo.get_fee_by_id(fee_id)
        if not fee:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Mensalidade não encontrada.",
            )

        # Ajusta paid_at se status mudar
        if "status" in updates:
            new_status = updates["status"]
            if new_status == "paid" and not updates.get("paid_at") and not fee.paid_at:
                updates["paid_at"] = datetime.now(timezone.utc)
            elif new_status in ("pending", "exempt"):
                updates["paid_at"] = None

        updated = await self.repo.update_fee(fee_id, updates)
        return updated

    async def patch_fee_status(
        self,
        fee_id: int,
        new_status: str,
        payment_method: Optional[str] = None,
        paid_at: Optional[datetime] = None,
    ) -> FinancialMonthlyFee:
        fee = await self.repo.get_fee_by_id(fee_id)
        if not fee:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Mensalidade não encontrada.",
            )

        updates: Dict[str, Any] = {"status": new_status}
        if new_status == "paid":
            updates["paid_at"] = paid_at or fee.paid_at or datetime.now(timezone.utc)
            if payment_method:
                updates["payment_method"] = payment_method
        else:
            updates["paid_at"] = None

        return await self.repo.update_fee(fee_id, updates)

    async def batch_update_status(
        self,
        fee_ids: List[int],
        new_status: str,
        payment_method: Optional[str] = None,
        paid_at: Optional[datetime] = None,
    ) -> int:
        return await self.repo.batch_update_status(
            fee_ids=fee_ids,
            status=new_status,
            paid_at=paid_at,
            payment_method=payment_method,
        )

    async def delete_fee(self, fee_id: int) -> bool:
        fee = await self.repo.get_fee_by_id(fee_id)
        if not fee:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Mensalidade não encontrada.",
            )
        return await self.repo.delete_fee(fee_id)

    # ---------------- CUSTOS / DESPESAS (COSTS) ----------------

    async def list_costs(
        self,
        year: Optional[int] = None,
        month: Optional[int] = None,
        category: Optional[str] = None,
        status_filter: Optional[str] = None,
        search: Optional[str] = None,
    ):
        return await self.repo.list_costs(
            year=year,
            month=month,
            category=category,
            status=status_filter,
            search=search,
        )

    async def create_cost(self, data: Dict[str, Any], user_id: Optional[int] = None) -> FinancialCost:
        paid_at = data.get("paid_at")
        if data.get("status") == "paid" and not paid_at:
            paid_at = data.get("cost_date") or datetime.now(timezone.utc)

        cost = FinancialCost(
            description=data["description"],
            category=data.get("category", "Outros"),
            amount=data["amount"],
            cost_date=data["cost_date"],
            status=data.get("status", "paid"),
            paid_at=paid_at,
            payment_method=data.get("payment_method"),
            notes=data.get("notes"),
            season_id=data.get("season_id"),
            created_by_user_id=user_id,
        )
        return await self.repo.create_cost(cost)

    async def update_cost(self, cost_id: int, updates: Dict[str, Any]) -> FinancialCost:
        cost = await self.repo.get_cost_by_id(cost_id)
        if not cost:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Despesa não encontrada.",
            )

        if "status" in updates:
            new_status = updates["status"]
            if new_status == "paid" and not updates.get("paid_at") and not cost.paid_at:
                updates["paid_at"] = cost.cost_date or datetime.now(timezone.utc)
            elif new_status == "pending":
                updates["paid_at"] = None

        updated = await self.repo.update_cost(cost_id, updates)
        return updated

    async def delete_cost(self, cost_id: int) -> bool:
        cost = await self.repo.get_cost_by_id(cost_id)
        if not cost:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Despesa não encontrada.",
            )
        return await self.repo.delete_cost(cost_id)
