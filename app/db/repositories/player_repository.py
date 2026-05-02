from datetime import datetime, timezone
from typing import Optional, Sequence, Dict, Any
from sqlalchemy import or_, select, and_, func, join, distinct, Integer
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.db.models.player import Player
from app.db.models.match_event import MatchEvent
from app.db.models.match import Match
from app.db.models.season import Seasons
from app.db.models.round import Round
from app.core.enum.events_enum import EventTypeEnum

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
        Lista todos os jogadores.
        """
        stmt = select(Player)
        result = await self.db.execute(stmt)
        return result.scalars().all()
    
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

    async def get_player_stats(self, player_id: int) -> Dict[str, Any]:
        """
        Obtém estatísticas gerais do jogador.
        Retorna: total de partidas, vitórias, derrotas, empates, gols, assistências, prêmios
        """
        # Contar gols
        goals_stmt = select(func.count(MatchEvent.id_event)).where(
            and_(
                MatchEvent.player_id == player_id,
                MatchEvent.event_type == EventTypeEnum.GOAL
            )
        )
        goals_result = await self.db.execute(goals_stmt)
        total_goals = goals_result.scalar() or 0

        # Contar assistências
        assists_stmt = select(func.count(MatchEvent.id_event)).where(
            and_(
                MatchEvent.player_id == player_id,
                MatchEvent.event_type == EventTypeEnum.ASSIST
            )
        )
        assists_result = await self.db.execute(assists_stmt)
        total_assists = assists_result.scalar() or 0

        # Contar vitórias do jogador (via times que jogou)
        # Primeiro, obter todos os matches que o jogador participou
        matches_stmt = select(MatchEvent.match_id).where(
            MatchEvent.player_id == player_id
        ).distinct()
        matches_result = await self.db.execute(matches_stmt)
        player_match_ids = [row[0] for row in matches_result.fetchall()]

        total_matches = len(player_match_ids)
        
        if player_match_ids:
            # Contar vitórias (HOME_WIN ou AWAY_WIN que ocorreram nos matches do jogador)
            wins_stmt = select(func.count(MatchEvent.id_event)).where(
                and_(
                    MatchEvent.match_id.in_(player_match_ids),
                    MatchEvent.event_type.in_([EventTypeEnum.HOME_WIN, EventTypeEnum.AWAY_WIN])
                )
            )
            wins_result = await self.db.execute(wins_stmt)
            total_wins = wins_result.scalar() or 0

            # Contar empates
            draws_stmt = select(func.count(MatchEvent.id_event)).where(
                and_(
                    MatchEvent.match_id.in_(player_match_ids),
                    MatchEvent.event_type == EventTypeEnum.DRAW
                )
            )
            draws_result = await self.db.execute(draws_stmt)
            total_draws = draws_result.scalar() or 0
            
            total_losses = total_matches - total_wins - total_draws
        else:
            total_wins = 0
            total_losses = 0
            total_draws = 0

        # Contar prêmios (eventos de premiação do tipo award)
        awards_stmt = select(func.count(MatchEvent.id_event)).where(
            and_(
                MatchEvent.player_id == player_id,
                MatchEvent.event_type.in_([
                    EventTypeEnum.ROUND_WINNER,
                    EventTypeEnum.MVP,
                    EventTypeEnum.WORST_PLAYER,
                    EventTypeEnum.BEST_GOAL,
                    EventTypeEnum.BEST_DEFENSE,
                    EventTypeEnum.TOAST,
                    EventTypeEnum.UNBELIVABLE,
                    EventTypeEnum.BEST_GOAL_KEEPER,
                    EventTypeEnum.ROULETTE
                ])
            )
        )
        awards_result = await self.db.execute(awards_stmt)
        total_awards = awards_result.scalar() or 0

        # Contar temporadas (corrigido: Match -> Round -> Seasons)
        try:
            seasons_stmt = select(func.count(Seasons.id_season.distinct())).select_from(MatchEvent)
            seasons_stmt = seasons_stmt.join(Match, Match.id_match == MatchEvent.match_id)
            seasons_stmt = seasons_stmt.join(Round, Round.id_round == Match.round_id)
            seasons_stmt = seasons_stmt.join(Seasons, Seasons.id_season == Round.season_id)
            seasons_stmt = seasons_stmt.where(MatchEvent.player_id == player_id)
            seasons_result = await self.db.execute(seasons_stmt)
            total_seasons = seasons_result.scalar() or 0
        except Exception as e:
            total_seasons = 0

        return {
            "total_matches": total_matches,
            "total_wins": total_wins,
            "total_losses": total_losses,
            "total_draws": total_draws,
            "total_goals": total_goals,
            "total_assists": total_assists,
            "total_awards": total_awards,
            "total_seasons": total_seasons,
        }

    async def get_player_season_stats(self, player_id: int) -> Sequence[Dict[str, Any]]:
        """
        Obtém estatísticas do jogador por temporada.
        """
        # Obter todas as matches que o jogador participou, agrupado por temporada
        stmt = select(
            Seasons.id_season,
            Seasons.number,
            func.count(distinct(Match.id_match)).label("total_matches"),
            func.sum(
                func.cast(
                    MatchEvent.event_type == EventTypeEnum.GOAL, 
                    type_=Integer
                )
            ).label("total_goals"),
            func.sum(
                func.cast(
                    MatchEvent.event_type == EventTypeEnum.ASSIST,
                    type_=Integer
                )
            ).label("total_assists"),
        ).join(
            Match, MatchEvent.match_id == Match.id_match
        ).join(
            Round, Round.id_round == Match.round_id
        ).join(
            Seasons, Seasons.id_season == Round.season_id
        ).where(
            MatchEvent.player_id == player_id
        ).group_by(
            Seasons.id_season, Seasons.number
        )

        result = await self.db.execute(stmt)
        rows = result.fetchall()

        season_stats = []
        for row in rows:
            season_stats.append({
                "season_id": row.id_season,
                "season_number": row.number,
                "total_matches": row.total_matches or 0,
                "total_wins": 0,  # Will calculate from events
                "total_losses": 0,  # Will calculate from events
                "total_draws": 0,  # Will calculate from events
                "total_goals": row.total_goals or 0,
                "total_assists": row.total_assists or 0,
                "total_points": 0,
            })

        return season_stats