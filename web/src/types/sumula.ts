export interface SumulaGoalAssistItem {
  play_id: number;
  scorer_name: string;
  scorer_player_id: number | null;
  assist_name: string | null;
  assist_player_id: number | null;
}

export interface SumulaMatchItem {
  match_number: number;
  home_team_name: string;
  away_team_name: string;
  home_team_slot: number | null;
  away_team_slot: number | null;
  score_home: number;
  score_away: number;
  goals: SumulaGoalAssistItem[];
  camera_name: string | null;
  camera_player_id: number | null;
}

export interface SumulaPlayerRow {
  row_index: number;
  pote: number | null;
  is_extra: boolean;
  raw_name: string;
  matched_player_id: number | null;
  matched_player_name: string | null;
  match_confidence: number;
  will_create_player: boolean;
  goals: number;
  assists: number;
  wins: number;
  losses: number;
  draws: number;
  raw_total: string | null;
  base_points: number;
  extra_points: number;
  total_points: number;
}

export interface SumulaTeamBlock {
  slot_index: number;
  team_name: string | null;
  is_valid_team: boolean;
  is_extra_only: boolean;
  is_champion: boolean;
  players: SumulaPlayerRow[];
}

export interface SumulaOuroItem {
  raw_name: string;
  player_id: number | null;
  player_name: string | null;
  count: number;
}

export interface SumulaHeader {
  date: string | null;
  baba_number: number | null;
  total_goals: number | null;
  total_assists: number | null;
  location: string | null;
  referee: string | null;
}

export interface SumulaPreviewResponse {
  provider_used: string;
  season_id: number;
  round_number: number;
  round_exists: boolean;
  header: SumulaHeader;
  teams: SumulaTeamBlock[];
  matches: SumulaMatchItem[];
  ouros: SumulaOuroItem[];
  warnings: string[];
}

export interface SumulaImportResponse {
  round_id: number;
  season_id: number;
  round_number: number;
  date: string;
  location: string;
  referee: string;
  players_created: number;
  players_matched: number;
  teams_created: number;
  matches_created: number;
  match_events_created: number;
  ouros_registered: number;
  player_scores_created: number;
  player_season_scores_updated: number;
  round_winner_team_id: number | null;
  warnings: string[];
}
