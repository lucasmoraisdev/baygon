from sqlalchemy import Table, Column, Integer, ForeignKey
from app.db.base import Base

award_players = Table(
    "award_players",
    Base.metadata,
    Column("award_id", Integer, ForeignKey("awards.id_award"), primary_key=True),
    Column("player_id", Integer, ForeignKey("players.id_player"), primary_key=True)
)
