from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.dependencies.auth_dependencies import get_current_user, user_has_permission
from app.core.services.fantasy_service import FantasyService
from app.db.base import get_db
from app.db.models.user import User
from app.db.repositories.fantasy_repository import FantasyRepository
from app.schemas.fantasy_schema import (
    FantasyCalculationSummary,
    FantasyLineupRead,
    FantasyLineupSavePayload,
    FantasyPlayerRead,
    FantasyRoundConfigRead,
    FantasyRoundConfigUpdate,
    FantasyRoundRankingResponse,
    FantasySeasonRankingResponse,
    FantasySettingRead,
    FantasySettingUpdate,
    FantasyTeamRead,
    FantasyTeamUpdate,
)

router = APIRouter(prefix="/fantasy", tags=["Fantasy Game"])


def get_fantasy_service(db: AsyncSession = Depends(get_db)) -> FantasyService:
    repo = FantasyRepository(db)
    return FantasyService(repo, db)


# ---------------- STATUS & SETTINGS ----------------

@router.get("/status", status_code=status.HTTP_200_OK)
async def get_fantasy_status(
    season_id: Optional[int] = Query(None, description="ID da temporada"),
    service: FantasyService = Depends(get_fantasy_service),
    current_user: User = Depends(get_current_user),
):
    """
    Retorna o status da feature de Fantasy Game para a temporada ativa ou informada.
    """
    settings = await service.get_settings(season_id)
    return {
        "is_enabled": settings.is_enabled,
        "season_id": settings.season_id,
        "initial_budget": settings.initial_budget,
    }


@router.get("/settings", response_model=FantasySettingRead, status_code=status.HTTP_200_OK)
async def get_fantasy_settings(
    season_id: Optional[int] = Query(None, description="ID da temporada"),
    service: FantasyService = Depends(get_fantasy_service),
    current_user: User = Depends(get_current_user),
):
    return await service.get_settings(season_id)


@router.put("/settings", response_model=FantasySettingRead, status_code=status.HTTP_200_OK)
async def update_fantasy_settings(
    payload: FantasySettingUpdate,
    season_id: Optional[int] = Query(None, description="ID da temporada"),
    service: FantasyService = Depends(get_fantasy_service),
    admin_user: User = Depends(user_has_permission),
):
    """(Admin) Altera configurações gerais do Fantasy (ativar/desativar, orçamento inicial, etc)."""
    return await service.update_settings(payload, season_id)


# ---------------- ROUND CONFIG ----------------

@router.get("/rounds/{round_id}/config", response_model=FantasyRoundConfigRead, status_code=status.HTTP_200_OK)
async def get_round_config(
    round_id: int,
    service: FantasyService = Depends(get_fantasy_service),
    current_user: User = Depends(get_current_user),
):
    return await service.get_round_config(round_id)


@router.put("/rounds/{round_id}/config", response_model=FantasyRoundConfigRead, status_code=status.HTTP_200_OK)
async def update_round_config(
    round_id: int,
    payload: FantasyRoundConfigUpdate,
    service: FantasyService = Depends(get_fantasy_service),
    admin_user: User = Depends(user_has_permission),
):
    """(Admin) Define o número de vagas da rodada, regras de posições/potes e abre/fecha o mercado."""
    return await service.update_round_config(round_id, payload)


@router.post("/rounds/{round_id}/calculate", response_model=FantasyCalculationSummary, status_code=status.HTTP_200_OK)
async def calculate_round(
    round_id: int,
    service: FantasyService = Depends(get_fantasy_service),
    admin_user: User = Depends(user_has_permission),
):
    """(Admin) Liquida e apura a rodada: calcula pontuação das escalações, atualiza preços e rankings."""
    return await service.calculate_round(round_id)


# ---------------- MARKET ----------------

@router.get("/market", response_model=List[FantasyPlayerRead], status_code=status.HTTP_200_OK)
async def get_market(
    season_id: Optional[int] = Query(None),
    round_id: Optional[int] = Query(None),
    service: FantasyService = Depends(get_fantasy_service),
    current_user: User = Depends(get_current_user),
):
    return await service.get_market(season_id=season_id, round_id=round_id)


# ---------------- TEAM & LINEUPS ----------------

@router.get("/my-team", response_model=FantasyTeamRead, status_code=status.HTTP_200_OK)
async def get_my_team(
    season_id: Optional[int] = Query(None),
    service: FantasyService = Depends(get_fantasy_service),
    current_user: User = Depends(get_current_user),
):
    return await service.get_my_team(current_user.id_user, season_id)


@router.put("/my-team", response_model=FantasyTeamRead, status_code=status.HTTP_200_OK)
async def update_my_team(
    payload: FantasyTeamUpdate,
    season_id: Optional[int] = Query(None),
    service: FantasyService = Depends(get_fantasy_service),
    current_user: User = Depends(get_current_user),
):
    return await service.update_my_team(current_user.id_user, payload, season_id)


@router.get("/rounds/{round_id}/lineup", response_model=Optional[FantasyLineupRead], status_code=status.HTTP_200_OK)
async def get_lineup(
    round_id: int,
    team_id: Optional[int] = Query(None, description="ID do time fantasy a visualizar. Se omitido, retorna a escalação do usuário atual."),
    service: FantasyService = Depends(get_fantasy_service),
    current_user: User = Depends(get_current_user),
):
    return await service.get_lineup(current_user, round_id, team_id=team_id)


@router.post("/rounds/{round_id}/lineup", response_model=FantasyLineupRead, status_code=status.HTTP_200_OK)
async def save_lineup(
    round_id: int,
    payload: FantasyLineupSavePayload,
    service: FantasyService = Depends(get_fantasy_service),
    current_user: User = Depends(get_current_user),
):
    return await service.save_lineup(current_user.id_user, round_id, payload)


# ---------------- RANKINGS ----------------

@router.get("/rankings/round/{round_id}", response_model=FantasyRoundRankingResponse, status_code=status.HTTP_200_OK)
async def get_round_ranking(
    round_id: int,
    service: FantasyService = Depends(get_fantasy_service),
    current_user: User = Depends(get_current_user),
):
    return await service.get_round_ranking(round_id)


@router.get("/rankings/season", response_model=FantasySeasonRankingResponse, status_code=status.HTTP_200_OK)
async def get_season_ranking(
    season_id: Optional[int] = Query(None),
    service: FantasyService = Depends(get_fantasy_service),
    current_user: User = Depends(get_current_user),
):
    return await service.get_season_ranking(season_id)
