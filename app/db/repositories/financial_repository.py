from datetime import datetime, timezone
from typing import List, Optional, Sequence, Tuple
from sqlalchemy import func, select, and_, or_, extract
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.db.models.financial import FinancialMonthlyFee, FinancialCost
from app.db.models.player import Player


class FinancialRepository:
    def __init__(self, db: AsyncSession):
        self.db = db

    # ---------------- MENSALIDADES (FEES) ----------------

    async def list_fees(
        self,
        year: Optional[int] = None,
        month: Optional[int] = None,
        status: Optional[str] = None,
        search: Optional[str] = None,
    ) -> Sequence[FinancialMonthlyFee]:
        query = (
            select(FinancialMonthlyFee)
            .join(FinancialMonthlyFee.player)
            .options(selectinload(FinancialMonthlyFee.player))
            .where(FinancialMonthlyFee.deleted_at.is_(None))
        )

        if year is not None:
            query = query.where(FinancialMonthlyFee.year == year)
        if month is not None:
            query = query.where(FinancialMonthlyFee.month == month)
        if status and status != "all":
            query = query.where(FinancialMonthlyFee.status == status)
        if search:
            s = f"%{search.strip().lower()}%"
            query = query.where(
                or_(
                    func.lower(Player.nome).like(s),
                    func.lower(Player.apelido).like(s),
                )
            )

        query = query.order_by(Player.nome.asc())
        result = await self.db.execute(query)
        return result.scalars().all()

    async def get_fee_by_id(self, fee_id: int) -> Optional[FinancialMonthlyFee]:
        query = (
            select(FinancialMonthlyFee)
            .options(selectinload(FinancialMonthlyFee.player))
            .where(
                FinancialMonthlyFee.id_fee == fee_id,
                FinancialMonthlyFee.deleted_at.is_(None),
            )
        )
        result = await self.db.execute(query)
        return result.scalars().first()

    async def get_fee_by_player_month(
        self, player_id: int, year: int, month: int
    ) -> Optional[FinancialMonthlyFee]:
        query = (
            select(FinancialMonthlyFee)
            .where(
                FinancialMonthlyFee.player_id == player_id,
                FinancialMonthlyFee.year == year,
                FinancialMonthlyFee.month == month,
                FinancialMonthlyFee.deleted_at.is_(None),
            )
        )
        result = await self.db.execute(query)
        return result.scalars().first()

    async def create_fee(self, fee: FinancialMonthlyFee) -> FinancialMonthlyFee:
        self.db.add(fee)
        await self.db.commit()
        await self.db.refresh(fee)
        # Recarrega o relacionamento com player
        return await self.get_fee_by_id(fee.id_fee) or fee

    async def update_fee(self, fee_id: int, updates: dict) -> Optional[FinancialMonthlyFee]:
        fee = await self.get_fee_by_id(fee_id)
        if not fee:
            return None
        for key, value in updates.items():
            if hasattr(fee, key):
                setattr(fee, key, value)
        fee.updated_at = datetime.now(timezone.utc)
        await self.db.commit()
        await self.db.refresh(fee)
        return await self.get_fee_by_id(fee_id)

    async def delete_fee(self, fee_id: int, soft: bool = True) -> bool:
        fee = await self.get_fee_by_id(fee_id)
        if not fee:
            return False
        if soft:
            fee.deleted_at = datetime.now(timezone.utc)
        else:
            await self.db.delete(fee)
        await self.db.commit()
        return True

    async def batch_update_status(
        self,
        fee_ids: List[int],
        status: str,
        paid_at: Optional[datetime] = None,
        payment_method: Optional[str] = None,
    ) -> int:
        if not fee_ids:
            return 0
        query = select(FinancialMonthlyFee).where(
            FinancialMonthlyFee.id_fee.in_(fee_ids),
            FinancialMonthlyFee.deleted_at.is_(None),
        )
        result = await self.db.execute(query)
        fees = result.scalars().all()
        now = datetime.now(timezone.utc)
        count = 0
        for f in fees:
            f.status = status
            if status == "paid":
                f.paid_at = paid_at or now
                if payment_method:
                    f.payment_method = payment_method
            elif status in ("pending", "exempt"):
                f.paid_at = None
            f.updated_at = now
            count += 1
        await self.db.commit()
        return count

    # ---------------- CUSTOS / DESPESAS (COSTS) ----------------

    async def list_costs(
        self,
        year: Optional[int] = None,
        month: Optional[int] = None,
        category: Optional[str] = None,
        status: Optional[str] = None,
        search: Optional[str] = None,
    ) -> Sequence[FinancialCost]:
        query = select(FinancialCost).where(FinancialCost.deleted_at.is_(None))

        if year is not None:
            query = query.where(extract("year", FinancialCost.cost_date) == year)
        if month is not None:
            query = query.where(extract("month", FinancialCost.cost_date) == month)
        if category and category != "all":
            query = query.where(FinancialCost.category == category)
        if status and status != "all":
            query = query.where(FinancialCost.status == status)
        if search:
            s = f"%{search.strip().lower()}%"
            query = query.where(
                or_(
                    func.lower(FinancialCost.description).like(s),
                    func.lower(FinancialCost.notes).like(s),
                )
            )

        query = query.order_by(FinancialCost.cost_date.desc(), FinancialCost.id_cost.desc())
        result = await self.db.execute(query)
        return result.scalars().all()

    async def get_cost_by_id(self, cost_id: int) -> Optional[FinancialCost]:
        query = select(FinancialCost).where(
            FinancialCost.id_cost == cost_id,
            FinancialCost.deleted_at.is_(None),
        )
        result = await self.db.execute(query)
        return result.scalars().first()

    async def create_cost(self, cost: FinancialCost) -> FinancialCost:
        self.db.add(cost)
        await self.db.commit()
        await self.db.refresh(cost)
        return cost

    async def update_cost(self, cost_id: int, updates: dict) -> Optional[FinancialCost]:
        cost = await self.get_cost_by_id(cost_id)
        if not cost:
            return None
        for key, value in updates.items():
            if hasattr(cost, key):
                setattr(cost, key, value)
        cost.updated_at = datetime.now(timezone.utc)
        await self.db.commit()
        await self.db.refresh(cost)
        return cost

    async def delete_cost(self, cost_id: int, soft: bool = True) -> bool:
        cost = await self.get_cost_by_id(cost_id)
        if not cost:
            return False
        if soft:
            cost.deleted_at = datetime.now(timezone.utc)
        else:
            await self.db.delete(cost)
        await self.db.commit()
        return True

    # ---------------- SALDO & RESUMO (SUMMARY) ----------------

    async def get_financial_summary(self, year: int, month: int) -> dict:
        # 1. Dados do período selecionado (mensalidades)
        fees_period_query = select(
            FinancialMonthlyFee.status,
            func.count(FinancialMonthlyFee.id_fee),
            func.coalesce(func.sum(FinancialMonthlyFee.amount), 0.0),
        ).where(
            FinancialMonthlyFee.year == year,
            FinancialMonthlyFee.month == month,
            FinancialMonthlyFee.deleted_at.is_(None),
        ).group_by(FinancialMonthlyFee.status)
        fees_res = (await self.db.execute(fees_period_query)).all()

        total_fees_paid = 0.0
        total_fees_pending = 0.0
        count_paid = 0
        count_pending = 0
        count_exempt = 0

        for status_val, count_val, sum_val in fees_res:
            sum_val = float(sum_val or 0.0)
            if status_val == "paid":
                total_fees_paid += sum_val
                count_paid += count_val
            elif status_val == "pending":
                total_fees_pending += sum_val
                count_pending += count_val
            elif status_val == "exempt":
                count_exempt += count_val

        # 2. Custos do período selecionado
        costs_period_query = select(
            FinancialCost.status,
            func.coalesce(func.sum(FinancialCost.amount), 0.0),
        ).where(
            extract("year", FinancialCost.cost_date) == year,
            extract("month", FinancialCost.cost_date) == month,
            FinancialCost.deleted_at.is_(None),
        ).group_by(FinancialCost.status)
        costs_res = (await self.db.execute(costs_period_query)).all()

        total_costs_paid = 0.0
        total_costs_pending = 0.0
        for status_val, sum_val in costs_res:
            sum_val = float(sum_val or 0.0)
            if status_val == "paid":
                total_costs_paid += sum_val
            elif status_val == "pending":
                total_costs_pending += sum_val

        period_balance = total_fees_paid - total_costs_paid

        # 3. Totais gerais acumulados
        overall_fees_query = select(
            FinancialMonthlyFee.status,
            func.coalesce(func.sum(FinancialMonthlyFee.amount), 0.0),
        ).where(
            FinancialMonthlyFee.deleted_at.is_(None),
        ).group_by(FinancialMonthlyFee.status)
        overall_fees_res = (await self.db.execute(overall_fees_query)).all()

        total_overall_revenue = 0.0
        total_pending_receivables = 0.0
        for status_val, sum_val in overall_fees_res:
            sum_val = float(sum_val or 0.0)
            if status_val == "paid":
                total_overall_revenue += sum_val
            elif status_val == "pending":
                total_pending_receivables += sum_val

        overall_costs_query = select(
            FinancialCost.status,
            func.coalesce(func.sum(FinancialCost.amount), 0.0),
        ).where(
            FinancialCost.deleted_at.is_(None),
        ).group_by(FinancialCost.status)
        overall_costs_res = (await self.db.execute(overall_costs_query)).all()

        total_overall_expenses = 0.0
        for status_val, sum_val in overall_costs_res:
            sum_val = float(sum_val or 0.0)
            if status_val == "paid":
                total_overall_expenses += sum_val

        total_balance = total_overall_revenue - total_overall_expenses

        # 4. Tendências dos últimos 6 meses
        month_names = [
            "", "Jan", "Fev", "Mar", "Abr", "Mai", "Jun",
            "Jul", "Ago", "Set", "Out", "Nov", "Dez"
        ]
        trends = []
        # Calcular os últimos 6 meses terminando no mês selecionado
        cur_y = year
        cur_m = month
        months_to_calc = []
        for _ in range(6):
            months_to_calc.append((cur_y, cur_m))
            cur_m -= 1
            if cur_m == 0:
                cur_m = 12
                cur_y -= 1
        months_to_calc.reverse()

        for y, m in months_to_calc:
            fee_q = select(func.coalesce(func.sum(FinancialMonthlyFee.amount), 0.0)).where(
                FinancialMonthlyFee.year == y,
                FinancialMonthlyFee.month == m,
                FinancialMonthlyFee.status == "paid",
                FinancialMonthlyFee.deleted_at.is_(None),
            )
            cost_q = select(func.coalesce(func.sum(FinancialCost.amount), 0.0)).where(
                extract("year", FinancialCost.cost_date) == y,
                extract("month", FinancialCost.cost_date) == m,
                FinancialCost.status == "paid",
                FinancialCost.deleted_at.is_(None),
            )
            m_rev = float((await self.db.execute(fee_q)).scalar() or 0.0)
            m_cost = float((await self.db.execute(cost_q)).scalar() or 0.0)
            label = f"{month_names[m]}/{str(y)[2:]}"
            trends.append({
                "year": y,
                "month": m,
                "label": label,
                "revenue": m_rev,
                "costs": m_cost,
                "balance": m_rev - m_cost,
            })

        return {
            "period": {
                "year": year,
                "month": month,
                "total_fees_paid": total_fees_paid,
                "total_fees_pending": total_fees_pending,
                "fees_count_paid": count_paid,
                "fees_count_pending": count_pending,
                "fees_count_exempt": count_exempt,
                "total_costs_paid": total_costs_paid,
                "total_costs_pending": total_costs_pending,
                "period_balance": period_balance,
            },
            "overall": {
                "total_revenue": total_overall_revenue,
                "total_expenses": total_overall_expenses,
                "total_balance": total_balance,
                "total_pending_receivables": total_pending_receivables,
            },
            "trends": trends,
        }
