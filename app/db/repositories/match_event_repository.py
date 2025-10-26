from typing import Optional
from sqlalchemy import or_
from sqlalchemy.orm import Session

from app.db.models.match import Match
from app.db.models.match_event import MatchEvent

class MatchEventRepository:
    def __init__(self, db: Session):
        self.db = db
    