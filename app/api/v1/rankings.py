from typing import List, Optional
from fastapi import APIRouter, Depends, Query, status, HTTPException
from fastapi.responses import Response
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.dependencies.auth_dependencies import user_has_permission
from app.core.services.association_ranking_service import AssociationRankingService
from app.core.services.score_service import ScoreService
from app.db.base import get_db
from app.db.repositories.player_score_repository import PlayerScoreRepository
from app.schemas.player_score_schema import PlayerScoreCreate, PlayerScoreRead, PlayerScoreUpdate
from app.schemas.ranking_schema import AssociationRankingResponse

router = APIRouter(prefix="/rankings", tags=["Rankings / Scores"])


@router.get("/association", response_model=AssociationRankingResponse)
async def get_association_ranking(
    season_id: Optional[int] = Query(None),
    db: AsyncSession = Depends(get_db),
):
    service = AssociationRankingService(db)
    return await service.get_season_ranking(season_id=season_id)


@router.get("/season/{season_id}/association", response_model=AssociationRankingResponse)
async def get_season_association_ranking(
    season_id: int,
    db: AsyncSession = Depends(get_db),
):
    service = AssociationRankingService(db)
    return await service.get_season_ranking(season_id=season_id)


@router.get("/season/{season_id}/export-csv")
async def export_season_association_ranking_csv(
    season_id: int,
    db: AsyncSession = Depends(get_db),
):
    service = AssociationRankingService(db)
    csv_content, season_number = await service.export_season_ranking_csv(season_id=season_id)
    filename = f"ranking_associacao_baygon_t{season_number or season_id}.csv"
    return Response(
        content=csv_content.encode("utf-8-sig"),
        media_type="text/csv; charset=utf-8",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


@router.post("/", response_model=PlayerScoreRead, status_code=status.HTTP_201_CREATED)
async def create_score(
    score_create: PlayerScoreCreate,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(user_has_permission)
):
    repo = PlayerScoreRepository(db)
    service = ScoreService(repo)
    return await service.create_score(score_create.model_dump())

@router.get("/", response_model=List[PlayerScoreRead])
async def list_all_scores(
    db: AsyncSession = Depends(get_db)
):
    repo = PlayerScoreRepository(db)
    service = ScoreService(repo)
    return await service.list_all_scores()

@router.get("/{score_id}", response_model=PlayerScoreRead, status_code=status.HTTP_200_OK)
async def get_score(
    score_id: int,
    db: AsyncSession = Depends(get_db)
):
    repo = PlayerScoreRepository(db)
    service = ScoreService(repo)
    score_obj = await service.get_score_by_id(score_id)
    if not score_obj:
        raise HTTPException(status_code=404, detail="Score not found")
    return score_obj

@router.get("/round/{round_id}", response_model=List[PlayerScoreRead])
async def get_scores_by_round(
    round_id: int,
    db: AsyncSession = Depends(get_db)
):
    repo = PlayerScoreRepository(db)
    service = ScoreService(repo)
    return await service.get_scores_by_round(round_id)

@router.get("/season/{season_id}", response_model=List[PlayerScoreRead])
async def get_scores_by_season(
    season_id: int,
    db: AsyncSession = Depends(get_db)
):
    repo = PlayerScoreRepository(db)
    service = ScoreService(repo)
    return await service.get_scores_by_season(season_id)

@router.put("/{score_id}", response_model=PlayerScoreRead, status_code=status.HTTP_200_OK)
async def update_score(
    score_id: int,
    score_update: PlayerScoreUpdate,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(user_has_permission)
):
    repo = PlayerScoreRepository(db)
    service = ScoreService(repo)
    updated_score = await service.edit_score(score_id, score_update.model_dump(exclude_unset=True))
    if not updated_score:
        raise HTTPException(status_code=404, detail="Score not found")
    return updated_score

@router.delete("/{score_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_score(
    score_id: int,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(user_has_permission)
):
    repo = PlayerScoreRepository(db)
    service = ScoreService(repo)
    success = await service.delete_score(score_id)
    if not success:
        raise HTTPException(status_code=404, detail="Score not found")
    return
