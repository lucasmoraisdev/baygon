from datetime import datetime, timezone
from typing import Dict, List, Optional, Set, Tuple

from fastapi import HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.enum.events_enum import EventTypeEnum
from app.core.services.sumula_ocr_service import (
    SumulaOCRService,
    fuzzy_match_name,
    normalize_text,
)
from app.core.services.sumula_tabular_service import SumulaTabularService
from app.db.models.award import Awards
from app.db.models.match import Match
from app.db.models.match_event import MatchEvent
from app.db.models.player import Player
from app.db.models.player_score import PlayerScore
from app.db.models.player_season_score import PlayerSeasonScore
from app.db.models.round import Round
from app.db.models.season import Seasons
from app.db.models.team import Teams
from app.schemas.sumula_schema import (
    SumulaImportRequest,
    SumulaImportResponse,
    SumulaParsedData,
    SumulaPreviewResponse,
)


def _parse_round_datetime(date_str: Optional[str]) -> datetime:
    if not date_str:
        return datetime.now(timezone.utc)
    for fmt in ("%Y-%m-%d", "%d/%m/%Y", "%d/%m/%y", "%Y-%m-%dT%H:%M:%S"):
        try:
            dt = datetime.strptime(date_str.strip(), fmt)
            return dt.replace(tzinfo=timezone.utc)
        except ValueError:
            continue
    try:
        dt = datetime.fromisoformat(date_str.replace("Z", "+00:00"))
        return dt if dt.tzinfo else dt.replace(tzinfo=timezone.utc)
    except ValueError:
        return datetime.now(timezone.utc)


