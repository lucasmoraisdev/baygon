export interface FantasySetting {
  id_fantasy_setting: number;
  season_id: number;
  is_enabled: boolean;
  initial_budget: number;
  min_player_price: number;
  max_price_variation: number;
  appreciation_factor: number;
}

export interface FantasySlotRule {
  id_slot_rule?: number;
  slot_type: 'POSITION' | 'POT';
  target_value: string;
  required_quantity: number;
}

export interface FantasyRoundConfig {
  id_round_config: number;
  round_id: number;
  total_slots: number;
  is_market_open: boolean;
  market_closes_at?: string | null;
  status: 'OPEN' | 'CLOSED' | 'FINALIZED';
  slot_rules: FantasySlotRule[];
}

export interface FantasyPlayer {
  id_fantasy_player: number;
  player_id: number;
  season_id: number;
  player_name: string;
  player_nickname?: string | null;
  position?: string | null;
  pot?: number | null;
  current_price: number;
  last_variation: number;
  status: 'PROBABLE' | 'DOUBT' | 'OUT';
  last_round_points: number;
  matches_played: number;
}

export interface FantasyTeam {
  id_fantasy_team: number;
  user_id: number;
  season_id: number;
  name: string;
  budget: number;
  total_wealth: number;
  total_points: number;
}

export interface FantasyLineupPlayer {
  id_lineup_player: number;
  player_id: number;
  player_name: string;
  player_nickname?: string | null;
  position?: string | null;
  slot_label: string;
  purchase_price: number;
  points_earned: number;
  price_variation: number;
}

export interface FantasyLineup {
  id_fantasy_lineup: number;
  fantasy_team_id: number;
  round_id: number;
  total_spent: number;
  cash_remaining: number;
  points_scored: number;
  wealth_variation: number;
  is_finalized: boolean;
  players: FantasyLineupPlayer[];
}

export interface FantasyRankingEntry {
  position: number;
  team_id: number;
  team_name: string;
  user_name: string;
  user_id: number;
  points: number;
  total_wealth: number;
  has_lineup: boolean;
}

export interface FantasyRoundRankingResponse {
  round_id: number;
  round_number: number;
  rankings: FantasyRankingEntry[];
}

export interface FantasySeasonRankingResponse {
  season_id: number;
  rankings: FantasyRankingEntry[];
}
