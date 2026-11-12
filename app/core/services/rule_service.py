from datetime import datetime, timezone
from typing import Dict, List, Optional, Sequence, Set

from fastapi import HTTPException
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.enum.events_enum import EventContextEnum, EventTypeEnum
from app.db.models.award import Awards
from app.db.models.event_score_rule import EventScoreRule
from app.db.models.match import Match
from app.db.models.match_event import MatchEvent
from app.db.models.player_score import PlayerScore
from app.db.models.player_season_score import PlayerSeasonScore
from app.db.models.round import Round
from app.db.models.team import Teams
from app.db.repositories.event_score_rule_repository import EventScoreRuleRepository

DEFAULT_SEASON_RULES = [
    (EventTypeEnum.GOAL, EventContextEnum.MATCH, 1),
    (EventTypeEnum.ASSIST, EventContextEnum.MATCH, 1),
    (EventTypeEnum.HOME_WIN, EventContextEnum.MATCH, 3),
    (EventTypeEnum.AWAY_WIN, EventContextEnum.MATCH, 3),
    (EventTypeEnum.DRAW, EventContextEnum.MATCH, 1),
    (EventTypeEnum.OWN_GOAL, EventContextEnum.MATCH, -1),
    (EventTypeEnum.YELLOW_CARD, EventContextEnum.MATCH, -1),
    (EventTypeEnum.RED_CARD, EventContextEnum.MATCH, -3),
    (EventTypeEnum.BLUNDER, EventContextEnum.MATCH, 0),
    (EventTypeEnum.ROUND_WINNER, EventContextEnum.ROUND, 1),
    (EventTypeEnum.MVP, EventContextEnum.ROUND, 2),
    (EventTypeEnum.WORST_PLAYER, EventContextEnum.ROUND, -2),
]

INDIVIDUAL_EVENTS = {
    EventTypeEnum.GOAL,
    EventTypeEnum.ASSIST,
    EventTypeEnum.OWN_GOAL,
    EventTypeEnum.YELLOW_CARD,
    EventTypeEnum.RED_CARD,
    EventTypeEnum.BLUNDER,
    EventTypeEnum.MVP,
    EventTypeEnum.WORST_PLAYER,
    EventTypeEnum.BEST_GOAL,
    EventTypeEnum.BEST_DEFENSE,
    EventTypeEnum.TOAST,
    EventTypeEnum.UNBELIVABLE,
    EventTypeEnum.BEST_GOAL_KEEPER,
    EventTypeEnum.ROULETTE,
}


