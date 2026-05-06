export interface Stats {
	total_matches: number;
	total_wins: number;
	total_losses: number;
	total_draws: number;
	total_goals: number;
	total_assists: number;
	total_awards: number;
	total_seasons: number;
}

export interface SeasonStats {
	season_id: number;
	season_name: string;
	total_matches: number;
	total_wins: number;
	total_losses: number;
	total_draws: number;
	total_goals: number;
	total_assists: number;
	total_points: number;
}

export interface Team {
	id_team: number;
	name: string;
}

export interface Award {
	id_award: number;
	event_type: string;
}

export interface PlayerProfile {
	id_player: number;
	nome: string;
	apelido: string;
	email: string;
	telefone: string;
	posicao: string;
	pe: string;
	potes: number;
	user_id: number;
	is_associate: boolean;
	is_guest: boolean;
	created_at: string;
	updated_at: string;
	stats: Stats;
	season_stats: SeasonStats[];
	teams: Team[];
	awards: Award[];
}

export interface Round {
	id_round: number;
	round_number: number;
	date: string;
	location: string;
	referee: string;
	initial_time: string | null;
	end_time: string | null;
	season_id: number;
}

export interface RoundStats {
	total_matches: number;
	total_goals: number;
	total_assists: number;
	goals_per_match: number;
	assists_per_match: number;
	total_yellow_cards: number;
	total_red_cards: number;
	total_blue_cards: number;
	winner_team: { id: number; name: string; wins: number } | null;
	top_scorer: {
		id: number;
		nome: string;
		apelido: string | null;
		goals: number;
	} | null;
	top_assister: {
		id: number;
		nome: string;
		apelido: string | null;
		assists: number;
	} | null;
	participants: {
		id: number;
		nome: string;
		apelido: string | null;
		posicao: string | null;
	}[];
}

export interface Season {
	id_season: number;
	number: number;
	is_active: boolean;
}

export interface Player {
	id_player: number;
	nome: string;
	apelido: string | null;
	posicao: string | null;
}

export interface Match {
	id_match: number;
	home_team_id: number;
	away_team_id: number;
	home_score: number;
	away_score: number;
}
