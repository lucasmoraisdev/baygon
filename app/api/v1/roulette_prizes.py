from typing import List
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.dependencies.auth_dependencies import user_has_permission
from app.core.services.roulette_prize_service import RoulettePrizeService
from app.db.base import get_db
from app.db.repositories.roulette_prize_repository import RoulettePrizeRepository
from app.schemas.roulette_prize_schema import (
    RoundRouletteBatchPayload,
    RoundRouletteWinnerRead,
    RoulettePrizeCreate,
    RoulettePrizeRead,
    RoulettePrizeUpdate,
)

router = APIRouter(prefix="/roulette-prizes", tags=["Roulette Prizes"])


@router.get("/", response_model=List[RoulettePrizeRead], status_code=status.HTTP_200_OK)
async def list_prizes(
    include_inactive: bool = False,
    db: AsyncSession = Depends(get_db),
):
    repo = RoulettePrizeRepository(db)
    service = RoulettePrizeService(repo)
    return await service.list_prizes(include_inactive=include_inactive)


@router.post("/", response_model=RoulettePrizeRead, status_code=status.HTTP_201_CREATED)
async def create_prize(
    prize_data: RoulettePrizeCreate,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(user_has_permission),
):
    repo = RoulettePrizeRepository(db)
    service = RoulettePrizeService(repo)
    return await service.create_prize(prize_data.model_dump())


@router.put("/{prize_id}", response_model=RoulettePrizeRead, status_code=status.HTTP_200_OK)
async def edit_prize(
    prize_id: int,
    prize_data: RoulettePrizeUpdate,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(user_has_permission),
):
    repo = RoulettePrizeRepository(db)
    service = RoulettePrizeService(repo)
    updated = await service.edit_prize(prize_id, prize_data.model_dump(exclude_unset=True))
    if not updated:
        raise HTTPException(status_code=404, detail="Prêmio não encontrado")
    return updated


@router.delete("/{prize_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_prize(
    prize_id: int,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(user_has_permission),
):
    repo = RoulettePrizeRepository(db)
    service = RoulettePrizeService(repo)
    success = await service.delete_prize(prize_id)
    if not success:
        raise HTTPException(status_code=404, detail="Prêmio não encontrado")
    return


@router.get("/round/{round_id}", response_model=List[RoundRouletteWinnerRead], status_code=status.HTTP_200_OK)
async def get_round_roulette_winners(
    round_id: int,
    db: AsyncSession = Depends(get_db),
):
    repo = RoulettePrizeRepository(db)
    service = RoulettePrizeService(repo)
    winners = await service.get_round_winners(round_id)
    result: List[RoundRouletteWinnerRead] = []
    for w in winners:
        pl_name = (w.player.apelido or w.player.nome) if w.player else None
        prz_name = w.prize.name if w.prize else None
        result.append(
            RoundRouletteWinnerRead(
                id_round_roulette=w.id_round_roulette,
                round_id=w.round_id,
                player_id=w.player_id,
                prize_id=w.prize_id,
                roulette_number=w.roulette_number,
                player_name=pl_name,
                prize_name=prz_name,
            )
        )
    return result


@router.post("/round/{round_id}", response_model=List[RoundRouletteWinnerRead], status_code=status.HTTP_200_OK)
async def set_round_roulette_winners(
    round_id: int,
    payload: RoundRouletteBatchPayload,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(user_has_permission),
):
    repo = RoulettePrizeRepository(db)
    service = RoulettePrizeService(repo)
    winners_data = [item.model_dump() for item in payload.winners]
    saved = await service.save_round_winners(round_id, winners_data)
    result: List[RoundRouletteWinnerRead] = []
    for w in saved:
        pl_name = (w.player.apelido or w.player.nome) if w.player else None
        prz_name = w.prize.name if w.prize else None
        result.append(
            RoundRouletteWinnerRead(
                id_round_roulette=w.id_round_roulette,
                round_id=w.round_id,
                player_id=w.player_id,
                prize_id=w.prize_id,
                roulette_number=w.roulette_number,
                player_name=pl_name,
                prize_name=prz_name,
            )
        )
    return result
