import math
from datetime import datetime, timedelta
from typing import List, Dict, Optional, Tuple
from sqlalchemy import select, func
from sqlalchemy.orm import selectinload
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models.season import Seasons
from app.db.models.team import Teams
from app.db.models.match import Match
from app.db.models.round import Round
from app.core.enum.events_enum import EventTypeEnum
from app.core.tenant_context import get_current_tenant_id
from app.schemas.tournament_schema import (
    TournamentCreate,
    TournamentRead,
    TournamentTeamCreate,
    BracketMatchRead,
    TournamentBracketResponse,
    TournamentFormatEnum,
)


STAGE_ORDER = [
    "round_of_16",
    "quarterfinals",
    "semifinals",
    "third_place",
    "final",
]


class TournamentService:
    """
    Serviço Gerenciador de Torneios e Campeonatos.
    Gerencia criação, times fixos, tabelas de pontos corridos e chaveamentos mata-mata.
    """

    def __init__(self, db: AsyncSession):
        self.db = db

    async def create_tournament(self, data: TournamentCreate, tenant_id: Optional[str] = None) -> Seasons:
        active_tenant = tenant_id or get_current_tenant_id()

        # Determina o próximo número sequencial da temporada caso não informado
        if not data.number:
            stmt_max = select(func.max(Seasons.number))
            if active_tenant:
                stmt_max = stmt_max.where(Seasons.tenant_id == active_tenant)
            current_max = (await self.db.execute(stmt_max)).scalar() or 0
            season_number = current_max + 1
        else:
            season_number = data.number

        new_season = Seasons(
            name=data.name,
            number=season_number,
            tournament_format=data.tournament_format.value,
            has_legs=data.has_legs,
            teams_per_group=data.teams_per_group,
            advancing_per_group=data.advancing_per_group,
            initial_date=data.initial_date or datetime.utcnow(),
            is_active=True,
            tenant_id=active_tenant,
        )
        self.db.add(new_season)
        await self.db.commit()
        await self.db.refresh(new_season)
        return new_season

    async def add_teams_to_tournament(
        self, tournament_id: int, teams_data: List[TournamentTeamCreate]
    ) -> List[Teams]:
        stmt = select(Seasons).where(Seasons.id_season == tournament_id)
        season = (await self.db.execute(stmt)).scalar_one_or_none()
        if not season:
            raise ValueError(f"Torneio {tournament_id} não encontrado.")

        created_teams = []
        tenant_id = season.tenant_id

        for t in teams_data:
            team_obj = Teams(
                name=t.name,
                color=t.color,
                group_name=t.group_name,
                season_id=tournament_id,
                tenant_id=tenant_id,
            )
            self.db.add(team_obj)
            created_teams.append(team_obj)

        await self.db.commit()
        for ct in created_teams:
            await self.db.refresh(ct)
        return created_teams

    async def get_tournament_teams(self, tournament_id: int) -> List[Teams]:
        stmt = select(Teams).where(Teams.season_id == tournament_id, Teams.deleted_at.is_(None))
        return list((await self.db.execute(stmt)).scalars().all())

    @staticmethod
    def _generate_round_robin_schedule(team_ids: List[int]) -> List[List[Tuple[int, int]]]:
        """
        Gera confrontos de todos-contra-todos (Round Robin) usando o algoritmo do círculo.
        """
        n = len(team_ids)
        teams = list(team_ids)
        has_bye = False

        if n % 2 != 0:
            teams.append(-1)  # Bye virtual
            n += 1
            has_bye = True

        schedule = []
        total_rounds = n - 1

        for r in range(total_rounds):
            round_matches = []
            for i in range(n // 2):
                t1 = teams[i]
                t2 = teams[n - 1 - i]
                if t1 != -1 and t2 != -1:
                    # Alterna mandos de campo entre turnos
                    if (r + i) % 2 == 0:
                        round_matches.append((t1, t2))
                    else:
                        round_matches.append((t2, t1))

            schedule.append(round_matches)
            # Rotaciona todos exceto o primeiro
            teams = [teams[0]] + [teams[-1]] + teams[1:-1]

        return schedule

    async def generate_fixtures(self, tournament_id: int, filmed_by_user_id: int) -> List[Round]:
        """
        Gera a tabela de confrontos de acordo com o formato do torneio.
        """
        stmt = select(Seasons).where(Seasons.id_season == tournament_id)
        season = (await self.db.execute(stmt)).scalar_one_or_none()
        if not season:
            raise ValueError(f"Torneio {tournament_id} não encontrado.")

        teams = await self.get_tournament_teams(tournament_id)
        if len(teams) < 2:
            raise ValueError("O torneio precisa de pelo menos 2 equipes para gerar a tabela de jogos.")

        tenant_id = season.tenant_id
        created_rounds = []
        start_date = season.initial_date or datetime.utcnow()

        if season.tournament_format == TournamentFormatEnum.PONTOS_CORRIDOS.value:
            # Liga de Pontos Corridos: Todos contra todos
            team_ids = [t.id_team for t in teams]
            schedule = self._generate_round_robin_schedule(team_ids)

            for round_idx, match_pairs in enumerate(schedule, start=1):
                round_date = start_date + timedelta(days=7 * (round_idx - 1))
                new_round = Round(
                    date=round_date,
                    location="Arena Principal",
                    referee="Árbitro Oficial",
                    round_number=round_idx,
                    season_id=tournament_id,
                    tenant_id=tenant_id,
                )
                self.db.add(new_round)
                await self.db.flush()

                for home_id, away_id in match_pairs:
                    match_obj = Match(
                        round_id=new_round.id_round,
                        home_team_id=home_id,
                        away_team_id=away_id,
                        filmed_by=filmed_by_user_id,
                        event_type=EventTypeEnum.DRAW,
                        stage="regular",
                        tenant_id=tenant_id,
                    )
                    self.db.add(match_obj)

                created_rounds.append(new_round)

        elif season.tournament_format == TournamentFormatEnum.GRUPOS_E_MATA_MATA.value:
            # Fase de Grupos: Agrupa times e gera round-robin dentro de cada grupo
            groups_dict: Dict[str, List[int]] = {}
            for t in teams:
                grp = t.group_name or "Grupo A"
                if grp not in groups_dict:
                    groups_dict[grp] = []
                groups_dict[grp].append(t.id_team)

            # Para cada grupo, calcula os confrontos
            group_schedules = {grp: self._generate_round_robin_schedule(ids) for grp, ids in groups_dict.items()}
            max_group_rounds = max(len(sch) for sch in group_schedules.values()) if group_schedules else 0

            for round_idx in range(1, max_group_rounds + 1):
                round_date = start_date + timedelta(days=7 * (round_idx - 1))
                new_round = Round(
                    date=round_date,
                    location="Arena Fase de Grupos",
                    referee="Árbitro Oficial",
                    round_number=round_idx,
                    season_id=tournament_id,
                    tenant_id=tenant_id,
                )
                self.db.add(new_round)
                await self.db.flush()

                for grp, sch in group_schedules.items():
                    if round_idx <= len(sch):
                        for home_id, away_id in sch[round_idx - 1]:
                            match_obj = Match(
                                round_id=new_round.id_round,
                                home_team_id=home_id,
                                away_team_id=away_id,
                                filmed_by=filmed_by_user_id,
                                event_type=EventTypeEnum.DRAW,
                                stage="group",
                                tenant_id=tenant_id,
                            )
                            self.db.add(match_obj)

                created_rounds.append(new_round)

        elif season.tournament_format == TournamentFormatEnum.MATA_MATA.value:
            # Mata-Mata Direto (Playoffs)
            n_teams = len(teams)
            if n_teams not in {2, 4, 8, 16, 32}:
                # Ajusta para a potência de 2 mais próxima menor ou permite formato direto
                pass

            if n_teams >= 16:
                stage_name = "round_of_16"
            elif n_teams >= 8:
                stage_name = "quarterfinals"
            elif n_teams >= 4:
                stage_name = "semifinals"
            else:
                stage_name = "final"

            new_round = Round(
                date=start_date,
                location="Arena Mata-Mata",
                referee="Árbitro Oficial",
                round_number=1,
                season_id=tournament_id,
                tenant_id=tenant_id,
            )
            self.db.add(new_round)
            await self.db.flush()

            # Pareamento das chaves (1 x N, 2 x N-1, etc.)
            for idx in range(n_teams // 2):
                t_home = teams[idx]
                t_away = teams[n_teams - 1 - idx]

                match_obj = Match(
                    round_id=new_round.id_round,
                    home_team_id=t_home.id_team,
                    away_team_id=t_away.id_team,
                    filmed_by=filmed_by_user_id,
                    event_type=EventTypeEnum.DRAW,
                    stage=stage_name,
                    bracket_position=idx + 1,
                    leg=1,
                    tenant_id=tenant_id,
                )
                self.db.add(match_obj)

            created_rounds.append(new_round)

        await self.db.commit()
        for r in created_rounds:
            await self.db.refresh(r)
        return created_rounds

    async def get_bracket(self, tournament_id: int) -> TournamentBracketResponse:
        """
        Retorna o chaveamento eliminatório (árvore de mata-mata) do torneio.
        """
        stmt_season = select(Seasons).where(Seasons.id_season == tournament_id)
        season = (await self.db.execute(stmt_season)).scalar_one_or_none()
        if not season:
            raise ValueError(f"Torneio {tournament_id} não encontrado.")

        # Busca todas as partidas de fases eliminatórias
        stmt_matches = (
            select(Match)
            .options(selectinload(Match.home_team), selectinload(Match.away_team))
            .join(Round, Match.round_id == Round.id_round)
            .where(
                Round.season_id == tournament_id,
                Match.stage.in_(STAGE_ORDER),
                Match.deleted_at.is_(None),
            )
            .order_by(Match.bracket_position.asc(), Match.leg.asc())
        )
        matches = list((await self.db.execute(stmt_matches)).scalars().all())

        stages_dict: Dict[str, List[BracketMatchRead]] = {stg: [] for stg in STAGE_ORDER}

        for m in matches:
            winner_id = None
            if m.is_finished:
                if m.score_home > m.score_away:
                    winner_id = m.home_team_id
                elif m.score_home < m.score_away:
                    winner_id = m.away_team_id
                else:
                    # Desempate por pênaltis
                    if m.penalties_home > m.penalties_away:
                        winner_id = m.home_team_id
                    elif m.penalties_away > m.penalties_home:
                        winner_id = m.away_team_id

            match_read = BracketMatchRead(
                id_match=m.id_match,
                stage=m.stage,
                bracket_position=m.bracket_position,
                leg=m.leg,
                home_team_id=m.home_team_id,
                home_team_name=m.home_team.name if m.home_team else f"Time {m.home_team_id}",
                away_team_id=m.away_team_id,
                away_team_name=m.away_team.name if m.away_team else f"Time {m.away_team_id}",
                score_home=m.score_home,
                score_away=m.score_away,
                penalties_home=m.penalties_home,
                penalties_away=m.penalties_away,
                is_finished=m.is_finished,
                winner_team_id=winner_id,
            )

            if m.stage in stages_dict:
                stages_dict[m.stage].append(match_read)

        # Remove estágios vazios
        filtered_stages = {stg: matches for stg, matches in stages_dict.items() if matches}

        return TournamentBracketResponse(
            tournament_id=tournament_id,
            tournament_name=season.name or f"Temporada {season.number}",
            has_legs=season.has_legs,
            stages=filtered_stages,
        )

    async def advance_playoff_stage(
        self, tournament_id: int, current_stage: str, next_stage: str, filmed_by_user_id: int
    ) -> Round:
        """
        Pega os vencedores da fase atual (ex: quarterfinals) e gera os confrontos da próxima (ex: semifinals).
        """
        bracket = await self.get_bracket(tournament_id)
        current_matches = bracket.stages.get(current_stage, [])
        if not current_matches:
            raise ValueError(f"Nenhuma partida encontrada na fase {current_stage}.")

        # Verifica se todas as partidas estão finalizadas com vencedor
        winners: List[int] = []
        for m in sorted(current_matches, key=lambda x: x.bracket_position or 0):
            if not m.is_finished or not m.winner_team_id:
                raise ValueError(f"A partida #{m.id_match} ({m.home_team_name} vs {m.away_team_name}) ainda não foi finalizada com vencedor definido.")
            winners.append(m.winner_team_id)

        if len(winners) < 2:
            raise ValueError("Não há vencedores suficientes para a próxima fase.")

        stmt_season = select(Seasons).where(Seasons.id_season == tournament_id)
        season = (await self.db.execute(stmt_season)).scalar_one()

        # Determina o número da próxima rodada
        stmt_max_round = select(func.max(Round.round_number)).where(Round.season_id == tournament_id)
        max_r = (await self.db.execute(stmt_max_round)).scalar() or 0

        next_round = Round(
            date=datetime.utcnow() + timedelta(days=7),
            location="Arena Mata-Mata",
            referee="Árbitro Oficial",
            round_number=max_r + 1,
            season_id=tournament_id,
            tenant_id=season.tenant_id,
        )
        self.db.add(next_round)
        await self.db.flush()

        # Pareia os vencedores: (Venc 1 vs Venc 2), (Venc 3 vs Venc 4)...
        for pos, i in enumerate(range(0, len(winners), 2), start=1):
            if i + 1 < len(winners):
                h_id = winners[i]
                a_id = winners[i + 1]
                match_obj = Match(
                    round_id=next_round.id_round,
                    home_team_id=h_id,
                    away_team_id=a_id,
                    filmed_by=filmed_by_user_id,
                    event_type=EventTypeEnum.DRAW,
                    stage=next_stage,
                    bracket_position=pos,
                    leg=1,
                    tenant_id=season.tenant_id,
                )
                self.db.add(match_obj)

        await self.db.commit()
        await self.db.refresh(next_round)
        return next_round

    async def update_match_result(
        self,
        tournament_id: int,
        match_id: int,
        score_home: int,
        score_away: int,
        penalties_home: int = 0,
        penalties_away: int = 0,
        is_finished: bool = True,
    ) -> Match:
        """
        Registra ou atualiza o placar e penalidades de uma partida de campeonato.
        Atualiza automaticamente o tipo do evento (vitória mandante, visitante ou empate)
        e a data de finalização da partida.
        """
        stmt = (
            select(Match)
            .join(Round, Match.round_id == Round.id_round)
            .where(
                Match.id_match == match_id,
                Round.season_id == tournament_id,
                Match.deleted_at.is_(None),
            )
        )
        match_obj = (await self.db.execute(stmt)).scalar_one_or_none()
        if not match_obj:
            raise ValueError(f"Partida #{match_id} não encontrada no campeonato #{tournament_id}.")

        match_obj.score_home = score_home
        match_obj.score_away = score_away
        match_obj.penalties_home = penalties_home
        match_obj.penalties_away = penalties_away
        match_obj.is_finished = is_finished

        if is_finished:
            match_obj.finished_at = datetime.utcnow()
            if score_home > score_away:
                match_obj.event_type = EventTypeEnum.HOME_WIN
            elif score_away > score_home:
                match_obj.event_type = EventTypeEnum.AWAY_WIN
            else:
                match_obj.event_type = EventTypeEnum.DRAW

        await self.db.commit()
        await self.db.refresh(match_obj)
        return match_obj

    async def draw_playoff_bracket(
        self,
        tournament_id: int,
        seed_mode: str = "random",
        filmed_by_user_id: int = 1,
    ) -> Round:
        """
        Realiza o sorteio dos confrontos iniciais do chaveamento eliminatório (Playoffs).
        Suporta sorteio 'random' (embaralhamento aleatório) ou 'seeded' (chaveamento Olímpico 1xN).
        """
        import random

        stmt_season = select(Seasons).where(Seasons.id_season == tournament_id)
        season = (await self.db.execute(stmt_season)).scalar_one_or_none()
        if not season:
            raise ValueError(f"Torneio {tournament_id} não encontrado.")

        # Impede re-sorteio caso já existam partidas com resultados finalizados
        stmt_finished = (
            select(Match)
            .join(Round, Match.round_id == Round.id_round)
            .where(Round.season_id == tournament_id, Match.is_finished.is_(True))
        )
        if (await self.db.execute(stmt_finished)).first():
            raise ValueError("Não é possível realizar novo sorteio com partidas já disputadas e finalizadas.")

        teams = await self.get_tournament_teams(tournament_id)
        if len(teams) < 2:
            raise ValueError("Cadastre ao menos 2 equipes para realizar o sorteio do chaveamento.")

        # Remove partidas e rodadas não finalizadas anteriores para gerar o novo chaveamento limpo
        stmt_prev_matches = (
            select(Match)
            .join(Round, Match.round_id == Round.id_round)
            .where(Round.season_id == tournament_id)
        )
        prev_matches = list((await self.db.execute(stmt_prev_matches)).scalars().all())
        for pm in prev_matches:
            await self.db.delete(pm)

        stmt_prev_rounds = select(Round).where(Round.season_id == tournament_id)
        prev_rounds = list((await self.db.execute(stmt_prev_rounds)).scalars().all())
        for pr in prev_rounds:
            await self.db.delete(pr)

        await self.db.flush()

        ordered_teams = list(teams)
        if seed_mode == "random":
            random.shuffle(ordered_teams)

        n_teams = len(ordered_teams)
        if n_teams >= 16:
            stage_name = "round_of_16"
        elif n_teams >= 8:
            stage_name = "quarterfinals"
        elif n_teams >= 4:
            stage_name = "semifinals"
        else:
            stage_name = "final"

        new_round = Round(
            date=season.initial_date or datetime.utcnow(),
            location="Arena Mata-Mata",
            referee="Árbitro Oficial",
            round_number=1,
            season_id=tournament_id,
            tenant_id=season.tenant_id,
        )
        self.db.add(new_round)
        await self.db.flush()

        num_matches = n_teams // 2
        for idx in range(num_matches):
            if seed_mode == "seeded":
                t_home = ordered_teams[idx]
                t_away = ordered_teams[n_teams - 1 - idx]
            else:
                t_home = ordered_teams[idx * 2]
                t_away = ordered_teams[idx * 2 + 1]

            match_obj = Match(
                round_id=new_round.id_round,
                home_team_id=t_home.id_team,
                away_team_id=t_away.id_team,
                filmed_by=filmed_by_user_id,
                event_type=EventTypeEnum.DRAW,
                stage=stage_name,
                bracket_position=idx + 1,
                leg=1,
                tenant_id=season.tenant_id,
            )
            self.db.add(match_obj)

        await self.db.commit()
        await self.db.refresh(new_round)
        return new_round

    async def get_tournament_rounds_with_matches(self, tournament_id: int):
        """
        Retorna todas as rodadas e partidas detalhadas do campeonato.
        """
        stmt_rounds = (
            select(Round)
            .where(Round.season_id == tournament_id)
            .order_by(Round.round_number.asc())
        )
        rounds = list((await self.db.execute(stmt_rounds)).scalars().all())

        results = []
        for r in rounds:
            stmt_m = (
                select(Match)
                .options(selectinload(Match.home_team), selectinload(Match.away_team))
                .where(Match.round_id == r.id_round, Match.deleted_at.is_(None))
                .order_by(Match.bracket_position.asc(), Match.id_match.asc())
            )
            matches = list((await self.db.execute(stmt_m)).scalars().all())

            match_list = []
            for m in matches:
                winner_id = None
                if m.is_finished:
                    if m.score_home > m.score_away:
                        winner_id = m.home_team_id
                    elif m.score_home < m.score_away:
                        winner_id = m.away_team_id
                    else:
                        if m.penalties_home > m.penalties_away:
                            winner_id = m.home_team_id
                        elif m.penalties_away > m.penalties_home:
                            winner_id = m.away_team_id

                match_list.append({
                    "id_match": m.id_match,
                    "home_team_id": m.home_team_id,
                    "home_team_name": m.home_team.name if m.home_team else f"Time {m.home_team_id}",
                    "home_team_color": m.home_team.color if m.home_team else None,
                    "away_team_id": m.away_team_id,
                    "away_team_name": m.away_team.name if m.away_team else f"Time {m.away_team_id}",
                    "away_team_color": m.away_team.color if m.away_team else None,
                    "score_home": m.score_home,
                    "score_away": m.score_away,
                    "penalties_home": m.penalties_home,
                    "penalties_away": m.penalties_away,
                    "stage": m.stage,
                    "bracket_position": m.bracket_position,
                    "leg": m.leg,
                    "is_finished": m.is_finished,
                    "winner_team_id": winner_id,
                })

            results.append({
                "id_round": r.id_round,
                "round_number": r.round_number,
                "date": r.date,
                "location": r.location,
                "matches": match_list,
            })

        return results
