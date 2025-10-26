from sqlalchemy import Table, Column, Integer, ForeignKey
from app.db.base import Base

award_teams = Table(
    "award_teams",
    Base.metadata,
    Column("award_id", Integer, ForeignKey("awards.id_award"), primary_key=True),
    Column("team_id", Integer, ForeignKey("teams.id_team"), primary_key=True)
)
