/* ─── Helpers ─── */
export const initials = (nome: string) =>
	nome
		.split(' ')
		.map((w) => w[0])
		.slice(0, 2)
		.join('')
		.toUpperCase();

export const POS_LABEL: Record<string, string> = {
	goleiro: 'GK',
	pivo: 'PIV',
	ala: 'ALA',
	fixo: 'FIX',
};

export const DEFAULT_ROUND = {
	round_number: '',
	location: 'Campo Principal',
	referee: 'A definir',
	date: new Date().toISOString().split('T')[0],
};

export const DEFAULT_MATCH = {
	round_id: '',
	home_team_id: '',
	away_team_id: '',
	home_score: 0,
	away_score: 0,
};

export const COLOR_MAP: Record<string, string> = {
	green: 'text-green-400',
	red: 'text-red-400',
	yellow: 'text-yellow-400',
	blue: 'text-blue-400',
	purple: 'text-purple-400',
	orange: 'text-orange-400',
};

export const STAT_VARIANT: Record<string, string> = {
	highlight: 'bg-primary/10 border-primary/30',
	gold: 'bg-yellow-500/10 border-yellow-500/30',
	green: 'bg-green-500/10 border-green-500/30',
	red: 'bg-red-500/10 border-red-500/30',
};
