from typing import List, Dict, Any
from fastapi import APIRouter, Depends, status, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from pydantic import BaseModel
from app.core.dependencies.auth_dependencies import user_has_permission
from app.core.services.player_service import PlayerService
from app.core.services.player_admin_action_service import PlayerAdminActionService
from app.db.base import get_db
from app.db.repositories.player_repository import PlayerRepository
from app.db.repositories.player_admin_action_repository import PlayerAdminActionRepository
from app.schemas.player_schema import PlayerCreate, PlayerRead, PlayerUpdate, PlayerProfileRead, PlayerStatsRead, SeasonStatsDetail

router = APIRouter(prefix="/players", tags=["Players"])

# Request models para ações de admin
class SuspendPlayerRequest(BaseModel):
    suspension_type: str = "days" # 'days', 'games', 'weeks', 'indefinite'
    value: int = 1


class ApplyFineRequest(BaseModel):
    fine_amount: float


class AddObservationRequest(BaseModel):
    observations: str

@router.post("/", response_model=PlayerRead, status_code=status.HTTP_201_CREATED)
async def create_player(
    player_create: PlayerCreate,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(user_has_permission)
):
    repo = PlayerRepository(db)
    service = PlayerService(repo)
    return await service.create_player(player_create.model_dump())

@router.get("/", response_model=List[PlayerRead])
async def list_players(
    db: AsyncSession = Depends(get_db)
):
    repo = PlayerRepository(db)
    service = PlayerService(repo)
    return await service.list_all_players()

@router.get("/{player_id}/profile", response_model=PlayerProfileRead, status_code=status.HTTP_200_OK)
async def get_player_profile(
    player_id: int,
    db: AsyncSession = Depends(get_db)
):
    """Retorna o perfil completo do jogador com estatísticas"""
    repo = PlayerRepository(db)
    service = PlayerService(repo)
    player_obj = await service.get_player_by_id(player_id)
    if not player_obj:
        raise HTTPException(status_code=404, detail="Player not found")
    
    # Obter estatísticas
    stats_data = await service.get_player_stats(player_id)
    season_stats_data = await service.get_player_season_stats(player_id)
    
    # Construir resposta
    stats = PlayerStatsRead(**stats_data)
    season_stats = [SeasonStatsDetail(**s) for s in season_stats_data]
    
    # Preparar teams e awards
    print(f"Player object: {player_obj}")
    teams = [{"id_team": t.id_team, "name": t.name} for t in player_obj.teams] if hasattr(player_obj, 'teams') else []
    awards = [{"id_award": a.id_award, "event_type": str(a.event_type)} for a in player_obj.awards] if hasattr(player_obj, 'awards') else []
    
    return PlayerProfileRead(
        id_player=player_obj.id_player,
        nome=player_obj.nome,
        apelido=player_obj.apelido,
        email=player_obj.email,
        telefone=player_obj.telefone,
        posicao=player_obj.posicao,
        pe=player_obj.pe,
        potes=player_obj.potes,
        user_id=player_obj.user_id,
        is_associate=player_obj.is_associate,
        is_guest=player_obj.is_guest,
        created_at=player_obj.created_at,
        updated_at=player_obj.updated_at,
        stats=stats,
        season_stats=season_stats,
        teams=teams,
        awards=awards
    )

@router.get("/{player_id}", response_model=PlayerRead, status_code=status.HTTP_200_OK)
async def get_player(
    player_id: int,
    db: AsyncSession = Depends(get_db)
):
    repo = PlayerRepository(db)
    service = PlayerService(repo)
    player_obj = await service.get_player_by_id(player_id)
    if not player_obj:
        raise HTTPException(status_code=404, detail="Player not found")
    return player_obj

@router.put("/{player_id}", response_model=PlayerRead, status_code=status.HTTP_200_OK)
async def update_player(
    player_id: int,
    player_update: PlayerUpdate,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(user_has_permission)
):
    repo = PlayerRepository(db)
    service = PlayerService(repo)
    updated_player = await service.edit_player(player_id, player_update.model_dump(exclude_unset=True))
    if not updated_player:
        raise HTTPException(status_code=404, detail="Player not found")
    return updated_player

@router.delete("/{player_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_player(
    player_id: int,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(user_has_permission)
):
    repo = PlayerRepository(db)
    service = PlayerService(repo)
    success = await service.delete_player(player_id)
    if not success:
        raise HTTPException(status_code=404, detail="Player not found")
    return


# ============= ENDPOINTS DE AÇÕES ADMINISTRATIVAS =============

@router.get("/{player_id}/status", response_model=Dict[str, Any], status_code=status.HTTP_200_OK)
async def get_player_admin_status(
    player_id: int,
    db: AsyncSession = Depends(get_db)
):
    """Obtém status administrativo do jogador (suspensão, bloqueio, etc)"""
    admin_repo = PlayerAdminActionRepository(db)
    admin_service = PlayerAdminActionService(admin_repo)
    status_info = await admin_service.get_player_status(player_id)
    return status_info


