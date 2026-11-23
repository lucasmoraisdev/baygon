from enum import Enum
from typing import Optional, List, Dict, Any
from datetime import datetime
from pydantic import BaseModel, Field


class TournamentFormatEnum(str, Enum):
    INDIVIDUAL_POINTS = "individual_points"
    PONTOS_CORRIDOS = "pontos_corridos"
    MATA_MATA = "mata_mata"
    GRUPOS_E_MATA_MATA = "grupos_e_mata_mata"


class MatchStageEnum(str, Enum):
    REGULAR = "regular"
    GROUP = "group"
    ROUND_OF_16 = "round_of_16"
    QUARTERFINALS = "quarterfinals"
    SEMIFINALS = "semifinals"
    FINAL = "final"
    THIRD_PLACE = "third_place"


class TournamentCreate(BaseModel):
    name: str = Field(..., description="Nome do torneio ou campeonato")
    number: Optional[int] = Field(None, description="Número da edição/temporada (gerado se omitido)")
    tournament_format: TournamentFormatEnum = Field(
        default=TournamentFormatEnum.PONTOS_CORRIDOS,
        description="Formato do torneio: pontos_corridos, mata_mata, grupos_e_mata_mata ou individual_points",
    )
    has_legs: bool = Field(default=False, description="Jogos de ida e volta nas fases eliminatórias")
    teams_per_group: Optional[int] = Field(None, description="Quantidade de times por grupo (para torneios com grupos)")
    advancing_per_group: Optional[int] = Field(None, description="Quantidade de classificados por grupo")
    initial_date: Optional[datetime] = Field(default_factory=datetime.utcnow)


class TournamentTeamCreate(BaseModel):
    name: str = Field(..., description="Nome da equipe")
    color: Optional[str] = Field(None, description="Cor do uniforme da equipe")
    group_name: Optional[str] = Field(None, description="Grupo da equipe (ex: Grupo A, Grupo B)")


class TournamentRead(BaseModel):
    id_season: int
    name: Optional[str]
    number: int
    tournament_format: str
    has_legs: bool
    teams_per_group: Optional[int]
    advancing_per_group: Optional[int]
    is_active: bool
    initial_date: datetime
    end_date: Optional[datetime]

    class Config:
        from_attributes = True


class TeamStandingRow(BaseModel):
    position: int
    team_id: int
    team_name: str
    color: Optional[str] = None
    group_name: Optional[str] = None
    matches_played: int = 0
    points: int = 0
    wins: int = 0
    draws: int = 0
    losses: int = 0
    goals_for: int = 0
    goals_against: int = 0
    goal_difference: int = 0
    win_percentage: float = 0.0


class TournamentStandingsResponse(BaseModel):
    tournament_id: int
    tournament_name: Optional[str]
    tournament_format: str
    standings: List[TeamStandingRow]
    groups: Optional[Dict[str, List[TeamStandingRow]]] = None


class BracketMatchRead(BaseModel):
    id_match: int
    stage: str
    bracket_position: Optional[int] = None
    leg: int = 1
    home_team_id: int
    home_team_name: str
    away_team_id: int
    away_team_name: str
    score_home: int = 0
    score_away: int = 0
    penalties_home: int = 0
    penalties_away: int = 0
    is_finished: bool = False
    winner_team_id: Optional[int] = None


class TournamentBracketResponse(BaseModel):
    tournament_id: int
    tournament_name: Optional[str]
    has_legs: bool
    stages: Dict[str, List[BracketMatchRead]]


class MatchResultUpdate(BaseModel):
    score_home: int = Field(..., ge=0, description="Gols do mandante")
    score_away: int = Field(..., ge=0, description="Gols do visitante")
    penalties_home: Optional[int] = Field(default=0, ge=0, description="Pênaltis convertidos pelo mandante")
    penalties_away: Optional[int] = Field(default=0, ge=0, description="Pênaltis convertidos pelo visitante")
    is_finished: bool = Field(default=True, description="Indica se a partida está concluída")


class DrawBracketRequest(BaseModel):
    seed_mode: str = Field(default="random", description="Modo de sorteio: 'random' ou 'seeded'")


class TournamentRoundMatchRead(BaseModel):
    id_match: int
    home_team_id: int
    home_team_name: str
    home_team_color: Optional[str] = None
    away_team_id: int
    away_team_name: str
    away_team_color: Optional[str] = None
    score_home: int = 0
    score_away: int = 0
    penalties_home: int = 0
    penalties_away: int = 0
    stage: str
    bracket_position: Optional[int] = None
    leg: int = 1
    is_finished: bool = False
    winner_team_id: Optional[int] = None


class TournamentRoundRead(BaseModel):
    id_round: int
    round_number: int
    date: datetime
    location: Optional[str] = None
    matches: List[TournamentRoundMatchRead]
