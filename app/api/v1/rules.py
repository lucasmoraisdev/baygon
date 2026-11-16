from typing import Dict, List, Optional
from pydantic import BaseModel
from fastapi import APIRouter, Depends, status, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.dependencies.auth_dependencies import user_has_permission
from app.core.services.rule_service import RuleService
from app.db.base import get_db
from app.db.repositories.event_score_rule_repository import EventScoreRuleRepository
from app.schemas.event_score_rule_schema import EventScoreRuleCreate, EventScoreRuleRead, EventScoreRuleUpdate

router = APIRouter(prefix="/rules", tags=["Rules"])

@router.post("/", response_model=EventScoreRuleRead, status_code=status.HTTP_201_CREATED)
async def create_rule(
    rule_create: EventScoreRuleCreate,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(user_has_permission)
):
    repo = EventScoreRuleRepository(db)
    service = RuleService(repo)
    return await service.create_rule(rule_create.model_dump())

@router.get("/{rule_id}", response_model=EventScoreRuleRead, status_code=status.HTTP_200_OK)
async def get_rule(
    rule_id: int,
    db: AsyncSession = Depends(get_db)
):
    repo = EventScoreRuleRepository(db)
    service = RuleService(repo)
    rule_obj = await service.get_rule_by_id(rule_id)
    if not rule_obj:
        raise HTTPException(status_code=404, detail="Rule not found")
    return rule_obj

@router.get("/season/{season_id}", response_model=List[EventScoreRuleRead])
async def list_rules_by_season(
    season_id: int,
    db: AsyncSession = Depends(get_db)
):
    repo = EventScoreRuleRepository(db)
    service = RuleService(repo)
    return await service.list_rules_by_season(season_id)

@router.put("/{rule_id}", response_model=EventScoreRuleRead, status_code=status.HTTP_200_OK)
async def update_rule(
    rule_id: int,
    rule_update: EventScoreRuleUpdate,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(user_has_permission)
):
    repo = EventScoreRuleRepository(db)
    service = RuleService(repo)
    updated_rule = await service.edit_rule(rule_id, rule_update.model_dump(exclude_unset=True))
    if not updated_rule:
        raise HTTPException(status_code=404, detail="Rule not found")
    return updated_rule

@router.delete("/{rule_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_rule(
    rule_id: int,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(user_has_permission)
):
    repo = EventScoreRuleRepository(db)
    service = RuleService(repo)
    success = await service.delete_rule(rule_id)
    if not success:
        raise HTTPException(status_code=404, detail="Rule not found")
    return


@router.post("/season/{season_id}/seed-defaults", response_model=List[EventScoreRuleRead], status_code=status.HTTP_201_CREATED)
async def seed_default_rules(
    season_id: int,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(user_has_permission),
):
    """Cria as regras padrão de pontuação para uma temporada (sem duplicar existentes)."""
    repo = EventScoreRuleRepository(db)
    service = RuleService(repo)
    return await service.seed_default_rules(season_id)


class ExtraPlayerStatsItem(BaseModel):
    wins: int = 0
    draws: int = 0
    losses: int = 0


class CalculateScoresPayload(BaseModel):
    collaboration_points: Optional[Dict[str, int]] = None
    extra_player_stats: Optional[Dict[str, ExtraPlayerStatsItem]] = None


@router.post("/round/{round_id}/calculate-scores", status_code=status.HTTP_200_OK)
async def calculate_round_scores(
    round_id: int,
    payload: Optional[CalculateScoresPayload] = None,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(user_has_permission),
):
    """Calcula e atualiza PlayerScore e PlayerSeasonScore de uma rodada com base nas regras da temporada."""
    repo = EventScoreRuleRepository(db)
    service = RuleService(repo)
    colab = None
    if payload and payload.collaboration_points:
        colab = {int(k): v for k, v in payload.collaboration_points.items() if k.isdigit() or isinstance(k, int)}
    extra_stats = None
    if payload and payload.extra_player_stats:
        extra_stats = {}
        for k, v in payload.extra_player_stats.items():
            try:
                extra_stats[int(k)] = v.model_dump()
            except (ValueError, TypeError):
                pass
    return await service.calculate_round_scores(
        round_id, collaboration_points=colab, extra_player_stats=extra_stats
    )
