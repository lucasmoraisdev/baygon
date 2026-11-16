from datetime import datetime, timezone
from typing import List, Optional, Sequence
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.db.models.roulette_prize import RoulettePrize
from app.db.models.round_roulette_winner import RoundRouletteWinner


class RoulettePrizeRepository:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def list_all(self, include_inactive: bool = False) -> Sequence[RoulettePrize]:
        query = select(RoulettePrize).where(RoulettePrize.deleted_at.is_(None))
        if not include_inactive:
            query = query.where(RoulettePrize.is_active.is_(True))
        query = query.order_by(RoulettePrize.name.asc())
        result = await self.db.execute(query)
        return result.scalars().all()

    async def get_by_id(self, prize_id: int) -> Optional[RoulettePrize]:
        query = select(RoulettePrize).where(
            RoulettePrize.id_roulette_prize == prize_id,
            RoulettePrize.deleted_at.is_(None),
        )
        result = await self.db.execute(query)
        return result.scalars().first()

    async def create(self, prize: RoulettePrize) -> RoulettePrize:
        self.db.add(prize)
        await self.db.commit()
        await self.db.refresh(prize)
        return prize

    async def update(self, prize_id: int, updates: dict) -> Optional[RoulettePrize]:
        prize = await self.get_by_id(prize_id)
        if not prize:
            return None
        for key, value in updates.items():
            if hasattr(prize, key):
                setattr(prize, key, value)
        prize.updated_at = datetime.now(timezone.utc)
        await self.db.commit()
        await self.db.refresh(prize)
        return prize

    async def delete(self, prize_id: int) -> bool:
        prize = await self.get_by_id(prize_id)
        if not prize:
            return False
        prize.deleted_at = datetime.now(timezone.utc)
        await self.db.commit()
        return True

    async def list_round_winners(self, round_id: int) -> Sequence[RoundRouletteWinner]:
        query = (
            select(RoundRouletteWinner)
            .options(
                selectinload(RoundRouletteWinner.player),
                selectinload(RoundRouletteWinner.prize),
            )
            .where(
                RoundRouletteWinner.round_id == round_id,
                RoundRouletteWinner.deleted_at.is_(None),
            )
            .order_by(RoundRouletteWinner.roulette_number.asc())
        )
        result = await self.db.execute(query)
        return result.scalars().all()

    async def sync_round_winners(
        self, round_id: int, winners_data: List[dict]
    ) -> Sequence[RoundRouletteWinner]:
        # Soft-delete vencedores antigos da rodada
        existing = await self.list_round_winners(round_id)
        now = datetime.now(timezone.utc)
        for w in existing:
            w.deleted_at = now

        created_objs: List[RoundRouletteWinner] = []
        for item in winners_data:
            if not item.get("player_id"):
                continue
            obj = RoundRouletteWinner(
                round_id=round_id,
                player_id=item["player_id"],
                prize_id=item.get("prize_id"),
                roulette_number=item.get("roulette_number", 1),
            )
            self.db.add(obj)
            created_objs.append(obj)

        await self.db.commit()
        return await self.list_round_winners(round_id)
