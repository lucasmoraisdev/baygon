from datetime import datetime, timezone
from typing import Dict, List, Optional
from fastapi import APIRouter, Depends, status, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.dependencies.auth_dependencies import user_has_permission
from app.core.enum.events_enum import EventTypeEnum
from app.core.services.event_service import EventService
from app.db.base import get_db
from app.db.models.match import Match
from app.db.models.match_event import MatchEvent
from app.db.models.team import Teams
from app.db.repositories.match_event_repository import MatchEventRepository
from app.schemas.match_event_schema import MatchEventCreate, MatchEventRead, MatchEventUpdate

router = APIRouter(prefix="/events", tags=["Events"])


class RoundOuroItem(BaseModel):
    player_id: int
    count: int = Field(1, ge=1)


class RoundOurosPayload(BaseModel):
    ouros: List[RoundOuroItem] = Field(default_factory=list)


@router.get("/round/{round_id}/ouros", response_model=List[RoundOuroItem], status_code=status.HTTP_200_OK)
async def list_ouros_by_round(
    round_id: int,
    db: AsyncSession = Depends(get_db),
):
    """Retorna os ouros da rodada agregados por jogador."""
    matches = (
        await db.execute(
            select(Match).where(Match.round_id == round_id, Match.deleted_at.is_(None))
        )
    ).scalars().all()
    if not matches:
        return []

    match_ids = [m.id_match for m in matches]
    events = (
        await db.execute(
            select(MatchEvent).where(
                MatchEvent.match_id.in_(match_ids),
                MatchEvent.event_type == EventTypeEnum.BLUNDER,
                MatchEvent.deleted_at.is_(None),
            )
        )
    ).scalars().all()

    counts: Dict[int, int] = {}
    for ev in events:
        counts[ev.player_id] = counts.get(ev.player_id, 0) + 1

    return [RoundOuroItem(player_id=pid, count=c) for pid, c in counts.items()]


@router.post("/round/{round_id}/ouros", status_code=status.HTTP_200_OK)
async def sync_round_ouros(
    round_id: int,
    payload: RoundOurosPayload,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(user_has_permission),
):
    """Sincroniza os ouros da rodada, substituindo os antigos pelos informados."""
    matches = (
        await db.execute(
            select(Match).where(Match.round_id == round_id, Match.deleted_at.is_(None))
        )
    ).scalars().all()
    if not matches:
        return {"ouros_registered": 0, "message": "Nenhuma partida na rodada para ancorar os ouros."}

    match_ids = [m.id_match for m in matches]

    # Deleta eventos de ouro antigos da rodada
    existing_ouros = (
        await db.execute(
            select(MatchEvent).where(
                MatchEvent.match_id.in_(match_ids),
                MatchEvent.event_type == EventTypeEnum.BLUNDER,
                MatchEvent.deleted_at.is_(None),
            )
        )
    ).scalars().all()

    now = datetime.now(timezone.utc)
    for ev in existing_ouros:
        ev.deleted_at = now

    # Mapeia jogador para o primeiro time/partida onde ele atuou
    teams = (
        await db.execute(
            select(Teams)
            .options(selectinload(Teams.players))
            .where(Teams.round_id == round_id, Teams.deleted_at.is_(None))
        )
    ).scalars().all()

    player_team_map: Dict[int, int] = {}
    for t in teams:
        for p in t.players:
            player_team_map[p.id_player] = t.id_team

    total_created = 0
    for item in payload.ouros:
        if item.count <= 0:
            continue
        pl_team_id = player_team_map.get(item.player_id)
        anchor_match = next(
            (
                m
                for m in matches
                if pl_team_id and (m.home_team_id == pl_team_id or m.away_team_id == pl_team_id)
            ),
            matches[0],
        )
        for _ in range(item.count):
            db.add(
                MatchEvent(
                    match_id=anchor_match.id_match,
                    player_id=item.player_id,
                    event_type=EventTypeEnum.BLUNDER,
                    play_id=None,
                )
            )
            total_created += 1

    await db.commit()
    return {"ouros_registered": total_created}

@router.post("/", response_model=MatchEventRead, status_code=status.HTTP_201_CREATED)
async def create_event(
    event_create: MatchEventCreate,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(user_has_permission)
):
    repo = MatchEventRepository(db)
    service = EventService(repo)
    return await service.create_event(event_create.model_dump())

@router.get("/match/{match_id}", response_model=List[MatchEventRead])
async def list_events_by_match(
    match_id: int,
    db: AsyncSession = Depends(get_db)
):
    repo = MatchEventRepository(db)
    service = EventService(repo)
    return await service.list_events_by_match(match_id)

@router.get("/{event_id}", response_model=MatchEventRead, status_code=status.HTTP_200_OK)
async def get_event(
    event_id: int,
    db: AsyncSession = Depends(get_db)
):
    repo = MatchEventRepository(db)
    service = EventService(repo)
    event_obj = await service.get_event_by_id(event_id)
    if not event_obj:
        raise HTTPException(status_code=404, detail="Event not found")
    return event_obj

@router.put("/{event_id}", response_model=MatchEventRead, status_code=status.HTTP_200_OK)
async def update_event(
    event_id: int,
    event_update: MatchEventUpdate,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(user_has_permission)
):
    repo = MatchEventRepository(db)
    service = EventService(repo)
    updated_event = await service.edit_event(event_id, event_update.model_dump(exclude_unset=True))
    if not updated_event:
        raise HTTPException(status_code=404, detail="Event not found")
    return updated_event

@router.delete("/{event_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_event(
    event_id: int,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(user_has_permission)
):
    repo = MatchEventRepository(db)
    service = EventService(repo)
    success = await service.delete_event(event_id)
    if not success:
        raise HTTPException(status_code=404, detail="Event not found")
    return