@router.post("/{player_id}/admin/suspend", status_code=status.HTTP_200_OK)
async def suspend_player(
    player_id: int,
    request: SuspendPlayerRequest,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(user_has_permission)
):
    """Suspende um jogador (requer admin)"""
    if not current_user.get("is_admin"):
        raise HTTPException(status_code=403, detail="Apenas administradores podem executar esta ação")
    
    admin_repo = PlayerAdminActionRepository(db)
    admin_service = PlayerAdminActionService(admin_repo)
    
    action = await admin_service.suspend_player(
        player_id, 
        current_user["id_user"], 
        {
            "suspension_type": request.suspension_type,
            "value": request.value
        }
    )
    
    if not action:
        raise HTTPException(status_code=400, detail="Erro ao suspender jogador")
    
    return {
        "message": action.description,
        "action_id": action.id_action
    }


@router.post("/{player_id}/admin/unsuspend", status_code=status.HTTP_200_OK)
async def unsuspend_player(
    player_id: int,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(user_has_permission)
):
    """Remove a suspensão ativa de um jogador (requer admin)"""
    if not current_user.get("is_admin"):
        raise HTTPException(status_code=403, detail="Apenas administradores podem executar esta ação")
    
    admin_repo = PlayerAdminActionRepository(db)
    success = await admin_repo.deactivate_suspension(player_id)
    if not success:
        raise HTTPException(status_code=400, detail="Sem suspensão ativa ou erro ao remover")
    
    return {"message": "Suspensão removida com sucesso"}


@router.post("/{player_id}/admin/fine", status_code=status.HTTP_200_OK)
async def apply_fine(
    player_id: int,
    request: ApplyFineRequest,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(user_has_permission)
):
    """Aplica multa a um jogador (requer admin)"""
    if not current_user.get("is_admin"):
        raise HTTPException(status_code=403, detail="Apenas administradores podem executar esta ação")
    
    admin_repo = PlayerAdminActionRepository(db)
    admin_service = PlayerAdminActionService(admin_repo)
    
    action = await admin_service.apply_fine(
        player_id,
        current_user["id_user"],
        request.fine_amount
    )
    
    if not action:
        raise HTTPException(status_code=400, detail="Erro ao aplicar multa")
    
    return {
        "message": f"Multa de R$ {request.fine_amount} aplicada",
        "action_id": action.id_action,
        "fine_amount": action.fine_amount
    }


@router.post("/{player_id}/admin/observe", status_code=status.HTTP_200_OK)
async def add_observation(
    player_id: int,
    request: AddObservationRequest,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(user_has_permission)
):
    """Adiciona observações sobre um jogador (requer admin)"""
    if not current_user.get("is_admin"):
        raise HTTPException(status_code=403, detail="Apenas administradores podem executar esta ação")
    
    admin_repo = PlayerAdminActionRepository(db)
    admin_service = PlayerAdminActionService(admin_repo)
    
    action = await admin_service.add_observation(
        player_id,
        current_user["id_user"],
        request.observations
    )
    
    if not action:
        raise HTTPException(status_code=400, detail="Erro ao adicionar observações")
    
    return {
        "message": "Observações adicionadas",
        "action_id": action.id_action,
        "observations": action.observations
    }


@router.post("/{player_id}/admin/block", status_code=status.HTTP_200_OK)
async def block_player(
    player_id: int,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(user_has_permission)
):
    """Bloqueia acesso de um jogador (requer admin)"""
    if not current_user.get("is_admin"):
        raise HTTPException(status_code=403, detail="Apenas administradores podem executar esta ação")
    
    admin_repo = PlayerAdminActionRepository(db)
    admin_service = PlayerAdminActionService(admin_repo)
    
    action = await admin_service.block_player(player_id, current_user["id_user"])
    
    if not action:
        raise HTTPException(status_code=400, detail="Erro ao bloquear jogador")
    
    return {
        "message": "Jogador bloqueado",
        "action_id": action.id_action
    }


@router.post("/{player_id}/admin/unblock", status_code=status.HTTP_200_OK)
async def unblock_player(
    player_id: int,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(user_has_permission)
):
    """Desbloqueia acesso de um jogador (requer admin)"""
    if not current_user.get("is_admin"):
        raise HTTPException(status_code=403, detail="Apenas administradores podem executar esta ação")
    
    admin_repo = PlayerAdminActionRepository(db)
    admin_service = PlayerAdminActionService(admin_repo)
    
    success = await admin_service.unblock_player(player_id, current_user["id_user"])
    
    if not success:
        raise HTTPException(status_code=400, detail="Erro ao desbloquear jogador")
    
    return {
        "message": "Jogador desbloqueado"
    }


@router.get("/{player_id}/admin/actions", response_model=List[Dict[str, Any]], status_code=status.HTTP_200_OK)
async def get_player_admin_actions(
    player_id: int,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(user_has_permission)
):
    """Obtém histórico de ações administrativas de um jogador (requer admin)"""
    if not current_user.get("is_admin"):
        raise HTTPException(status_code=403, detail="Apenas administradores podem acessar esta informação")
    
    admin_repo = PlayerAdminActionRepository(db)
    actions = await admin_repo.get_player_actions(player_id)
    
    result = []
    for action in actions:
        result.append({
            "id_action": action.id_action,
            "action_type": action.action_type,
            "description": action.description,
            "suspension_days": action.suspension_days,
            "suspension_matches": action.suspension_matches,
            "is_indefinite": action.is_indefinite,
            "suspension_until": action.suspension_until,
            "fine_amount": action.fine_amount,
            "observations": action.observations,
            "is_active": action.is_active,
            "created_at": action.created_at,
            "admin_id": action.admin_id,
        })
    
    return result
