from sqlalchemy import Column, ForeignKey, Integer, Table
from app.db.base import Base

team_players = Table(
    "team_players",
    Base.metadata,
    Column("team_id", Integer, ForeignKey("teams.id_team"), primary_key=True),
    Column("player_id", Integer, ForeignKey("player.id_player"), primary_key=True)
)