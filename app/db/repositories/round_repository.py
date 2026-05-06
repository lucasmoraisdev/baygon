from datetime import datetime, timezone
from typing import Any, Dict, Optional, Sequence
from sqlalchemy import and_, distinct, func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.db.models.match import Match
from app.db.models.match_event import MatchEvent
from app.db.models.player import Player
from app.db.models.team import Teams
from app.core.enum.events_enum import EventTypeEnum

from app.db.models.round import Round

class RoundRepository:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def create(self, round: Round) -> Round:
        """
        Cria uma nova rodada.
        """
        self.db.add(round)
        await self.db.commit()
        await self.db.refresh(round)
        return round

    async def get_by_id(self, id_round: int) -> Optional[Round]:
        """
        Busca uma rodada pelo seu id.
        """
        stmt = select(Round).where(
            Round.id_round == id_round
        )
        result = await self.db.execute(stmt)
        return result.scalar_one_or_none()
    
    async def list_all_rounds_from_season(self, season_id: int) -> Sequence[Round]:
        """
        Lista todas as rodadas.
        """
        stmt = select(Round).where(
            Round.season_id == season_id,
            Round.deleted_at.is_(None)
        )
        result = await self.db.execute(stmt)
        return result.scalars().all()
    
    async def edit_round(self, id_round: int, updates: dict) -> Optional[Round]:
        """
        Edita uma rodada de uma temporada.
        """
        round = await self.get_by_id(id_round)
        if not round:
            return None
        for key, value in updates.items():
            if hasattr(round, key):
                setattr(round, key, value)
        round.updated_at = datetime.now(timezone.utc)
        await self.db.commit()
        await self.db.refresh(round)
        return round
    
    async def delete_round(self, id_round: int) -> bool:
        """
        Deleta uma rodada de uma temporada.
        """
        round = await self.get_by_id(id_round)
        if not round:
            return False
        
        round.deleted_at = datetime.now(timezone.utc)
        await self.db.commit()
        return True

    async def get_round_stats(self, round_id: int) -> Dict[str, Any]:
        """
        Retorna estatísticas completas de uma rodada agrupando eventos de partida.
        """
        # Quantidade de partidas
        matches_stmt = select(Match).where(
            Match.round_id == round_id,
            Match.deleted_at.is_(None)
        )
        matches_result = await self.db.execute(matches_stmt)
        matches = matches_result.scalars().all()
        total_matches = len(matches)
        match_ids = [m.id_match for m in matches]

        def event_count(event_types):
            return (
                select(func.count(MatchEvent.id_event))
                .where(
                    MatchEvent.match_id.in_(match_ids),
                    MatchEvent.event_type.in_(event_types),
                    MatchEvent.deleted_at.is_(None)
                )
            )

        total_goals = (await self.db.execute(event_count([EventTypeEnum.GOAL]))).scalar() or 0
        total_assists = (await self.db.execute(event_count([EventTypeEnum.ASSIST]))).scalar() or 0
        total_yellow_cards = (await self.db.execute(event_count([EventTypeEnum.YELLOW_CARD]))).scalar() or 0
        total_red_cards = (await self.db.execute(event_count([EventTypeEnum.RED_CARD]))).scalar() or 0
        # Cartão azul = blunder/ouro no contexto do sistema
        total_blue_cards = (await self.db.execute(event_count([EventTypeEnum.BLUNDER]))).scalar() or 0

        # Top scorer
        top_scorer_stmt = (
            select(Player.id_player, Player.nome, Player.apelido, func.count(MatchEvent.id_event).label("count"))
            .join(MatchEvent, MatchEvent.player_id == Player.id_player)
            .where(
                MatchEvent.match_id.in_(match_ids),
                MatchEvent.event_type == EventTypeEnum.GOAL,
                MatchEvent.deleted_at.is_(None)
            )
            .group_by(Player.id_player, Player.nome, Player.apelido)
            .order_by(func.count(MatchEvent.id_event).desc())
            .limit(1)
        )
        top_scorer_result = await self.db.execute(top_scorer_stmt)
        top_scorer_row = top_scorer_result.first()

        # Top assister
        top_assister_stmt = (
            select(Player.id_player, Player.nome, Player.apelido, func.count(MatchEvent.id_event).label("count"))
            .join(MatchEvent, MatchEvent.player_id == Player.id_player)
            .where(
                MatchEvent.match_id.in_(match_ids),
                MatchEvent.event_type == EventTypeEnum.ASSIST,
                MatchEvent.deleted_at.is_(None)
            )
            .group_by(Player.id_player, Player.nome, Player.apelido)
            .order_by(func.count(MatchEvent.id_event).desc())
            .limit(1)
        )
        top_assister_result = await self.db.execute(top_assister_stmt)
        top_assister_row = top_assister_result.first()

        # Winner team (time com mais vitórias na rodada)
        winner_stmt = (
            select(Teams.id_team, Teams.name, func.count(MatchEvent.id_event).label("wins"))
            .join(MatchEvent, Teams.id_team == MatchEvent.player_id)  # placeholder join
            .limit(0)  # skip — calculated below
        )
        # Calcular winner via event HOME_WIN/AWAY_WIN e home_team_id/away_team_id
        home_wins_stmt = (
            select(Match.home_team_id.label("team_id"), func.count(Match.id_match).label("wins"))
            .where(
                Match.round_id == round_id,
                Match.event_type == EventTypeEnum.HOME_WIN,
                Match.deleted_at.is_(None)
            )
            .group_by(Match.home_team_id)
        )
        away_wins_stmt = (
            select(Match.away_team_id.label("team_id"), func.count(Match.id_match).label("wins"))
            .where(
                Match.round_id == round_id,
                Match.event_type == EventTypeEnum.AWAY_WIN,
                Match.deleted_at.is_(None)
            )
            .group_by(Match.away_team_id)
        )
        home_wins = (await self.db.execute(home_wins_stmt)).fetchall()
        away_wins = (await self.db.execute(away_wins_stmt)).fetchall()

        wins_by_team: Dict[int, int] = {}
        for row in home_wins:
            wins_by_team[row.team_id] = wins_by_team.get(row.team_id, 0) + row.wins
        for row in away_wins:
            wins_by_team[row.team_id] = wins_by_team.get(row.team_id, 0) + row.wins

        winner_team = None
        if wins_by_team:
            best_team_id = max(wins_by_team, key=lambda k: wins_by_team[k])
            team_res = await self.db.execute(select(Teams).where(Teams.id_team == best_team_id))
            team_obj = team_res.scalar_one_or_none()
            if team_obj:
                winner_team = {"id": team_obj.id_team, "name": team_obj.name, "wins": wins_by_team[best_team_id]}

        # Jogadores participantes (distinct players with events in this round's matches)
        participants_stmt = (
            select(Player.id_player, Player.nome, Player.apelido, Player.posicao)
            .join(MatchEvent, MatchEvent.player_id == Player.id_player)
            .where(
                MatchEvent.match_id.in_(match_ids),
                MatchEvent.deleted_at.is_(None)
            )
            .distinct()
        )
        participants_result = await self.db.execute(participants_stmt)
        participants = [
            {"id": r.id_player, "nome": r.nome, "apelido": r.apelido, "posicao": r.posicao}
            for r in participants_result.fetchall()
        ]

        return {
            "total_matches": total_matches,
            "total_goals": total_goals,
            "total_assists": total_assists,
            "goals_per_match": round(total_goals / total_matches, 2) if total_matches else 0,
            "assists_per_match": round(total_assists / total_matches, 2) if total_matches else 0,
            "total_yellow_cards": total_yellow_cards,
            "total_red_cards": total_red_cards,
            "total_blue_cards": total_blue_cards,
            "winner_team": winner_team,
            "top_scorer": {
                "id": top_scorer_row.id_player,
                "nome": top_scorer_row.nome,
                "apelido": top_scorer_row.apelido,
                "goals": top_scorer_row.count
            } if top_scorer_row else None,
            "top_assister": {
                "id": top_assister_row.id_player,
                "nome": top_assister_row.nome,
                "apelido": top_assister_row.apelido,
                "assists": top_assister_row.count
            } if top_assister_row else None,
            "participants": participants,
        }