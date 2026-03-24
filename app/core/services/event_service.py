from typing import Optional, Sequence
from app.db.models.match_event import MatchEvent
from app.db.repositories.match_event_repository import MatchEventRepository

class EventService:
    def __init__(self, repo: MatchEventRepository):
        self.repo = repo

    async def create_event(self, event_data: dict) -> MatchEvent:
        event_obj = MatchEvent(**event_data)
        return await self.repo.add_events(match_event=event_obj)
    
    async def list_events_by_match(self, match_id: int) -> Sequence[MatchEvent]:
        return await self.repo.list_events_from_match_id(match_id)
    
    async def get_event_by_id(self, event_id: int) -> Optional[MatchEvent]:
        return await self.repo.get_event_by_id(event_id)
    
    async def edit_event(self, event_id: int, event_data: dict) -> Optional[MatchEvent]:
        return await self.repo.edit_event(event_id=event_id, updates=event_data)
        
    async def delete_event(self, event_id: int) -> bool:
        return await self.repo.delete_event(event_id=event_id)