class SumulaImportService:
    """Orquestra preview (OCR/Visão ou CSV/XLSX) e cadastro transacional completo de uma súmula."""

    def __init__(self, db: AsyncSession):
        self.db = db
        self.ocr_service = SumulaOCRService()
        self.tabular_service = SumulaTabularService()

    async def _load_active_players(self) -> List[Player]:
        stmt = select(Player).where(Player.deleted_at.is_(None))
        result = await self.db.execute(stmt)
        return list(result.scalars().all())

    def _build_player_candidates(self, players: List[Player]) -> List[Tuple[int, str]]:
        candidates: List[Tuple[int, str]] = []
        for p in players:
            if p.nome:
                candidates.append((p.id_player, p.nome))
            if p.apelido and normalize_text(p.apelido) != normalize_text(p.nome or ""):
                candidates.append((p.id_player, p.apelido))
        return candidates

    async def _resolve_season(self, season_id: Optional[int]) -> Seasons:
        if season_id is not None:
            stmt = select(Seasons).where(
                Seasons.id_season == season_id,
                Seasons.deleted_at.is_(None),
            )
            season = (await self.db.execute(stmt)).scalar_one_or_none()
            if not season:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail=f"Temporada {season_id} não encontrada.",
                )
            return season

        stmt = (
            select(Seasons)
            .where(Seasons.deleted_at.is_(None), Seasons.is_active.is_(True))
            .order_by(Seasons.number.desc())
        )
        season = (await self.db.execute(stmt)).scalars().first()
        if not season:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Nenhuma temporada ativa encontrada. Informe season_id.",
            )
        return season

    async def _next_round_number(self, season_id: int) -> int:
        stmt = select(func.max(Round.round_number)).where(
            Round.season_id == season_id,
            Round.deleted_at.is_(None),
        )
        max_num = (await self.db.execute(stmt)).scalar() or 0
        return int(max_num) + 1

    async def _get_round_by_number(self, season_id: int, round_number: int) -> Optional[Round]:
        stmt = select(Round).where(
            Round.season_id == season_id,
            Round.round_number == round_number,
            Round.deleted_at.is_(None),
        )
        return (await self.db.execute(stmt)).scalars().first()

    async def _build_preview_response(
        self,
        parsed: SumulaParsedData,
        season_id: Optional[int],
        round_number: Optional[int],
    ) -> SumulaPreviewResponse:
        season = await self._resolve_season(season_id)
        resolved_round_num = (
            round_number
            or parsed.header.baba_number
            or await self._next_round_number(season.id_season)
        )
        existing_round = await self._get_round_by_number(season.id_season, resolved_round_num)
        return SumulaPreviewResponse(
            **parsed.model_dump(),
            season_id=season.id_season,
            round_number=resolved_round_num,
            round_exists=existing_round is not None,
        )

    async def preview_sumula(
        self,
        image_bytes: bytes,
        season_id: Optional[int] = None,
        round_number: Optional[int] = None,
        provider: str = "auto",
    ) -> SumulaPreviewResponse:
        players = await self._load_active_players()
        candidates = self._build_player_candidates(players)
        parsed = await self.ocr_service.extract_from_image(
            image_bytes=image_bytes,
            known_players=candidates,
            provider=provider,
        )
        return await self._build_preview_response(parsed, season_id, round_number)

    async def preview_sumula_file(
        self,
        file_bytes: bytes,
        filename: str,
        season_id: Optional[int] = None,
        round_number: Optional[int] = None,
    ) -> SumulaPreviewResponse:
        players = await self._load_active_players()
        candidates = self._build_player_candidates(players)
        parsed = self.tabular_service.parse_file(
            file_bytes=file_bytes,
            filename=filename,
            known_players=candidates,
        )
        return await self._build_preview_response(parsed, season_id, round_number)

    async def import_sumula(
        self,
        payload: SumulaImportRequest,
        current_user_id: int,
        parsed_data: Optional[SumulaParsedData] = None,
    ) -> SumulaImportResponse:
        try:
            season = await self._resolve_season(payload.season_id)
            round_number = (
                payload.round_number
                or payload.header.baba_number
                or await self._next_round_number(season.id_season)
            )

            existing_round = await self._get_round_by_number(season.id_season, round_number)
            if existing_round and not payload.overwrite_existing_round:
                raise HTTPException(
                    status_code=status.HTTP_409_CONFLICT,
                    detail=(
                        f"Rodada {round_number} já existe na temporada {season.id_season}. "
                        "Use overwrite_existing_round=true para substituir."
                    ),
                )

            round_dt = _parse_round_datetime(payload.header.date)
            location = (payload.header.location or "Não informado").strip()
            referee = (payload.header.referee or "Não informado").strip()

            if existing_round:
                # Limpa dados antigos da rodada antes de reimportar
                now = datetime.now(timezone.utc)
                old_matches = (
                    await self.db.execute(
                        select(Match).where(Match.round_id == existing_round.id_round, Match.deleted_at.is_(None))
                    )
                ).scalars().all()
                for m in old_matches:
                    old_events = (
                        await self.db.execute(
                            select(MatchEvent).where(MatchEvent.match_id == m.id_match, MatchEvent.deleted_at.is_(None))
                        )
                    ).scalars().all()
                    for ev in old_events:
                        ev.deleted_at = now
                    m.deleted_at = now

                old_teams = (
                    await self.db.execute(
                        select(Teams).where(Teams.round_id == existing_round.id_round, Teams.deleted_at.is_(None))
                    )
                ).scalars().all()
                for t in old_teams:
                    t.deleted_at = now

                old_scores = (
                    await self.db.execute(
                        select(PlayerScore).where(
                            PlayerScore.round_id == existing_round.id_round,
                            PlayerScore.deleted_at.is_(None),
                        )
                    )
                ).scalars().all()
                for s in old_scores:
                    s.deleted_at = now

                old_awards = (
                    await self.db.execute(
                        select(Awards).where(Awards.round_id == existing_round.id_round, Awards.deleted_at.is_(None))
                    )
                ).scalars().all()
                for aw in old_awards:
                    aw.deleted_at = now

                existing_round.date = round_dt
                existing_round.location = location
                existing_round.referee = referee
                existing_round.updated_at = now
                round_obj = existing_round
                await self.db.flush()
            else:
                round_obj = Round(
                    date=round_dt,
                    location=location,
                    referee=referee,
                    initial_time=round_dt,
                    end_time=round_dt,
                    round_number=round_number,
                    season_id=season.id_season,
                )
                self.db.add(round_obj)
                await self.db.flush()

            # Carrega jogadores existentes e monta índice de busca
            existing_players = await self._load_active_players()
            players_by_id: Dict[int, Player] = {p.id_player: p for p in existing_players}
            players_by_norm: Dict[str, Player] = {}
            for p in existing_players:
                if p.nome:
                    players_by_norm[normalize_text(p.nome)] = p
                if p.apelido:
                    players_by_norm[normalize_text(p.apelido)] = p

            players_created = 0
            players_matched_ids: Set[int] = set()
            warnings: List[str] = list(parsed_data.warnings) if parsed_data else []

            async def _get_or_create_player(
                explicit_id: Optional[int],
                raw_name: str,
                pote: Optional[int] = None,
            ) -> Player:
                nonlocal players_created
                if explicit_id and explicit_id in players_by_id:
                    pl = players_by_id[explicit_id]
                    players_matched_ids.add(pl.id_player)
                    if payload.update_player_potes and pote is not None and pl.potes is None:
                        pl.potes = pote
                    return pl

                norm = normalize_text(raw_name)
                if norm in players_by_norm:
                    pl = players_by_norm[norm]
                    players_matched_ids.add(pl.id_player)
                    if payload.update_player_potes and pote is not None and pl.potes is None:
                        pl.potes = pote
                    return pl

                # Fuzzy fallback contra jogadores existentes
                candidates = self._build_player_candidates(list(players_by_id.values()))
                fid, _, _ = fuzzy_match_name(raw_name, candidates, min_score=0.78)
                if fid and fid in players_by_id:
                    pl = players_by_id[fid]
                    players_matched_ids.add(pl.id_player)
                    if payload.update_player_potes and pote is not None and pl.potes is None:
                        pl.potes = pote
                    return pl

                if not payload.create_missing_players:
                    raise HTTPException(
                        status_code=status.HTTP_400_BAD_REQUEST,
                        detail=f"Jogador '{raw_name}' não encontrado e create_missing_players=false.",
                    )

                clean_name = norm or raw_name.strip()
                new_pl = Player(
                    nome=clean_name,
                    apelido=clean_name,
                    potes=pote,
                    is_associate=True,
                    is_guest=False,
                )
                self.db.add(new_pl)
                await self.db.flush()
                players_by_id[new_pl.id_player] = new_pl
                players_by_norm[normalize_text(clean_name)] = new_pl
                players_created += 1
                return new_pl

            # Normaliza mapa de extra_points_overrides
            overrides_norm: Dict[str, int] = {
                normalize_text(k): int(v) for k, v in payload.extra_points_overrides.items()
            }

            # 1. Resolver jogadores das 6 tabelas e criar Times válidos (>= 2 jogadores)
            teams_by_slot: Dict[int, Teams] = {}
            teams_by_norm_name: Dict[str, Teams] = {}
            player_team_map: Dict[int, int] = {}  # player_id -> team_id
            round_player_stats: Dict[int, Dict[str, int]] = {}
            teams_created = 0

            for block in payload.teams:
                is_extra_only = len(block.players) == 1
                is_valid_team = len(block.players) >= 2 and block.is_valid_team

                team_players_objs: List[Player] = []
                seen_in_team: Set[int] = set()

                for row in block.players:
                    effective_pote = None if (is_extra_only or row.is_extra or row.row_index == 6) else (row.pote or row.row_index)
                    pl = await _get_or_create_player(
                        explicit_id=row.matched_player_id,
                        raw_name=row.raw_name,
                        pote=effective_pote,
                    )

                    # Aplica extra_points (da súmula ou override do usuário)
                    extra_pts = row.extra_points
                    norm_row_name = normalize_text(row.raw_name)
                    norm_pl_name = normalize_text(pl.nome)
                    if str(pl.id_player) in payload.extra_points_overrides:
                        extra_pts = int(payload.extra_points_overrides[str(pl.id_player)])
                    elif norm_row_name in overrides_norm:
                        extra_pts = overrides_norm[norm_row_name]
                    elif norm_pl_name in overrides_norm:
                        extra_pts = overrides_norm[norm_pl_name]

                    base_pts = row.base_points
                    total_pts = (base_pts + extra_pts) if (base_pts > 0 or extra_pts > 0) else row.total_points

                    round_player_stats[pl.id_player] = {
                        "goals": row.goals,
                        "assists": row.assists,
                        "extra_points": extra_pts,
                        "total_points": total_pts,
                    }

                    if is_valid_team and pl.id_player not in seen_in_team:
                        team_players_objs.append(pl)
                        seen_in_team.add(pl.id_player)

                if is_valid_team and team_players_objs:
                    t_name = (
                        block.team_name
                        or team_players_objs[0].apelido
                        or team_players_objs[0].nome
                    )
                    team_obj = Teams(
                        name=normalize_text(t_name) or t_name,
                        round_id=round_obj.id_round,
                    )
                    team_obj.players.extend(team_players_objs)
                    self.db.add(team_obj)
                    await self.db.flush()

                    teams_by_slot[block.slot_index] = team_obj
                    teams_by_norm_name[normalize_text(team_obj.name)] = team_obj
                    teams_by_norm_name[normalize_text(team_players_objs[0].nome)] = team_obj
                    if team_players_objs[0].apelido:
                        teams_by_norm_name[normalize_text(team_players_objs[0].apelido)] = team_obj
                    for pl in team_players_objs:
                        player_team_map[pl.id_player] = team_obj.id_team
                    teams_created += 1

            # 2. Criar Partidas e Eventos (Gols / Assistências)
            def _resolve_team(slot: Optional[int], name: str) -> Optional[Teams]:
                if slot is not None and slot in teams_by_slot:
                    return teams_by_slot[slot]
                norm = normalize_text(name)
                if norm in teams_by_norm_name:
                    return teams_by_norm_name[norm]
                team_cands = [(tid, tname) for tname, t in teams_by_norm_name.items() for tid in [t.id_team]]
                tid, _, _ = fuzzy_match_name(name, team_cands, min_score=0.50)
                if tid:
                    for t in teams_by_slot.values():
                        if t.id_team == tid:
                            return t
                return None

            matches_created = 0
            match_events_created = 0
            created_matches: List[Match] = []
            team_wins_count: Dict[int, int] = {}

            for m_item in payload.matches:
                home_team = _resolve_team(m_item.home_team_slot, m_item.home_team_name)
                away_team = _resolve_team(m_item.away_team_slot, m_item.away_team_name)
                if not home_team or not away_team:
                    warnings.append(
                        f"Partida #{m_item.match_number} ({m_item.home_team_name} x {m_item.away_team_name}) ignorada: time não encontrado."
                    )
                    continue

                if m_item.score_home > m_item.score_away:
                    outcome = EventTypeEnum.HOME_WIN
                    team_wins_count[home_team.id_team] = team_wins_count.get(home_team.id_team, 0) + 1
                elif m_item.score_away > m_item.score_home:
                    outcome = EventTypeEnum.AWAY_WIN
                    team_wins_count[away_team.id_team] = team_wins_count.get(away_team.id_team, 0) + 1
                else:
                    outcome = EventTypeEnum.DRAW

                filmed_by_user_id = current_user_id
                if m_item.camera_player_id and m_item.camera_player_id in players_by_id:
                    cam_pl = players_by_id[m_item.camera_player_id]
                    if cam_pl.user_id:
                        filmed_by_user_id = cam_pl.user_id
                elif m_item.camera_name:
                    cam_pl = await _get_or_create_player(None, m_item.camera_name, pote=None)
                    if cam_pl.user_id:
                        filmed_by_user_id = cam_pl.user_id

                match_obj = Match(
                    round_id=round_obj.id_round,
                    home_team_id=home_team.id_team,
                    away_team_id=away_team.id_team,
                    filmed_by=filmed_by_user_id,
                    event_type=outcome,
                    score_home=m_item.score_home,
                    score_away=m_item.score_away,
                )
                self.db.add(match_obj)
                await self.db.flush()
                created_matches.append(match_obj)
                matches_created += 1

                for g_item in m_item.goals:
                    scorer = await _get_or_create_player(g_item.scorer_player_id, g_item.scorer_name, pote=None)
                    self.db.add(
                        MatchEvent(
                            match_id=match_obj.id_match,
                            player_id=scorer.id_player,
                            event_type=EventTypeEnum.GOAL,
                            play_id=g_item.play_id,
                        )
                    )
                    match_events_created += 1

                    if g_item.assist_name or g_item.assist_player_id:
                        assister = await _get_or_create_player(
                            g_item.assist_player_id,
                            g_item.assist_name or "",
                            pote=None,
                        )
                        self.db.add(
                            MatchEvent(
                                match_id=match_obj.id_match,
                                player_id=assister.id_player,
                                event_type=EventTypeEnum.ASSIST,
                                play_id=g_item.play_id,
                            )
                        )
                        match_events_created += 1

            # 3. Registrar Ouros (BLUNDER) do rodapé
            ouros_registered = 0
            if created_matches:
                for o_item in payload.ouros:
                    if o_item.count <= 0:
                        continue
                    pl = await _get_or_create_player(o_item.player_id, o_item.raw_name, pote=None)
                    pl_team_id = player_team_map.get(pl.id_player)
                    anchor_match = next(
                        (
                            m
                            for m in created_matches
                            if pl_team_id and (m.home_team_id == pl_team_id or m.away_team_id == pl_team_id)
                        ),
                        created_matches[0],
                    )
                    for _ in range(o_item.count):
                        self.db.add(
                            MatchEvent(
                                match_id=anchor_match.id_match,
                                player_id=pl.id_player,
                                event_type=EventTypeEnum.BLUNDER,
                                play_id=None,
                            )
                        )
                        match_events_created += 1
                        ouros_registered += 1
            elif payload.ouros:
                warnings.append("Ouros informados não puderam ser vinculados porque nenhuma partida foi criada.")

            # 4. Criar PlayerScore da rodada e recalcular PlayerSeasonScore
            player_scores_created = 0
            affected_player_ids: Set[int] = set()
            for pid, stats in round_player_stats.items():
                points_individual = stats["goals"] + stats["assists"] + stats["extra_points"]
                total_points = stats["total_points"]
                points_team = total_points - points_individual

                self.db.add(
                    PlayerScore(
                        player_id=pid,
                        round_id=round_obj.id_round,
                        season_id=season.id_season,
                        points_individual=points_individual,
                        points_team=points_team,
                        total_points=total_points,
                    )
                )
                player_scores_created += 1
                affected_player_ids.add(pid)

            await self.db.flush()

            player_season_scores_updated = 0
            for pid in affected_player_ids:
                season_sum_stmt = select(func.coalesce(func.sum(PlayerScore.total_points), 0)).where(
                    PlayerScore.player_id == pid,
                    PlayerScore.season_id == season.id_season,
                    PlayerScore.deleted_at.is_(None),
                )
                season_total = int((await self.db.execute(season_sum_stmt)).scalar() or 0)

                existing_ss_stmt = select(PlayerSeasonScore).where(
                    PlayerSeasonScore.player_id == pid,
                    PlayerSeasonScore.season_id == season.id_season,
                    PlayerSeasonScore.deleted_at.is_(None),
                )
                existing_ss = (await self.db.execute(existing_ss_stmt)).scalars().first()
                if existing_ss:
                    existing_ss.total_points = season_total
                    existing_ss.updated_at = datetime.now(timezone.utc)
                else:
                    self.db.add(
                        PlayerSeasonScore(
                            player_id=pid,
                            season_id=season.id_season,
                            total_points=season_total,
                        )
                    )
                player_season_scores_updated += 1

            # 5. Registrar prêmio do time vencedor da rodada (se marcado ou maior vencedor)
            round_winner_team_id: Optional[int] = None
            if payload.register_round_winner_award and teams_by_slot:
                champion_slots = [b.slot_index for b in payload.teams if b.is_champion and b.slot_index in teams_by_slot]
                winner_team: Optional[Teams] = None
                if champion_slots:
                    winner_team = teams_by_slot[champion_slots[0]]
                elif team_wins_count:
                    best_tid = max(team_wins_count, key=lambda tid: team_wins_count[tid])
                    for t in teams_by_slot.values():
                        if t.id_team == best_tid:
                            winner_team = t
                            break

                if winner_team:
                    award_obj = Awards(
                        round_id=round_obj.id_round,
                        event_type=EventTypeEnum.ROUND_WINNER,
                    )
                    award_obj.teams.append(winner_team)
                    self.db.add(award_obj)
                    round_winner_team_id = winner_team.id_team

            await self.db.commit()

            return SumulaImportResponse(
                round_id=round_obj.id_round,
                season_id=season.id_season,
                round_number=round_obj.round_number,
                date=round_obj.date,
                location=round_obj.location,
                referee=round_obj.referee,
                players_created=players_created,
                players_matched=len(players_matched_ids),
                teams_created=teams_created,
                matches_created=matches_created,
                match_events_created=match_events_created,
                ouros_registered=ouros_registered,
                player_scores_created=player_scores_created,
                player_season_scores_updated=player_season_scores_updated,
                round_winner_team_id=round_winner_team_id,
                warnings=warnings,
                parsed_data=parsed_data,
            )
        except HTTPException:
            await self.db.rollback()
            raise
        except Exception as exc:
            await self.db.rollback()
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Erro ao importar súmula: {exc}",
            ) from exc
