import csv
import io
from typing import Optional
from sqlalchemy import select
from sqlalchemy.orm import selectinload
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models.award import Awards
from app.db.models.match import Match
from app.db.models.match_event import MatchEvent
from app.db.models.player import Player
from app.db.models.player_score import PlayerScore
from app.db.models.round import Round
from app.db.models.season import Seasons
from app.db.models.team import Teams
from app.schemas.ranking_schema import AssociationRankingResponse, AssociationRankingRow


CSV_HEADERS = [
    "Boleiros",
    "Ranking Geral",
    "Artilharia",
    "Assistências",
    "Babas Conquistados",
    "Babas Perdidos",
    "Empates",
    "Pontos de Colaboração",
    "Prêmio Defesa",
    "Prêmio Drible",
    "Prêmio Gol",
    "Prêmio Inacreditável",
    "Presença no Baba",
    "Total de Gols Contra",
    "Bola Cheia",
    "Bola Murcha",
    "Clean Sheets",
    "Pizza",
    "Ouros",
    "Pontos Copas",
    "Seleção do Mês",
    "Roleta",
    "Último Baba",
    "Última Vitória",
    "Posição",
]


class AssociationRankingService:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def _resolve_season(self, season_id: Optional[int]) -> Optional[Seasons]:
        if season_id is not None:
            stmt = select(Seasons).where(Seasons.id_season == season_id, Seasons.deleted_at.is_(None))
            return (await self.db.execute(stmt)).scalar_one_or_none()

        active_stmt = (
            select(Seasons)
            .where(Seasons.is_active.is_(True), Seasons.deleted_at.is_(None))
            .order_by(Seasons.number.desc())
        )
        season = (await self.db.execute(active_stmt)).scalars().first()
        if season:
            return season

        latest_stmt = (
            select(Seasons)
            .where(Seasons.deleted_at.is_(None))
            .order_by(Seasons.number.desc())
        )
        return (await self.db.execute(latest_stmt)).scalars().first()

    async def get_season_ranking(self, season_id: Optional[int] = None) -> AssociationRankingResponse:
        season = await self._resolve_season(season_id)
        players = list(
            (
                await self.db.execute(
                    select(Player).where(Player.deleted_at.is_(None))
                )
            )
            .scalars()
            .all()
        )
        if not season:
            return AssociationRankingResponse(season_id=None, season_number=None, rows=[])

        rounds = list(
            (
                await self.db.execute(
                    select(Round).where(
                        Round.season_id == season.id_season,
                        Round.deleted_at.is_(None),
                    )
                )
            )
            .scalars()
            .all()
        )
        round_map = {r.id_round: r for r in rounds}
        round_ids = list(round_map.keys())

        stats_by_player: dict[int, dict] = {
            p.id_player: {
                "player_id": p.id_player,
                "boleiro": p.apelido or p.nome,
                "ranking_geral": 0,
                "artilharia": 0,
                "assistencias": 0,
                "babas_conquistados": 0,
                "babas_perdidos": 0,
                "empates": 0,
                "pontos_colaboracao": 0,
                "premio_defesa": 0,
                "premio_drible": 0,
                "premio_gol": 0,
                "premio_inacreditavel": 0,
                "presenca_rounds": set(),
                "total_gols_contra": 0,
                "bola_cheia": 0,
                "bola_murcha": 0,
                "clean_sheets": 0,
                "pizza": 0,
                "ouros": 0,
                "pontos_copas": 0,
                "selecao_mes": 0,
                "roleta": 0,
                "max_round_num": 0,
                "max_win_round_num": 0,
                "posicao": (p.posicao or "-").upper(),
                "is_goalkeeper": (p.posicao or "").lower() == "goleiro",
            }
            for p in players
        }

        if round_ids:
            # 1. Teams & round participation
            teams = list(
                (
                    await self.db.execute(
                        select(Teams)
                        .options(selectinload(Teams.players))
                        .where(Teams.round_id.in_(round_ids), Teams.deleted_at.is_(None))
                    )
                )
                .scalars()
                .all()
            )
            team_player_ids: dict[int, list[int]] = {}
            for t in teams:
                r_obj = round_map.get(t.round_id)
                r_num = r_obj.round_number if r_obj else 0
                pids = []
                for tp in t.players:
                    pids.append(tp.id_player)
                    if tp.id_player in stats_by_player:
                        st = stats_by_player[tp.id_player]
                        st["presenca_rounds"].add(t.round_id)
                        if r_num > st["max_round_num"]:
                            st["max_round_num"] = r_num
                team_player_ids[t.id_team] = pids

            # 2. Matches (W/L/D, Clean Sheets, Última Vitória)
            matches = list(
                (
                    await self.db.execute(
                        select(Match).where(
                            Match.round_id.in_(round_ids),
                            Match.deleted_at.is_(None),
                        )
                    )
                )
                .scalars()
                .all()
            )
            match_ids = [m.id_match for m in matches]
            for m in matches:
                r_obj = round_map.get(m.round_id)
                r_num = r_obj.round_number if r_obj else 0
                home_pids = team_player_ids.get(m.home_team_id, [])
                away_pids = team_player_ids.get(m.away_team_id, [])

                if m.score_home > m.score_away:
                    for pid in home_pids:
                        if pid in stats_by_player:
                            stats_by_player[pid]["babas_conquistados"] += 1
                            if r_num > stats_by_player[pid]["max_win_round_num"]:
                                stats_by_player[pid]["max_win_round_num"] = r_num
                    for pid in away_pids:
                        if pid in stats_by_player:
                            stats_by_player[pid]["babas_perdidos"] += 1
                elif m.score_away > m.score_home:
                    for pid in away_pids:
                        if pid in stats_by_player:
                            stats_by_player[pid]["babas_conquistados"] += 1
                            if r_num > stats_by_player[pid]["max_win_round_num"]:
                                stats_by_player[pid]["max_win_round_num"] = r_num
                    for pid in home_pids:
                        if pid in stats_by_player:
                            stats_by_player[pid]["babas_perdidos"] += 1
                else:
                    for pid in home_pids + away_pids:
                        if pid in stats_by_player:
                            stats_by_player[pid]["empates"] += 1

                if m.score_away == 0:
                    for pid in home_pids:
                        if pid in stats_by_player and stats_by_player[pid]["is_goalkeeper"]:
                            stats_by_player[pid]["clean_sheets"] += 1
                if m.score_home == 0:
                    for pid in away_pids:
                        if pid in stats_by_player and stats_by_player[pid]["is_goalkeeper"]:
                            stats_by_player[pid]["clean_sheets"] += 1

            # 3. MatchEvents (goals, assists, own goals, ouros)
            if match_ids:
                events = list(
                    (
                        await self.db.execute(
                            select(MatchEvent).where(
                                MatchEvent.match_id.in_(match_ids),
                                MatchEvent.deleted_at.is_(None),
                            )
                        )
                    )
                    .scalars()
                    .all()
                )
                for ev in events:
                    if ev.player_id not in stats_by_player:
                        continue
                    st = stats_by_player[ev.player_id]
                    if ev.event_type == "gol":
                        st["artilharia"] += 1
                    elif ev.event_type == "assistencia":
                        st["assistencias"] += 1
                    elif ev.event_type == "gol_contra":
                        st["total_gols_contra"] += 1
                    elif ev.event_type == "ouro":
                        st["ouros"] += 1

            # 4. Awards
            awards = list(
                (
                    await self.db.execute(
                        select(Awards)
                        .options(selectinload(Awards.player), selectinload(Awards.teams))
                        .where(
                            Awards.round_id.in_(round_ids),
                            Awards.deleted_at.is_(None),
                        )
                    )
                )
                .scalars()
                .all()
            )
            for aw in awards:
                aw_type = aw.event_type.value if hasattr(aw.event_type, "value") else str(aw.event_type)
                recipient_ids: set[int] = set()
                for p in aw.player or []:
                    if p.id_player in stats_by_player:
                        recipient_ids.add(p.id_player)
                for t in aw.teams or []:
                    for pid in team_player_ids.get(t.id_team, []):
                        if pid in stats_by_player:
                            recipient_ids.add(pid)

                for pid in recipient_ids:
                    st = stats_by_player[pid]
                    if aw_type == "defesa_rodada":
                        st["premio_defesa"] += 1
                    elif aw_type == "drible_rodada":
                        st["premio_drible"] += 1
                    elif aw_type == "gol_rodada":
                        st["premio_gol"] += 1
                    elif aw_type == "inacreditavel":
                        st["premio_inacreditavel"] += 1
                    elif aw_type == "bola_cheia":
                        st["bola_cheia"] += 1
                    elif aw_type == "bola_murcha":
                        st["bola_murcha"] += 1
                    elif aw_type == "time_vencedor_rodada":
                        st["pizza"] += 1
                    elif aw_type == "roleta":
                        st["roleta"] += 1
                    elif aw_type == "selecao_mes":
                        st["selecao_mes"] += 1
                    elif aw_type == "ouro":
                        st["ouros"] += 1

            # 5. PlayerScores (Ranking Geral)
            scores = list(
                (
                    await self.db.execute(
                        select(PlayerScore).where(
                            PlayerScore.round_id.in_(round_ids),
                            PlayerScore.deleted_at.is_(None),
                        )
                    )
                )
                .scalars()
                .all()
            )
            for sc in scores:
                if sc.player_id in stats_by_player:
                    stats_by_player[sc.player_id]["ranking_geral"] += int(sc.total_points or 0)
                    stats_by_player[sc.player_id]["presenca_rounds"].add(sc.round_id)

        rows = [
            AssociationRankingRow(
                player_id=st["player_id"],
                boleiro=st["boleiro"],
                ranking_geral=st["ranking_geral"],
                artilharia=st["artilharia"],
                assistencias=st["assistencias"],
                babas_conquistados=st["babas_conquistados"],
                babas_perdidos=st["babas_perdidos"],
                empates=st["empates"],
                pontos_colaboracao=st["pontos_colaboracao"],
                premio_defesa=st["premio_defesa"],
                premio_drible=st["premio_drible"],
                premio_gol=st["premio_gol"],
                premio_inacreditavel=st["premio_inacreditavel"],
                presenca_baba=len(st["presenca_rounds"]),
                total_gols_contra=st["total_gols_contra"],
                bola_cheia=st["bola_cheia"],
                bola_murcha=st["bola_murcha"],
                clean_sheets=st["clean_sheets"],
                pizza=st["pizza"],
                ouros=st["ouros"],
                pontos_copas=st["pontos_copas"],
                selecao_mes=st["selecao_mes"],
                roleta=st["roleta"],
                ultimo_baba=f"{st['max_round_num']}°" if st["max_round_num"] > 0 else "-",
                ultima_vitoria=f"{st['max_win_round_num']}°" if st["max_win_round_num"] > 0 else "NÃO",
                posicao=st["posicao"],
            )
            for st in stats_by_player.values()
        ]

        rows.sort(
            key=lambda r: (
                -r.ranking_geral,
                -r.artilharia,
                -r.assistencias,
                -r.babas_conquistados,
                r.boleiro.lower(),
            )
        )
        return AssociationRankingResponse(
            season_id=season.id_season,
            season_number=season.number,
            rows=rows,
        )

    async def export_season_ranking_csv(self, season_id: Optional[int] = None) -> tuple[str, Optional[int]]:
        data = await self.get_season_ranking(season_id)
        output = io.StringIO()
        writer = csv.writer(output)
        title = (
            f"RANKING ASSOCIAÇÃO BAYGON - {data.season_number}ª TEMPORADA"
            if data.season_number is not None
            else "RANKING ASSOCIAÇÃO BAYGON"
        )
        writer.writerow([title] + [""] * (len(CSV_HEADERS) - 1))
        writer.writerow(CSV_HEADERS)
        for r in data.rows:
            writer.writerow([
                r.boleiro,
                r.ranking_geral,
                r.artilharia,
                r.assistencias,
                r.babas_conquistados,
                r.babas_perdidos,
                r.empates,
                r.pontos_colaboracao,
                r.premio_defesa,
                r.premio_drible,
                r.premio_gol,
                r.premio_inacreditavel,
                r.presenca_baba,
                r.total_gols_contra,
                r.bola_cheia,
                r.bola_murcha,
                r.clean_sheets,
                r.pizza,
                r.ouros,
                r.pontos_copas,
                r.selecao_mes,
                r.roleta,
                r.ultimo_baba,
                r.ultima_vitoria,
                r.posicao,
            ])
        return output.getvalue(), data.season_number
