from typing import Optional, Sequence
from app.db.models.event_score_rule import EventScoreRule
from app.db.repositories.event_score_rule_repository import EventScoreRuleRepository

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
