from typing import List, Optional, Dict, Any
from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.base import get_db
from app.db.models.season import Seasons
from app.core.dependencies.auth_dependencies import get_current_user, user_has_permission
from app.core.dependencies.modules import require_module
from app.core.tenant_context import get_current_tenant_id
from app.core.services.tournament_service import TournamentService
from app.core.services.team_standings_service import TeamStandingsService
from app.core.services.tournament_quota_service import TournamentQuotaService
from app.schemas.tournament_schema import (
    TournamentCreate,
    TournamentRead,
    TournamentTeamCreate,
    TournamentStandingsResponse,
    TournamentBracketResponse,
    MatchResultUpdate,
    DrawBracketRequest,
    TournamentRoundRead,
)

router = APIRouter(prefix="/tournaments", tags=["Tournaments & Championships"])


class AdvanceStageRequest(BaseModel):
    current_stage: str = Field(..., description="Fase atual (ex: quarterfinals, semifinals)")
    next_stage: str = Field(..., description="Próxima fase (ex: semifinals, final)")


@router.get(
    "/quota",
    response_model=Dict[str, Any],
    status_code=status.HTTP_200_OK,
    dependencies=[Depends(require_module("competitions"))],
)
async def get_tournament_quota(
    db: AsyncSession = Depends(get_db),
):
    """
    Retorna os limites e o consumo atual de torneios do tenant ativo no banco:
    plan_code, tournaments_created, tournaments_limit, tournaments_remaining e can_create.
    """
    active_tenant = get_current_tenant_id()
    quota_service = TournamentQuotaService(db)
    return await quota_service.get_tenant_quota(active_tenant)


@router.post(
    "/",
    response_model=TournamentRead,
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(require_module("competitions"))],
)
async def create_tournament(
    payload: TournamentCreate,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(user_has_permission),
):
    """
    Cria um novo campeonato/torneio profissional no formato escolhido:
    - pontos_corridos (Liga com times fixos)
    - mata_mata (Chaveamento eliminatório/playoffs)
    - grupos_e_mata_mata (Fase de grupos com mata-mata)
    - individual_points (Pelada/rachão semanal com pontuação individual)

    Valida previamente no banco de dados se o tenant possui cota de criação disponível.
    """
    active_tenant = get_current_tenant_id()
    quota_service = TournamentQuotaService(db)
    await quota_service.assert_can_create_tournament(active_tenant)

    service = TournamentService(db)
    try:
        new_tourn = await service.create_tournament(payload, tenant_id=active_tenant)
        return new_tourn
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))


@router.get(
    "/",
    response_model=List[TournamentRead],
    status_code=status.HTTP_200_OK,
    dependencies=[Depends(require_module("competitions"))],
)
async def list_tournaments(
    db: AsyncSession = Depends(get_db),
):
    """
    Lista todos os campeonatos/torneios da associação ativa.
    """
    stmt = select(Seasons).where(Seasons.deleted_at.is_(None)).order_by(Seasons.number.desc())
    tournaments = list((await db.execute(stmt)).scalars().all())
    return tournaments


@router.get(
    "/{tournament_id}",
    response_model=TournamentRead,
    status_code=status.HTTP_200_OK,
    dependencies=[Depends(require_module("competitions"))],
)
async def get_tournament(
    tournament_id: int,
    db: AsyncSession = Depends(get_db),
):
    """
    Retorna os dados detalhados de um campeonato específico.
    """
    stmt = select(Seasons).where(Seasons.id_season == tournament_id, Seasons.deleted_at.is_(None))
    tourn = (await db.execute(stmt)).scalar_one_or_none()
    if not tourn:
        raise HTTPException(status_code=404, detail="Campeonato não encontrado nesta associação.")
    return tourn


@router.post(
    "/{tournament_id}/teams",
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(require_module("competitions"))],
)
async def add_teams_to_tournament(
    tournament_id: int,
    teams: List[TournamentTeamCreate],
    db: AsyncSession = Depends(get_db),
    current_user=Depends(user_has_permission),
):
    """
    Inscreve equipes permanentes no campeonato, associando-as ao torneio ou grupos.
    """
    service = TournamentService(db)
    try:
        created = await service.add_teams_to_tournament(tournament_id, teams)
        return {
            "status": "success",
            "message": f"{len(created)} equipes inscritas no campeonato.",
            "teams": [{"id_team": t.id_team, "name": t.name, "group_name": t.group_name} for t in created],
        }
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))


@router.get(
    "/{tournament_id}/teams",
    status_code=status.HTTP_200_OK,
    dependencies=[Depends(require_module("competitions"))],
)
async def list_tournament_teams(
    tournament_id: int,
    db: AsyncSession = Depends(get_db),
):
    """
    Lista todas as equipes inscritas no campeonato.
    """
    service = TournamentService(db)
    teams = await service.get_tournament_teams(tournament_id)
    return [{"id_team": t.id_team, "name": t.name, "color": t.color, "group_name": t.group_name} for t in teams]


