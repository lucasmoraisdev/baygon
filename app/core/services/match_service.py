from typing import Optional, Sequence

from app.core.enum.events_enum import EventTypeEnum
from app.db.models.match import Match
from app.db.repositories.match_repository import MatchRepository


def _compute_outcome(score_home: int, score_away: int) -> EventTypeEnum:
    if score_home > score_away:
        return EventTypeEnum.HOME_WIN
    if score_away > score_home:
        return EventTypeEnum.AWAY_WIN
    return EventTypeEnum.DRAW


class MatchService:
    def __init__(self, repo: MatchRepository):
        self.repo = repo

    async def create_match(self, match_data: dict, fallback_user_id: Optional[int] = None) -> Match:
        score_home = match_data.get("score_home")
        if score_home is None:
            score_home = match_data.get("home_score") or 0

        score_away = match_data.get("score_away")
        if score_away is None:
            score_away = match_data.get("away_score") or 0

        filmed_by = match_data.get("filmed_by") or match_data.get("filmed_by_id") or fallback_user_id
        event_type = match_data.get("event_type") or _compute_outcome(score_home, score_away)

        match_obj = Match(
            round_id=match_data["round_id"],
            home_team_id=match_data["home_team_id"],
            away_team_id=match_data["away_team_id"],
            filmed_by=filmed_by,
            event_type=event_type,
            score_home=score_home,
            score_away=score_away,
        )
        return await self.repo.create(match=match_obj)

    async def get_match_by_id(self, match_id: int) -> Optional[Match]:
        return await self.repo.get_by_id(match_id)

    async def list_all_matches(self) -> Sequence[Match]:
        return await self.repo.get_all()

    async def list_matches_by_round(self, round_id: int) -> Sequence[Match]:
        return await self.repo.get_by_round(round_id)

    async def list_matches_by_season(self, season_id: int) -> Sequence[Match]:
        return await self.repo.get_by_season(season_id)

    async def edit_match(self, match_id: int, match_data: dict) -> Optional[Match]:
        existing = await self.repo.get_by_id(match_id)
        if not existing:
            return None

        updates: dict = {}
        for field in ("round_id", "home_team_id", "away_team_id"):
            if field in match_data and match_data[field] is not None:
                updates[field] = match_data[field]

        if "score_home" in match_data and match_data["score_home"] is not None:
            updates["score_home"] = match_data["score_home"]
        elif "home_score" in match_data and match_data["home_score"] is not None:
            updates["score_home"] = match_data["home_score"]

        if "score_away" in match_data and match_data["score_away"] is not None:
            updates["score_away"] = match_data["score_away"]
        elif "away_score" in match_data and match_data["away_score"] is not None:
            updates["score_away"] = match_data["away_score"]

        if "filmed_by" in match_data and match_data["filmed_by"] is not None:
            updates["filmed_by"] = match_data["filmed_by"]
        elif "filmed_by_id" in match_data and match_data["filmed_by_id"] is not None:
            updates["filmed_by"] = match_data["filmed_by_id"]

        new_home = updates.get("score_home", existing.score_home)
        new_away = updates.get("score_away", existing.score_away)
        updates["event_type"] = match_data.get("event_type") or _compute_outcome(new_home, new_away)

        return await self.repo.update(match_id=match_id, updates=updates)

    async def delete_match(self, match_id: int) -> bool:
        return await self.repo.delete(match_id=match_id)
