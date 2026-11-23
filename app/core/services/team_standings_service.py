from typing import List, Dict, Optional
from collections import defaultdict
from sqlalchemy import select
from sqlalchemy.orm import selectinload
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models.season import Seasons
from app.db.models.team import Teams
from app.db.models.match import Match
from app.db.models.round import Round
from app.schemas.tournament_schema import TeamStandingRow, TournamentStandingsResponse


class TeamStandingsService:
    """
    Motor de Classificação de Equipes (Tabela de Pontos Corridos e Fase de Grupos).
    Calcula P, J, V, E, D, GP, GC, SG e % de aproveitamento.
    """

    def __init__(self, db: AsyncSession):
        self.db = db

    async def calculate_standings(self, tournament_id: int) -> TournamentStandingsResponse:
        # 1. Recupera o torneio
        stmt_season = select(Seasons).where(Seasons.id_season == tournament_id)
        season = (await self.db.execute(stmt_season)).scalar_one_or_none()
        if not season:
            raise ValueError(f"Torneio {tournament_id} não encontrado.")

        # 2. Recupera todos os times do torneio
        stmt_teams = (
            select(Teams)
            .where(Teams.season_id == tournament_id, Teams.deleted_at.is_(None))
        )
        teams = list((await self.db.execute(stmt_teams)).scalars().all())

        # Se não houver times vinculados diretamente à temporada, busca por rodadas
        if not teams:
            stmt_round_teams = (
                select(Teams)
                .join(Round, Teams.round_id == Round.id_round)
                .where(Round.season_id == tournament_id, Teams.deleted_at.is_(None))
            )
            teams = list((await self.db.execute(stmt_round_teams)).scalars().all())

        # 3. Recupera todas as partidas finalizadas das rodadas do torneio
        stmt_matches = (
            select(Match)
            .join(Round, Match.round_id == Round.id_round)
            .where(
                Round.season_id == tournament_id,
                Match.is_finished.is_(True),
                Match.deleted_at.is_(None),
            )
        )
        matches = list((await self.db.execute(stmt_matches)).scalars().all())

        # 4. Estrutura de dados para agregação por equipe
        stats: Dict[int, Dict] = {}
        for t in teams:
            stats[t.id_team] = {
                "team_id": t.id_team,
                "team_name": t.name,
                "color": t.color,
                "group_name": t.group_name,
                "matches_played": 0,
                "points": 0,
                "wins": 0,
                "draws": 0,
                "losses": 0,
                "goals_for": 0,
                "goals_against": 0,
                "goal_difference": 0,
                "win_percentage": 0.0,
            }

        # 5. Processamento dos resultados das partidas
        for m in matches:
            # Em torneios de grupos ou mata-mata, pontuação de tabela aplica-se apenas a jogos regulares ou de grupo
            if m.stage not in {"regular", "group"}:
                continue

            h_id = m.home_team_id
            a_id = m.away_team_id

            if h_id not in stats or a_id not in stats:
                continue

            stats[h_id]["matches_played"] += 1
            stats[a_id]["matches_played"] += 1

            stats[h_id]["goals_for"] += m.score_home
            stats[h_id]["goals_against"] += m.score_away

            stats[a_id]["goals_for"] += m.score_away
            stats[a_id]["goals_against"] += m.score_home

            if m.score_home > m.score_away:
                stats[h_id]["wins"] += 1
                stats[h_id]["points"] += 3
                stats[a_id]["losses"] += 1
            elif m.score_home < m.score_away:
                stats[a_id]["wins"] += 1
                stats[a_id]["points"] += 3
                stats[h_id]["losses"] += 1
            else:
                stats[h_id]["draws"] += 1
                stats[h_id]["points"] += 1
                stats[a_id]["draws"] += 1
                stats[a_id]["points"] += 1

        # 6. Cálculo de SG e aproveitamento
        for t_id, s in stats.items():
            s["goal_difference"] = s["goals_for"] - s["goals_against"]
            max_possible_points = s["matches_played"] * 3
            if max_possible_points > 0:
                s["win_percentage"] = round((s["points"] / max_possible_points) * 100, 1)
            else:
                s["win_percentage"] = 0.0

        # Função de ordenação: Pontos DESC, Vitórias DESC, SG DESC, GP DESC, Nome ASC
        def sort_key(item):
            return (
                -item["points"],
                -item["wins"],
                -item["goal_difference"],
                -item["goals_for"],
                item["team_name"],
            )

        # 7. Formatação de classificação (Geral ou por Grupos)
        is_group_format = season.tournament_format in {"grupos_e_mata_mata"} or any(t.group_name for t in teams)

        groups_dict: Optional[Dict[str, List[TeamStandingRow]]] = None
        all_standings: List[TeamStandingRow] = []

        if is_group_format:
            grouped_stats = defaultdict(list)
            for t_id, s in stats.items():
                grp = s["group_name"] or "Grupo Geral"
                grouped_stats[grp].append(s)

            groups_dict = {}
            for grp_name, team_list in sorted(grouped_stats.items()):
                sorted_group = sorted(team_list, key=sort_key)
                group_rows = []
                for idx, row_data in enumerate(sorted_group, start=1):
                    row_data["position"] = idx
                    group_rows.append(TeamStandingRow(**row_data))
                groups_dict[grp_name] = group_rows

            # Classificação geral unificada
            sorted_all = sorted(stats.values(), key=sort_key)
            for idx, row_data in enumerate(sorted_all, start=1):
                row_data["position"] = idx
                all_standings.append(TeamStandingRow(**row_data))
        else:
            sorted_all = sorted(stats.values(), key=sort_key)
            for idx, row_data in enumerate(sorted_all, start=1):
                row_data["position"] = idx
                all_standings.append(TeamStandingRow(**row_data))

        return TournamentStandingsResponse(
            tournament_id=tournament_id,
            tournament_name=season.name or f"Temporada {season.number}",
            tournament_format=season.tournament_format,
            standings=all_standings,
            groups=groups_dict,
        )