class RuleService:
    def __init__(self, repo: EventScoreRuleRepository):
        self.repo = repo

    async def create_rule(self, rule_data: dict) -> EventScoreRule:
        rule_obj = EventScoreRule(**rule_data)
        return await self.repo.create(event_score_rule=rule_obj)

    async def get_rule_by_id(self, rule_id: int) -> Optional[EventScoreRule]:
        return await self.repo.get_by_id(id_event_score_rule=rule_id)

    async def list_rules_by_season(self, season_id: int) -> Sequence[EventScoreRule]:
        return await self.repo.list_by_season(season_id)

    async def edit_rule(self, rule_id: int, rule_data: dict) -> Optional[EventScoreRule]:
        return await self.repo.update(id_event_score_rule=rule_id, updates=rule_data)

    async def delete_rule(self, rule_id: int) -> bool:
        return await self.repo.delete(id_event_score_rule=rule_id)

    async def seed_default_rules(self, season_id: int) -> List[EventScoreRule]:
        existing = await self.repo.list_by_season(season_id)
        existing_types = {r.event_type for r in existing}
        created: List[EventScoreRule] = []
        for event_type, context, points in DEFAULT_SEASON_RULES:
            if event_type in existing_types:
                continue
            rule = EventScoreRule(
                season_id=season_id,
                event_type=event_type,
                context=context,
                points=points,
            )
            created.append(await self.repo.create(event_score_rule=rule))
        return list(await self.repo.list_by_season(season_id))

    async def calculate_round_scores(self, round_id: int) -> Dict[str, int]:
        db: AsyncSession = self.repo.db
        round_obj = (
            await db.execute(
                select(Round).where(Round.id_round == round_id, Round.deleted_at.is_(None))
            )
        ).scalar_one_or_none()
        if not round_obj:
            raise HTTPException(status_code=404, detail="Rodada não encontrada.")

        rules = await self.repo.list_by_season(round_obj.season_id)
        rule_points: Dict[EventTypeEnum, int] = {r.event_type: r.points for r in rules}

        # Fallback default points if season has no rules configured yet
        if not rule_points:
            rule_points = {et: pts for et, _, pts in DEFAULT_SEASON_RULES}

        teams = (
            await db.execute(
                select(Teams)
                .options(selectinload(Teams.players))
                .where(Teams.round_id == round_id, Teams.deleted_at.is_(None))
            )
        ).scalars().all()

        team_players_map: Dict[int, List[int]] = {
            t.id_team: [p.id_player for p in t.players] for t in teams
        }

        matches = (
            await db.execute(
                select(Match).where(Match.round_id == round_id, Match.deleted_at.is_(None))
            )
        ).scalars().all()
        match_ids = [m.id_match for m in matches]

        player_ind: Dict[int, int] = {}
        player_team: Dict[int, int] = {}
        participating_players: Set[int] = set()

        for pids in team_players_map.values():
            for pid in pids:
                participating_players.add(pid)
                player_ind.setdefault(pid, 0)
                player_team.setdefault(pid, 0)

        # Team match outcome points
        for m in matches:
            if m.event_type == EventTypeEnum.HOME_WIN:
                pts = rule_points.get(EventTypeEnum.HOME_WIN, 3)
                for pid in team_players_map.get(m.home_team_id, []):
                    player_team[pid] = player_team.get(pid, 0) + pts
            elif m.event_type == EventTypeEnum.AWAY_WIN:
                pts = rule_points.get(EventTypeEnum.AWAY_WIN, 3)
                for pid in team_players_map.get(m.away_team_id, []):
                    player_team[pid] = player_team.get(pid, 0) + pts
            elif m.event_type == EventTypeEnum.DRAW:
                pts = rule_points.get(EventTypeEnum.DRAW, 1)
                for pid in team_players_map.get(m.home_team_id, []):
                    player_team[pid] = player_team.get(pid, 0) + pts
                for pid in team_players_map.get(m.away_team_id, []):
                    player_team[pid] = player_team.get(pid, 0) + pts

        # Match event individual points
        if match_ids:
            events = (
                await db.execute(
                    select(MatchEvent).where(
                        MatchEvent.match_id.in_(match_ids),
                        MatchEvent.deleted_at.is_(None),
                    )
                )
            ).scalars().all()
            for ev in events:
                participating_players.add(ev.player_id)
                pts = rule_points.get(ev.event_type, 0)
                if ev.event_type in INDIVIDUAL_EVENTS:
                    player_ind[ev.player_id] = player_ind.get(ev.player_id, 0) + pts
                else:
                    player_team[ev.player_id] = player_team.get(ev.player_id, 0) + pts

        # Awards points
        awards = (
            await db.execute(
                select(Awards)
                .options(selectinload(Awards.player), selectinload(Awards.teams))
                .where(Awards.round_id == round_id, Awards.deleted_at.is_(None))
            )
        ).scalars().all()
        for aw in awards:
            pts = rule_points.get(aw.event_type, 0)
            for pl in aw.player:
                participating_players.add(pl.id_player)
                player_ind[pl.id_player] = player_ind.get(pl.id_player, 0) + pts
            for tm in aw.teams:
                for pid in team_players_map.get(tm.id_team, []):
                    player_team[pid] = player_team.get(pid, 0) + pts

        # Upsert PlayerScore for this round
        now = datetime.now(timezone.utc)
        scores_updated = 0
        for pid in participating_players:
            ind_pts = player_ind.get(pid, 0)
            tm_pts = player_team.get(pid, 0)
            tot_pts = ind_pts + tm_pts

            existing_ps = (
                await db.execute(
                    select(PlayerScore).where(
                        PlayerScore.player_id == pid,
                        PlayerScore.round_id == round_id,
                        PlayerScore.deleted_at.is_(None),
                    )
                )
            ).scalars().first()
            if existing_ps:
                existing_ps.points_individual = ind_pts
                existing_ps.points_team = tm_pts
                existing_ps.total_points = tot_pts
                existing_ps.updated_at = now
            else:
                db.add(
                    PlayerScore(
                        player_id=pid,
                        round_id=round_id,
                        season_id=round_obj.season_id,
                        points_individual=ind_pts,
                        points_team=tm_pts,
                        total_points=tot_pts,
                    )
                )
            scores_updated += 1

        await db.flush()

        # Recalculate PlayerSeasonScore
        for pid in participating_players:
            season_total = int(
                (
                    await db.execute(
                        select(func.coalesce(func.sum(PlayerScore.total_points), 0)).where(
                            PlayerScore.player_id == pid,
                            PlayerScore.season_id == round_obj.season_id,
                            PlayerScore.deleted_at.is_(None),
                        )
                    )
                ).scalar()
                or 0
            )
            existing_ss = (
                await db.execute(
                    select(PlayerSeasonScore).where(
                        PlayerSeasonScore.player_id == pid,
                        PlayerSeasonScore.season_id == round_obj.season_id,
                        PlayerSeasonScore.deleted_at.is_(None),
                    )
                )
            ).scalars().first()
            if existing_ss:
                existing_ss.total_points = season_total
                existing_ss.updated_at = now
            else:
                db.add(
                    PlayerSeasonScore(
                        player_id=pid,
                        season_id=round_obj.season_id,
                        total_points=season_total,
                    )
                )

        await db.commit()
        return {
            "round_id": round_id,
            "season_id": round_obj.season_id,
            "players_scored": scores_updated,
        }
