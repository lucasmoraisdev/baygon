import random
from typing import Optional, Sequence
from sqlalchemy import select
from app.db.models.round import Round
from app.db.models.team import Teams
from app.db.repositories.team_repository import TeamRepository
from app.schemas.team_schema import (
    DrawnTeamSuggestion,
    RoundTeamInput,
    TeamDrawResponse,
    TeamPlayerSummary,
)


class TeamService:
    def __init__(self, repo: TeamRepository):
        self.repo = repo

    async def create_team(self, team_data: dict) -> Teams:
        player_ids = team_data.pop("player_ids", [])
        team_obj = Teams(**team_data)
        return await self.repo.create(team=team_obj, player_ids=player_ids)

    async def list_teams_by_round(self, round_id: int) -> Sequence[Teams]:
        return await self.repo.list_teams_by_round(round_id)

    async def get_team_by_id(self, team_id: int) -> Optional[Teams]:
        return await self.repo.get_by_id(team_id)

    async def edit_team(self, team_id: int, team_data: dict) -> Optional[Teams]:
        return await self.repo.update(id_team=team_id, updates=team_data)

    async def delete_team(self, team_id: int) -> bool:
        return await self.repo.delete(id_team=team_id)

    async def list_all_teams(self) -> Sequence[Teams]:
        return await self.repo.list_all()

    async def draw_teams(
        self,
        player_ids: list[int],
        num_teams: int = 4,
        pote_overrides: Optional[dict[int, Optional[int]]] = None,
    ) -> TeamDrawResponse:
        unique_ids = list(dict.fromkeys(player_ids))
        players = await self.repo.get_players_by_ids(unique_ids)
        if not players:
            raise ValueError("Nenhum jogador válido selecionado para o sorteio.")

        overrides = pote_overrides or {}
        buckets: dict[int, list] = {}
        for player in players:
            effective_pot = (
                overrides[player.id_player]
                if player.id_player in overrides
                else player.potes
            )
            pot_key = effective_pot if effective_pot is not None and effective_pot > 0 else 999
            buckets.setdefault(pot_key, []).append(player)

        ordered_players = []
        for pot_key in sorted(buckets.keys()):
            group = buckets[pot_key]
            random.shuffle(group)
            ordered_players.extend(group)

        slots: list[list] = [[] for _ in range(num_teams)]
        snake = list(range(num_teams)) + list(range(num_teams - 1, -1, -1))
        for idx, player in enumerate(ordered_players):
            target_slot = snake[idx % len(snake)]
            slots[target_slot].append(player)

        drawn_teams: list[DrawnTeamSuggestion] = []
        for slot_idx, team_players in enumerate(slots):
            captain = next(
                (
                    p
                    for p in team_players
                    if (overrides[p.id_player] if p.id_player in overrides else p.potes) == 1
                ),
                None,
            )
            team_name = (
                f"Time {slot_idx + 1} ({captain.apelido or captain.nome})"
                if captain
                else f"Time {slot_idx + 1}"
            )
            summaries = [
                TeamPlayerSummary(
                    id_player=p.id_player,
                    nome=p.nome,
                    apelido=p.apelido,
                    potes=overrides[p.id_player] if p.id_player in overrides else p.potes,
                    posicao=p.posicao,
                )
                for p in team_players
            ]
            drawn_teams.append(
                DrawnTeamSuggestion(slot=slot_idx + 1, name=team_name, players=summaries)
            )

        return TeamDrawResponse(teams=drawn_teams, unassigned_player_ids=[])

    async def set_round_teams_batch(
        self,
        round_id: int,
        teams: list[RoundTeamInput],
        overwrite_existing: bool = False,
    ) -> Sequence[Teams]:
        stmt = select(Round).where(Round.id_round == round_id, Round.deleted_at.is_(None))
        round_obj = (await self.repo.db.execute(stmt)).scalar_one_or_none()
        if not round_obj:
            raise ValueError("Rodada não encontrada.")

        if not teams:
            raise ValueError("Informe ao menos um time para salvar na rodada.")

        if not overwrite_existing:
            existing = await self.repo.list_teams_by_round(round_id)
            if existing:
                raise ValueError(
                    "A rodada já possui times cadastrados. Marque 'Substituir times existentes' para sobrescrever."
                )

        payload = [(t.name, t.player_ids) for t in teams]
        return await self.repo.replace_round_teams(
            round_id=round_id,
            teams_payload=payload,
            overwrite_existing=overwrite_existing,
        )
