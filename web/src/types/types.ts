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

export interface RoundStatsItem {
	round_id: number;
	round_number: number;
	date?: string | null;
	season_id: number;
	season_name?: string | null;
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
	color?: string | null;
	round_id?: number;
	season_id?: number;
	season_name?: string | null;
	round_number?: number | null;
	players?: Array<{
		id_player: number;
		nome: string;
		apelido?: string | null;
		potes?: number | null;
		posicao?: string | null;
	}>;
}

export interface Award {
	id_award: number;
	event_type: string;
	round_id?: number;
	season_id?: number;
	season_name?: string | null;
	round_number?: number | null;
	date?: string | null;
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
	round_stats?: RoundStatsItem[];
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
	potes?: number | null;
	user_id?: number | null;
	is_associate?: boolean;
	is_guest?: boolean;
}

export interface Match {
	id_match: number;
	home_team_id: number;
	away_team_id: number;
	home_score: number;
	away_score: number;
}

export interface RoulettePrize {
	id_roulette_prize: number;
	name: string;
	description?: string | null;
	is_active: boolean;
	created_at?: string;
}

export interface RoundRouletteWinner {
	id_round_roulette?: number;
	round_id: number;
	player_id: number;
	prize_id?: number | null;
	roulette_number: number;
	player_name?: string | null;
	prize_name?: string | null;
}

export interface PlayerScore {
	id_player_score?: number;
	player_id: number;
	round_id: number;
	season_id: number;
	points_individual: number;
	points_team: number;
	points_collaboration?: number;
	extra_matches_won?: number;
	extra_matches_drawn?: number;
	extra_matches_lost?: number;
	total_points: number;
}

export interface PollOption {
	id_option: number;
	poll_id: number;
	title: string;
	description?: string | null;
	votes_count: number;
	percentage: number;
}

export interface Poll {
	id_poll: number;
	season_id: number;
	title: string;
	description?: string | null;
	is_active: boolean;
	multiple_choices: boolean;
	starts_at?: string | null;
	ends_at?: string | null;
	created_by_user_id?: number | null;
	created_at?: string | null;
	options: PollOption[];
	total_votes: number;
	has_voted: boolean;
	user_voted_option_ids: number[];
}

export interface RoundVoter {
	id_voter: number;
	round_id: number;
	user_id: number;
	user_name: string;
	user_email: string;
	has_voted: boolean;
	is_referee?: boolean;
	votes?: RoundVoteItem[];
}

export interface RoundVoteItem {
	award_type: string;
	player_id: number;
}

export interface RoundVoteCandidateCount {
	player_id: number;
	player_name: string;
	player_apelido?: string | null;
	votes_count: number;
	percentage: number;
}

export interface RoundCategoryTally {
	award_type: string;
	category_label: string;
	total_votes: number;
	candidates: RoundVoteCandidateCount[];
	leading_player_id?: number | null;
	leading_player_name?: string | null;
}

export interface RoundVotingStatus {
	round_id: number;
	is_voting_open: boolean;
	is_user_voter: boolean;
	total_voters_count: number;
	voted_voters_count: number;
	referee_user_id?: number | null;
	referee_name?: string | null;
	voters: RoundVoter[];
	user_votes: RoundVoteItem[];
	tallies: RoundCategoryTally[];
}

export interface RoundMedia {
	id_round_media: number;
	round_id: number;
	media_type: 'youtube' | 'instagram' | 'tiktok' | 'other' | string;
	url: string;
	title?: string | null;
	description?: string | null;
	created_at?: string;
	updated_at?: string;
}