@router.post(
    "/{tournament_id}/generate-fixtures",
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(require_module("competitions"))],
)
async def generate_fixtures(
    tournament_id: int,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(user_has_permission),
):
    """
    Gera automaticamente a tabela de confrontos (rodadas e partidas)
    com base no formato do campeonato (Round-robin de pontos corridos, grupos ou chaves de mata-mata).
    """
    service = TournamentService(db)
    try:
        rounds = await service.generate_fixtures(tournament_id, filmed_by_user_id=current_user.id_user)
        return {
            "status": "success",
            "message": f"{len(rounds)} rodadas geradas com sucesso para o campeonato.",
            "rounds_count": len(rounds),
        }
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))


@router.get(
    "/{tournament_id}/standings",
    response_model=TournamentStandingsResponse,
    status_code=status.HTTP_200_OK,
    dependencies=[Depends(require_module("competitions"))],
)
async def get_tournament_standings(
    tournament_id: int,
    db: AsyncSession = Depends(get_db),
):
    """
    Retorna a tabela de classificação de equipes (Pontos Corridos ou Fase de Grupos)
    com P, J, V, E, D, GP, GC, SG e % de aproveitamento.
    """
    standings_service = TeamStandingsService(db)
    try:
        return await standings_service.calculate_standings(tournament_id)
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc))


@router.get(
    "/{tournament_id}/bracket",
    response_model=TournamentBracketResponse,
    status_code=status.HTTP_200_OK,
    dependencies=[Depends(require_module("competitions"))],
)
async def get_tournament_bracket(
    tournament_id: int,
    db: AsyncSession = Depends(get_db),
):
    """
    Retorna a árvore do chaveamento eliminatório (Mata-Mata) com os confrontos e vencedores.
    """
    service = TournamentService(db)
    try:
        return await service.get_bracket(tournament_id)
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc))


@router.post(
    "/{tournament_id}/advance-stage",
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(require_module("competitions"))],
)
async def advance_playoff_stage(
    tournament_id: int,
    payload: AdvanceStageRequest,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(user_has_permission),
):
    """
    Avança os vencedores da fase atual (ex: quarterfinals) para a próxima fase (ex: semifinals) no mata-mata.
    """
    service = TournamentService(db)
    try:
        next_r = await service.advance_playoff_stage(
            tournament_id=tournament_id,
            current_stage=payload.current_stage,
            next_stage=payload.next_stage,
            filmed_by_user_id=current_user.id_user,
        )
        return {
            "status": "success",
            "message": f"Confrontos da fase {payload.next_stage} gerados na rodada #{next_r.round_number}.",
            "round_id": next_r.id_round,
        }
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))


@router.put(
    "/{tournament_id}/matches/{match_id}/result",
    status_code=status.HTTP_200_OK,
    dependencies=[Depends(require_module("competitions"))],
)
async def update_tournament_match_result(
    tournament_id: int,
    match_id: int,
    payload: MatchResultUpdate,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(user_has_permission),
):
    """
    Registra ou atualiza o placar e pênaltis de uma partida de campeonato.
    Define o resultado final, tipo de evento e finalização da partida.
    """
    service = TournamentService(db)
    try:
        updated = await service.update_match_result(
            tournament_id=tournament_id,
            match_id=match_id,
            score_home=payload.score_home,
            score_away=payload.score_away,
            penalties_home=payload.penalties_home or 0,
            penalties_away=payload.penalties_away or 0,
            is_finished=payload.is_finished,
        )
        return {
            "status": "success",
            "message": f"Placar da partida #{match_id} registrado com sucesso.",
            "match": {
                "id_match": updated.id_match,
                "score_home": updated.score_home,
                "score_away": updated.score_away,
                "penalties_home": updated.penalties_home,
                "penalties_away": updated.penalties_away,
                "is_finished": updated.is_finished,
            },
        }
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))


@router.post(
    "/{tournament_id}/draw-bracket",
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(require_module("competitions"))],
)
async def draw_playoff_bracket(
    tournament_id: int,
    payload: DrawBracketRequest,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(user_has_permission),
):
    """
    Realiza o sorteio dos confrontos iniciais do chaveamento eliminatório (Playoffs).
    """
    service = TournamentService(db)
    try:
        rnd = await service.draw_playoff_bracket(
            tournament_id=tournament_id,
            seed_mode=payload.seed_mode,
            filmed_by_user_id=current_user.id_user,
        )
        return {
            "status": "success",
            "message": f"Chaveamento sorteado com sucesso para a rodada #{rnd.round_number}.",
            "round_id": rnd.id_round,
        }
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))


@router.get(
    "/{tournament_id}/rounds",
    response_model=List[TournamentRoundRead],
    status_code=status.HTTP_200_OK,
    dependencies=[Depends(require_module("competitions"))],
)
async def list_tournament_rounds(
    tournament_id: int,
    db: AsyncSession = Depends(get_db),
):
    """
    Lista todas as rodadas e partidas detalhadas do campeonato.
    """
    service = TournamentService(db)
    return await service.get_tournament_rounds_with_matches(tournament_id)
