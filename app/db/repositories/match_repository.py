from typing import Optional
from sqlalchemy import or_
from sqlalchemy.orm import Session

from app.db.models.match import Match
from app.db.models.match_event import MatchEvent

class MatchRepository:
    def __init__(self, db: Session):
        self.db = db
    
    def create(self, match: Match) -> Match:
        """
        Cria uma nova partida."""
        self.db.add(match)
        self.db.commit()
        self.db.refresh(match)
        return match
    
    def get_by_id(self, match_id: int) -> Match:
        """
        Busca uma partida pelo seu id.
        """
        return self.db.query(Match).filter(Match.id_match == match_id).first()
    
    def get_by_round(self, round_id: int) -> list[Match]:
        """
        Busca todas as partidas de um round.
        """
        return self.db.query(Match).filter(Match.round_id == round_id).all()

    def get_by_season(self, season_id: int) -> list[Match]:
        """
        Busca todas as partidas de uma temporada.
        """
        return self.db.query(Match).filter(Match.season_id == season_id).all()
    
    def get_by_team_and_round(self, team_id: int, round_id: int) -> list[Match]:
        """
        Busca todas as partidas de um time numa rodada.
        """
        return self.db.query(Match).filter(
            or_(
                Match.home_team_id == team_id,
                Match.away_team_id == team_id
            ),
            Match.round_id == round_id
        ).all()
    
    def update(self, match_id: int, updates: dict) -> Optional[Match]:
        """
        Atualiza uma partida.
        """
        match = self.get_by_id(match_id)
        if not match:
            return None
        
        for key, value in updates.items():
            if hasattr(match, key):
                setattr(match, key, value)
        
        self.db.commit()
        self.db.refresh(match)
        return match
    
    def delete(self, match_id: int) -> bool:
        """
        Deleta uma partida.
        """
        match = self.get_by_id(match_id)
        if not match:
            return False
        self.db.delete(match)
        self.db.commit()
        return True

    def add_events(self, match_event: MatchEvent) -> MatchEvent:
        """
        Adiciona um evento a uma partida.
        """
        self.db.add(match_event)
        self.db.commit()
        self.db.refresh(match_event)
        return match_event
    
    def list_events(self, match_id: int) -> list[MatchEvent]:
        """
        Lista todos os eventos de uma partida.
        """
        return self.db.query(MatchEvent).filter(MatchEvent.match_id == match_id).all()
    
    def edit_event(self, event_id: int, updates: dict) -> Optional[MatchEvent]:
        """
        Edita um evento de uma partida.
        """
        event = self.db.query(MatchEvent).filter(MatchEvent.id_event == event_id).first()
        if not event:
            return None
        for key, value in updates.items():
            if hasattr(event, key):
                setattr(event, key, value)
        self.db.commit()
        self.db.refresh(event)
        return event
    
    def delete_event(self, event_id: int) -> bool:
        """
        Deleta um evento de uma partida.
        """
        event = self.db.query(MatchEvent).filter(MatchEvent.id_event == event_id).first()
        if not event:
            return False
        self.db.delete(event)
        self.db.commit()
        return True