from datetime import datetime
from typing import Dict, List, Optional
from pydantic import BaseModel, Field


class SumulaGoalAssistItem(BaseModel):
    """Par Gol + Assistência em uma jogada da partida (colunas GOL(1..5) e ASSIST)."""
    play_id: int = Field(..., ge=1)
    scorer_name: str
    scorer_player_id: Optional[int] = None
    assist_name: Optional[str] = None
    assist_player_id: Optional[int] = None


class SumulaMatchItem(BaseModel):
    """Linha da tabela principal de partidas da súmula."""
    match_number: int = Field(..., ge=1)
    home_team_name: str
    away_team_name: str
    home_team_slot: Optional[int] = None
    away_team_slot: Optional[int] = None
    score_home: int = Field(0, ge=0)
    score_away: int = Field(0, ge=0)
    goals: List[SumulaGoalAssistItem] = Field(default_factory=list)
    camera_name: Optional[str] = None
    camera_player_id: Optional[int] = None


class SumulaPlayerRow(BaseModel):
    """Linha de jogador em uma das 6 tabelas de time/resumo da súmula."""
    row_index: int = Field(..., ge=1, le=6)
    pote: Optional[int] = Field(None, ge=1, le=5)
    is_extra: bool = False
    raw_name: str
    matched_player_id: Optional[int] = None
    matched_player_name: Optional[str] = None
    match_confidence: float = 0.0
    will_create_player: bool = False
    goals: int = Field(0, ge=0)
    assists: int = Field(0, ge=0)
    wins: int = Field(0, ge=0)
    losses: int = Field(0, ge=0)
    draws: int = Field(0, ge=0)
    raw_total: Optional[str] = None
    base_points: int = 0
    extra_points: int = 0
    total_points: int = 0


class SumulaTeamBlock(BaseModel):
    """Bloco de uma das 6 tabelas menores da súmula (Time 1..6)."""
    slot_index: int = Field(..., ge=1, le=6)
    team_name: Optional[str] = None
    is_valid_team: bool = True
    is_extra_only: bool = False
    is_champion: bool = False
    players: List[SumulaPlayerRow] = Field(default_factory=list)


class SumulaOuroItem(BaseModel):
    """Registro de ouro manuscrito no rodapé da súmula."""
    raw_name: str
    player_id: Optional[int] = None
    player_name: Optional[str] = None
    count: int = Field(1, ge=1)


class SumulaHeader(BaseModel):
    """Cabeçalho superior da súmula."""
    date: Optional[str] = None
    baba_number: Optional[int] = None
    total_goals: Optional[int] = None
    total_assists: Optional[int] = None
    location: Optional[str] = None
    referee: Optional[str] = None


class SumulaParsedData(BaseModel):
    """Estrutura completa extraída da imagem da súmula."""
    provider_used: str
    header: SumulaHeader
    teams: List[SumulaTeamBlock] = Field(default_factory=list)
    matches: List[SumulaMatchItem] = Field(default_factory=list)
    ouros: List[SumulaOuroItem] = Field(default_factory=list)
    warnings: List[str] = Field(default_factory=list)


class SumulaPreviewResponse(SumulaParsedData):
    """Resposta do endpoint de preview antes da persistência."""
    season_id: int
    round_number: int
    round_exists: bool = False


class SumulaImportRequest(BaseModel):
    """Payload de confirmação/importação estruturada da súmula para o banco."""
    season_id: int
    round_number: Optional[int] = None
    overwrite_existing_round: bool = False
    create_missing_players: bool = True
    update_player_potes: bool = True
    register_round_winner_award: bool = True
    extra_points_overrides: Dict[str, int] = Field(default_factory=dict)
    header: SumulaHeader
    teams: List[SumulaTeamBlock] = Field(default_factory=list)
    matches: List[SumulaMatchItem] = Field(default_factory=list)
    ouros: List[SumulaOuroItem] = Field(default_factory=list)


class SumulaImportResponse(BaseModel):
    """Resumo completo das entidades criadas/atualizadas após importação da súmula."""
    round_id: int
    season_id: int
    round_number: int
    date: datetime
    location: str
    referee: str
    players_created: int
    players_matched: int
    teams_created: int
    matches_created: int
    match_events_created: int
    ouros_registered: int
    player_scores_created: int
    player_season_scores_updated: int
    round_winner_team_id: Optional[int] = None
    warnings: List[str] = Field(default_factory=list)
    parsed_data: Optional[SumulaParsedData] = None
