from datetime import datetime, timezone
from typing import Optional, Sequence, Dict, Any, List, Tuple
from sqlalchemy import select, and_, or_, func, distinct, Integer
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.db.models.player import Player
from app.db.models.match_event import MatchEvent
from app.db.models.match import Match
from app.db.models.season import Seasons
from app.db.models.round import Round
from app.db.models.team import Teams
from app.db.models.award import Awards
from app.db.models.player_score import PlayerScore
from app.core.enum.events_enum import EventTypeEnum

AWARD_EVENT_VALUES = {
    EventTypeEnum.ROUND_WINNER.value,
    EventTypeEnum.MVP.value,
    EventTypeEnum.WORST_PLAYER.value,
    EventTypeEnum.BEST_GOAL.value,
    EventTypeEnum.BEST_DEFENSE.value,
    EventTypeEnum.TOAST.value,
    EventTypeEnum.UNBELIVABLE.value,
    EventTypeEnum.BEST_GOAL_KEEPER.value,
    EventTypeEnum.ROULETTE.value,
}


class PlayerRepository:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def create(self, player: Player) -> Player:
        """
        Cria um novo jogador.
        """
        self.db.add(player)
        await self.db.commit()
        await self.db.refresh(player)
        return player

    async def list_all_players(self) -> Sequence[Player]:
        """
        Lista todos os jogadores ativos (não deletados) com seu status disciplinar atual.
        """
        from app.db.models.player_admin_action import PlayerAdminAction, AdminActionTypeEnum
        from sqlalchemy import or_

        stmt = select(Player).where(Player.deleted_at.is_(None)).order_by(Player.nome.asc())
        result = await self.db.execute(stmt)
        players = list(result.scalars().all())

        try:
            now = datetime.now(timezone.utc)
            act_stmt = select(PlayerAdminAction).where(PlayerAdminAction.is_active == True)
            act_res = await self.db.execute(act_stmt)
            actions = list(act_res.scalars().all())

            blocked_ids: set[int] = set()
            suspended_ids: set[int] = set()
            for a in actions:
                if a.action_type == AdminActionTypeEnum.BLOCK:
                    blocked_ids.add(a.player_id)
                elif a.action_type == AdminActionTypeEnum.SUSPEND:
                    if a.suspension_until is None or a.suspension_until > now or (a.suspension_matches and a.suspension_matches > 0) or a.is_indefinite:
                        suspended_ids.add(a.player_id)

            for p in players:
                if p.id_player in blocked_ids:
                    setattr(p, "status", "Bloqueado")
                elif p.id_player in suspended_ids:
                    setattr(p, "status", "Suspenso")
                else:
                    setattr(p, "status", "Ativo")
        except Exception:
            for p in players:
                setattr(p, "status", "Ativo")

        return players

    async def get_by_id(self, id_player: int) -> Optional[Player]:
        """
        Busca um jogador pelo seu id.
        """
        stmt = select(Player).options(
            selectinload(Player.teams),
            selectinload(Player.awards)
        ).where(
            Player.id_player == id_player
        )
        result = await self.db.execute(stmt)
        return result.scalar_one_or_none()

    async def update_player(self, id_player: int, updates: dict) -> Optional[Player]:
        """
        Atualiza um jogador.
        """
        player = await self.get_by_id(id_player)
        if not player:
            return None
        for key, value in updates.items():
            if hasattr(player, key):
                setattr(player, key, value)
        player.updated_at = datetime.now(timezone.utc)
        await self.db.commit()
        await self.db.refresh(player)
        return player

    async def delete_player(self, id_player: int) -> bool:
        """
        Deleta um jogador.
        """
        player = await self.get_by_id(id_player)
        if not player:
            return False

        player.deleted_at = datetime.now(timezone.utc)
        await self.db.commit()
        return True

    async def get_player_full_analytics(self, player_id: int) -> Dict[str, Any]:
        """
        Calcula de forma completa e consistente as estatísticas gerais, por temporada,
        por rodada (série temporal), times e prêmios do jogador.
        """
        seasons_list = list(
            (await self.db.execute(select(Seasons).where(Seasons.deleted_at.is_(None)))).scalars().all()
        )
        season_map = {s.id_season: s for s in seasons_list}

        rounds_list = list(
            (await self.db.execute(select(Round).where(Round.deleted_at.is_(None)))).scalars().all()
        )
        round_map = {r.id_round: r for r in rounds_list}

        # Times em que o jogador participou
        all_teams = list(
            (
                await self.db.execute(
                    select(Teams)
                    .options(selectinload(Teams.players))
                    .where(Teams.deleted_at.is_(None))
                )
            )
            .scalars()
            .all()
        )
        player_teams: List[Teams] = []
        player_team_ids: set[int] = set()
        for t in all_teams:
            if any(p.id_player == player_id for p in (t.players or [])):
                player_teams.append(t)
                player_team_ids.add(t.id_team)

        # Eventos do jogador em partidas
        player_events = list(
            (
                await self.db.execute(
                    select(MatchEvent).where(
                        MatchEvent.player_id == player_id,
                        MatchEvent.deleted_at.is_(None),
                    )
                )
            )
            .scalars()
            .all()
        )
        event_match_ids = {ev.match_id for ev in player_events if ev.match_id}

        # Todas as partidas relevantes
        all_matches = list(
            (
                await self.db.execute(
                    select(Match).where(Match.deleted_at.is_(None))
                )
            )
            .scalars()
            .all()
        )
        match_map = {m.id_match: m for m in all_matches}

        # Acumuladores por round_id
        round_data: Dict[int, Dict[str, Any]] = {}

        def ensure_round(r_id: int) -> Optional[Dict[str, Any]]:
            r_obj = round_map.get(r_id)
            if not r_obj:
                return None
            if r_id not in round_data:
                s_obj = season_map.get(r_obj.season_id)
                s_num = s_obj.number if s_obj else r_obj.season_id
                round_data[r_id] = {
                    "round_id": r_id,
                    "round_number": r_obj.round_number,
                    "date": r_obj.date.isoformat() if r_obj.date else None,
                    "season_id": r_obj.season_id,
                    "season_number": s_num,
                    "season_name": f"{s_num}ª Temporada",
                    "total_matches": 0,
                    "total_wins": 0,
                    "total_losses": 0,
                    "total_draws": 0,
                    "total_goals": 0,
                    "total_assists": 0,
                    "total_points": 0,
                }
            return round_data[r_id]

        # Garantir rodadas onde o jogador esteve escalado em time
        for t in player_teams:
            ensure_round(t.round_id)

        # Contabilizar partidas (V / E / D) via times ou eventos
        counted_matches: set[int] = set()
        for m in all_matches:
            in_home = m.home_team_id in player_team_ids
            in_away = m.away_team_id in player_team_ids
            in_events = m.id_match in event_match_ids

            if not (in_home or in_away or in_events):
                continue

            r_entry = ensure_round(m.round_id)
            if not r_entry:
                continue

            counted_matches.add(m.id_match)
            r_entry["total_matches"] += 1

            sh = m.score_home or 0
            sa = m.score_away or 0

            if in_home:
                if sh > sa:
                    r_entry["total_wins"] += 1
                elif sh < sa:
                    r_entry["total_losses"] += 1
                else:
                    r_entry["total_draws"] += 1
            elif in_away:
                if sa > sh:
                    r_entry["total_wins"] += 1
                elif sa < sh:
                    r_entry["total_losses"] += 1
                else:
                    r_entry["total_draws"] += 1
            else:
                # Fallback por eventos da partida caso não haja vínculo na tabela team_players
                m_evs = [e for e in player_events if e.match_id == m.id_match]
                ev_types = {
                    (e.event_type.value if hasattr(e.event_type, "value") else str(e.event_type))
                    for e in m_evs
                }
                if EventTypeEnum.HOME_WIN.value in ev_types or EventTypeEnum.AWAY_WIN.value in ev_types:
                    r_entry["total_wins"] += 1
                elif EventTypeEnum.DRAW.value in ev_types or sh == sa:
                    r_entry["total_draws"] += 1
                else:
                    r_entry["total_losses"] += 1

        # Contabilizar Gols e Assistências por rodada
        for ev in player_events:
            m_obj = match_map.get(ev.match_id)
            if not m_obj:
                continue
            r_entry = ensure_round(m_obj.round_id)
            if not r_entry:
                continue
            ev_type = ev.event_type.value if hasattr(ev.event_type, "value") else str(ev.event_type)
            if ev_type == EventTypeEnum.GOAL.value or ev.event_type == EventTypeEnum.GOAL:
                r_entry["total_goals"] += 1
            elif ev_type == EventTypeEnum.ASSIST.value or ev.event_type == EventTypeEnum.ASSIST:
                r_entry["total_assists"] += 1

        # Pontuação por rodada (PlayerScore)
        scores = list(
            (
                await self.db.execute(
                    select(PlayerScore).where(
                        PlayerScore.player_id == player_id,
                        PlayerScore.deleted_at.is_(None),
                    )
                )
            )
            .scalars()
            .all()
        )
        for sc in scores:
            r_entry = ensure_round(sc.round_id)
            if r_entry:
                r_entry["total_points"] += int(sc.total_points or 0)

        # Prêmios (Awards diretos, Awards via time vencedor da rodada, ou MatchEvent de prêmio)
        all_awards = list(
            (
                await self.db.execute(
                    select(Awards)
                    .options(selectinload(Awards.player), selectinload(Awards.teams))
                    .where(Awards.deleted_at.is_(None))
                )
            )
            .scalars()
            .all()
        )
        awards_summary: List[Dict[str, Any]] = []
        seen_award_ids: set[int] = set()

        for aw in all_awards:
            has_player = any(p.id_player == player_id for p in (aw.player or []))
            has_team = any(t.id_team in player_team_ids for t in (aw.teams or []))
            if not (has_player or has_team):
                continue
            if aw.id_award in seen_award_ids:
                continue
            seen_award_ids.add(aw.id_award)

            r_obj = round_map.get(aw.round_id)
            s_obj = season_map.get(r_obj.season_id) if r_obj else None
            s_num = s_obj.number if s_obj else (r_obj.season_id if r_obj else None)
            aw_type = aw.event_type.value if hasattr(aw.event_type, "value") else str(aw.event_type)

            awards_summary.append({
                "id_award": aw.id_award,
                "event_type": aw_type,
                "round_id": aw.round_id,
                "season_id": r_obj.season_id if r_obj else None,
                "season_name": f"{s_num}ª Temporada" if s_num is not None else None,
                "round_number": r_obj.round_number if r_obj else None,
                "date": r_obj.date.isoformat() if (r_obj and r_obj.date) else None,
            })

        # Também verificar se há eventos de premiação salvos diretamente em MatchEvent
        for ev in player_events:
            ev_type = ev.event_type.value if hasattr(ev.event_type, "value") else str(ev.event_type)
            if ev_type in AWARD_EVENT_VALUES:
                m_obj = match_map.get(ev.match_id)
                r_obj = round_map.get(m_obj.round_id) if m_obj else None
                s_obj = season_map.get(r_obj.season_id) if r_obj else None
                s_num = s_obj.number if s_obj else (r_obj.season_id if r_obj else None)
                awards_summary.append({
                    "id_award": 100000 + ev.id_event,
                    "event_type": ev_type,
                    "round_id": r_obj.id_round if r_obj else None,
                    "season_id": r_obj.season_id if r_obj else None,
                    "season_name": f"{s_num}ª Temporada" if s_num is not None else None,
                    "round_number": r_obj.round_number if r_obj else None,
                    "date": r_obj.date.isoformat() if (r_obj and r_obj.date) else None,
                })

        # Ordenar round_stats cronologicamente
        round_stats_list = sorted(
            round_data.values(),
            key=lambda x: (
                x["season_number"] or 0,
                x["round_number"] or 0,
                x["date"] or "",
            ),
        )

        # Agregar por temporada (season_stats)
        season_agg: Dict[int, Dict[str, Any]] = {}
        for r_item in round_stats_list:
            sid = r_item["season_id"]
            if sid not in season_agg:
                season_agg[sid] = {
                    "season_id": sid,
                    "season_number": r_item["season_number"],
                    "season_name": r_item["season_name"],
                    "total_matches": 0,
                    "total_wins": 0,
                    "total_losses": 0,
                    "total_draws": 0,
                    "total_goals": 0,
                    "total_assists": 0,
                    "total_points": 0,
                }
            s_entry = season_agg[sid]
            s_entry["total_matches"] += r_item["total_matches"]
            s_entry["total_wins"] += r_item["total_wins"]
            s_entry["total_losses"] += r_item["total_losses"]
            s_entry["total_draws"] += r_item["total_draws"]
            s_entry["total_goals"] += r_item["total_goals"]
            s_entry["total_assists"] += r_item["total_assists"]
            s_entry["total_points"] += r_item["total_points"]

        season_stats_list = sorted(
            season_agg.values(),
            key=lambda x: x["season_number"] or x["season_id"],
        )

        # Preparar resumo de times enriquecido com temporada e rodada
        teams_summary: List[Dict[str, Any]] = []
        for t in player_teams:
            r_obj = round_map.get(t.round_id)
            s_obj = season_map.get(r_obj.season_id) if r_obj else None
            s_num = s_obj.number if s_obj else (r_obj.season_id if r_obj else None)
            teams_summary.append({
                "id_team": t.id_team,
                "name": t.name,
                "round_id": t.round_id,
                "season_id": r_obj.season_id if r_obj else None,
                "season_name": f"{s_num}ª Temporada" if s_num is not None else None,
                "round_number": r_obj.round_number if r_obj else None,
            })

        # Estatísticas gerais consolidadas
        overall_stats = {
            "total_matches": sum(s["total_matches"] for s in season_stats_list),
            "total_wins": sum(s["total_wins"] for s in season_stats_list),
            "total_losses": sum(s["total_losses"] for s in season_stats_list),
            "total_draws": sum(s["total_draws"] for s in season_stats_list),
            "total_goals": sum(s["total_goals"] for s in season_stats_list),
            "total_assists": sum(s["total_assists"] for s in season_stats_list),
            "total_awards": len(awards_summary),
            "total_seasons": len(season_stats_list),
        }

        return {
            "stats": overall_stats,
            "season_stats": season_stats_list,
            "round_stats": round_stats_list,
            "teams": teams_summary,
            "awards": awards_summary,
        }

    async def get_player_stats(self, player_id: int) -> Dict[str, Any]:
        data = await self.get_player_full_analytics(player_id)
        return data["stats"]

    async def get_player_season_stats(self, player_id: int) -> Sequence[Dict[str, Any]]:
        data = await self.get_player_full_analytics(player_id)
        return data["season_stats"]

    async def get_player_partnerships(self, player_id: int, season_id: Optional[int] = None) -> Dict[str, Any]:
        """
        Calcula as estatísticas de parcerias (duplas e trios) do jogador:
        - Quantidade de jogos juntos (para o Treemap)
        - Vitórias, empates, derrotas, aproveitamento
        - Gols e assistências cruzadas e individuais
        """
        target_player = await self.get_by_id(player_id)
        if not target_player:
            return {"player_id": player_id, "player_name": "", "player_apelido": "", "season_id": season_id, "pairs": [], "trios": []}

        # Carregar rodadas (filtradas por season_id se informado)
        round_stmt = select(Round).where(Round.deleted_at.is_(None))
        if season_id is not None:
            round_stmt = round_stmt.where(Round.season_id == season_id)
        rounds_list = list((await self.db.execute(round_stmt)).scalars().all())
        valid_round_ids = {r.id_round for r in rounds_list}

        if not valid_round_ids:
            return {
                "player_id": player_id,
                "player_name": target_player.nome,
                "player_apelido": target_player.apelido or target_player.nome,
                "season_id": season_id,
                "total_matches_evaluated": 0,
                "pairs": [],
                "trios": [],
            }

        # Carregar times com jogadores
        all_teams = list(
            (
                await self.db.execute(
                    select(Teams)
                    .options(selectinload(Teams.players))
                    .where(
                        Teams.deleted_at.is_(None),
                        Teams.round_id.in_(valid_round_ids),
                    )
                )
            )
            .scalars()
            .all()
        )

        player_teams_map: Dict[int, Teams] = {}
        for t in all_teams:
            if any(p.id_player == player_id for p in (t.players or [])):
                player_teams_map[t.id_team] = t

        player_team_ids = set(player_teams_map.keys())
        if not player_team_ids:
            return {
                "player_id": player_id,
                "player_name": target_player.nome,
                "player_apelido": target_player.apelido or target_player.nome,
                "season_id": season_id,
                "total_matches_evaluated": 0,
                "pairs": [],
                "trios": [],
            }

        # Buscar todas as partidas dos times do jogador
        matches_stmt = select(Match).where(
            Match.deleted_at.is_(None),
            Match.round_id.in_(valid_round_ids),
            or_(
                Match.home_team_id.in_(player_team_ids),
                Match.away_team_id.in_(player_team_ids),
            ),
        )
        matches = list((await self.db.execute(matches_stmt)).scalars().all())
        match_ids = [m.id_match for m in matches]

        events: List[MatchEvent] = []
        if match_ids:
            events_stmt = select(MatchEvent).where(
                MatchEvent.deleted_at.is_(None),
                MatchEvent.match_id.in_(match_ids),
            )
            events = list((await self.db.execute(events_stmt)).scalars().all())

        events_by_match: Dict[int, List[MatchEvent]] = {}
        for ev in events:
            events_by_match.setdefault(ev.match_id, []).append(ev)

        pairs_data: Dict[int, Dict[str, Any]] = {}
        trios_data: Dict[Tuple[int, int], Dict[str, Any]] = {}

        for m in matches:
            in_home = m.home_team_id in player_teams_map
            in_away = m.away_team_id in player_teams_map

            team_obj = player_teams_map.get(m.home_team_id if in_home else m.away_team_id)
            if not team_obj:
                continue

            sh = m.score_home or 0
            sa = m.score_away or 0
            if in_home:
                gf = sh
                ga = sa
            else:
                gf = sa
                ga = sh

            is_win = gf > ga
            is_draw = gf == ga
            is_loss = gf < ga

            teammates = [p for p in (team_obj.players or []) if p.id_player != player_id]
            teammate_ids = [p.id_player for p in teammates]

            m_events = events_by_match.get(m.id_match, [])
            player_goals_count = 0
            player_assists_count = 0
            goals_by_player: Dict[int, int] = {}
            assists_by_player: Dict[int, int] = {}

            goals_plays: Dict[int, int] = {}
            assists_plays: Dict[int, int] = {}

            for ev in m_events:
                ev_type = ev.event_type.value if hasattr(ev.event_type, "value") else str(ev.event_type)
                if ev_type in ("gol", EventTypeEnum.GOAL.value):
                    goals_by_player[ev.player_id] = goals_by_player.get(ev.player_id, 0) + 1
                    if ev.player_id == player_id:
                        player_goals_count += 1
                    if ev.play_id is not None:
                        goals_plays[ev.play_id] = ev.player_id
                elif ev_type in ("assistencia", EventTypeEnum.ASSIST.value):
                    assists_by_player[ev.player_id] = assists_by_player.get(ev.player_id, 0) + 1
                    if ev.player_id == player_id:
                        player_assists_count += 1
                    if ev.play_id is not None:
                        assists_plays[ev.play_id] = ev.player_id

            # Acumular Duplas
            for p2 in teammates:
                pid2 = p2.id_player
                if pid2 not in pairs_data:
                    pairs_data[pid2] = {
                        "partner_id": pid2,
                        "partner_name": p2.nome,
                        "partner_apelido": p2.apelido or p2.nome,
                        "partner_posicao": p2.posicao or "linha",
                        "partner_pe": p2.pe,
                        "matches_together": 0,
                        "wins": 0,
                        "draws": 0,
                        "losses": 0,
                        "goals_for": 0,
                        "goals_against": 0,
                        "player_goals": 0,
                        "player_assists": 0,
                        "partner_goals": 0,
                        "partner_assists": 0,
                        "player_assisted_by_partner": 0,
                        "partner_assisted_by_player": 0,
                    }

                entry = pairs_data[pid2]
                entry["matches_together"] += 1
                if is_win:
                    entry["wins"] += 1
                elif is_draw:
                    entry["draws"] += 1
                else:
                    entry["losses"] += 1
                entry["goals_for"] += gf
                entry["goals_against"] += ga
                entry["player_goals"] += player_goals_count
                entry["player_assists"] += player_assists_count
                entry["partner_goals"] += goals_by_player.get(pid2, 0)
                entry["partner_assists"] += assists_by_player.get(pid2, 0)

                for play_id_val, scorer in goals_plays.items():
                    passer = assists_plays.get(play_id_val)
                    if scorer == player_id and passer == pid2:
                        entry["player_assisted_by_partner"] += 1
                    elif scorer == pid2 and passer == player_id:
                        entry["partner_assisted_by_player"] += 1

            # Acumular Trios
            if len(teammate_ids) >= 2:
                from itertools import combinations
                for combo in combinations(sorted(teammates, key=lambda x: x.id_player), 2):
                    p2, p3 = combo
                    key = (p2.id_player, p3.id_player)
                    if key not in trios_data:
                        trios_data[key] = {
                            "id": f"{p2.id_player}-{p3.id_player}",
                            "partner_1": {
                                "id_player": p2.id_player,
                                "name": p2.nome,
                                "apelido": p2.apelido or p2.nome,
                                "posicao": p2.posicao or "linha",
                            },
                            "partner_2": {
                                "id_player": p3.id_player,
                                "name": p3.nome,
                                "apelido": p3.apelido or p3.nome,
                                "posicao": p3.posicao or "linha",
                            },
                            "matches_together": 0,
                            "wins": 0,
                            "draws": 0,
                            "losses": 0,
                            "goals_for": 0,
                            "goals_against": 0,
                            "player_goals": 0,
                            "player_assists": 0,
                            "partner_1_goals": 0,
                            "partner_1_assists": 0,
                            "partner_2_goals": 0,
                            "partner_2_assists": 0,
                            "mutual_trio_goals": 0,
                        }

                    t_entry = trios_data[key]
                    t_entry["matches_together"] += 1
                    if is_win:
                        t_entry["wins"] += 1
                    elif is_draw:
                        t_entry["draws"] += 1
                    else:
                        t_entry["losses"] += 1
                    t_entry["goals_for"] += gf
                    t_entry["goals_against"] += ga
                    t_entry["player_goals"] += player_goals_count
                    t_entry["player_assists"] += player_assists_count
                    t_entry["partner_1_goals"] += goals_by_player.get(p2.id_player, 0)
                    t_entry["partner_1_assists"] += assists_by_player.get(p2.id_player, 0)
                    t_entry["partner_2_goals"] += goals_by_player.get(p3.id_player, 0)
                    t_entry["partner_2_assists"] += assists_by_player.get(p3.id_player, 0)

                    trio_ids = {player_id, p2.id_player, p3.id_player}
                    for play_id_val, scorer in goals_plays.items():
                        passer = assists_plays.get(play_id_val)
                        if scorer in trio_ids and passer in trio_ids and scorer != passer:
                            t_entry["mutual_trio_goals"] += 1

        pairs_list = []
        for p in pairs_data.values():
            m_cnt = p["matches_together"]
            p["win_rate"] = round((p["wins"] / m_cnt * 100), 1) if m_cnt > 0 else 0.0
            p["mutual_goals"] = p["player_assisted_by_partner"] + p["partner_assisted_by_player"]
            pairs_list.append(p)

        pairs_list.sort(key=lambda x: (x["matches_together"], x["wins"], x["win_rate"]), reverse=True)

        trios_list = []
        for t in trios_data.values():
            m_cnt = t["matches_together"]
            t["win_rate"] = round((t["wins"] / m_cnt * 100), 1) if m_cnt > 0 else 0.0
            t["total_trio_goals"] = t["player_goals"] + t["partner_1_goals"] + t["partner_2_goals"]
            t["total_trio_assists"] = t["player_assists"] + t["partner_1_assists"] + t["partner_2_assists"]
            trios_list.append(t)

        trios_list.sort(key=lambda x: (x["matches_together"], x["wins"], x["win_rate"]), reverse=True)

        return {
            "player_id": player_id,
            "player_name": target_player.nome,
            "player_apelido": target_player.apelido or target_player.nome,
            "season_id": season_id,
            "total_matches_evaluated": len(matches),
            "pairs": pairs_list,
            "trios": trios_list,
        }