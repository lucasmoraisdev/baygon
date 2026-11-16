export interface TeamColorDefinition {
	id: string;
	label: string;
	hex: string;
	dotBg: string;
	badgeBg: string;
	badgeBorder: string;
	badgeText: string;
	goalBg: string;
	goalBorder: string;
	goalText: string;
}

export const TEAM_COLORS: TeamColorDefinition[] = [
	{
		id: 'blue',
		label: 'Azul',
		hex: '#2563eb',
		dotBg: 'bg-blue-500',
		badgeBg: 'bg-blue-500/15',
		badgeBorder: 'border-blue-500/35',
		badgeText: 'text-blue-300',
		goalBg: 'bg-blue-500/15',
		goalBorder: 'border-blue-500/40',
		goalText: 'text-blue-100',
	},
	{
		id: 'red',
		label: 'Vermelho',
		hex: '#dc2626',
		dotBg: 'bg-red-500',
		badgeBg: 'bg-red-500/15',
		badgeBorder: 'border-red-500/35',
		badgeText: 'text-red-300',
		goalBg: 'bg-red-500/15',
		goalBorder: 'border-red-500/40',
		goalText: 'text-red-100',
	},
	{
		id: 'yellow',
		label: 'Amarelo',
		hex: '#eab308',
		dotBg: 'bg-yellow-400',
		badgeBg: 'bg-yellow-500/15',
		badgeBorder: 'border-yellow-500/35',
		badgeText: 'text-yellow-300',
		goalBg: 'bg-yellow-500/15',
		goalBorder: 'border-yellow-500/40',
		goalText: 'text-yellow-100',
	},
	{
		id: 'green',
		label: 'Verde',
		hex: '#16a34a',
		dotBg: 'bg-emerald-500',
		badgeBg: 'bg-emerald-500/15',
		badgeBorder: 'border-emerald-500/35',
		badgeText: 'text-emerald-300',
		goalBg: 'bg-emerald-500/15',
		goalBorder: 'border-emerald-500/40',
		goalText: 'text-emerald-100',
	},
	{
		id: 'orange',
		label: 'Laranja',
		hex: '#ea580c',
		dotBg: 'bg-orange-500',
		badgeBg: 'bg-orange-500/15',
		badgeBorder: 'border-orange-500/35',
		badgeText: 'text-orange-300',
		goalBg: 'bg-orange-500/15',
		goalBorder: 'border-orange-500/40',
		goalText: 'text-orange-100',
	},
	{
		id: 'black',
		label: 'Preto',
		hex: '#1e293b',
		dotBg: 'bg-slate-700',
		badgeBg: 'bg-slate-700/30',
		badgeBorder: 'border-slate-500/35',
		badgeText: 'text-slate-200',
		goalBg: 'bg-slate-700/25',
		goalBorder: 'border-slate-500/40',
		goalText: 'text-slate-100',
	},
	{
		id: 'white',
		label: 'Branco',
		hex: '#f8fafc',
		dotBg: 'bg-slate-200',
		badgeBg: 'bg-white/10',
		badgeBorder: 'border-white/30',
		badgeText: 'text-white',
		goalBg: 'bg-white/15',
		goalBorder: 'border-white/40',
		goalText: 'text-white',
	},
	{
		id: 'purple',
		label: 'Roxo',
		hex: '#9333ea',
		dotBg: 'bg-purple-500',
		badgeBg: 'bg-purple-500/15',
		badgeBorder: 'border-purple-500/35',
		badgeText: 'text-purple-300',
		goalBg: 'bg-purple-500/15',
		goalBorder: 'border-purple-500/40',
		goalText: 'text-purple-100',
	},
	{
		id: 'pink',
		label: 'Rosa',
		hex: '#ec4899',
		dotBg: 'bg-pink-500',
		badgeBg: 'bg-pink-500/15',
		badgeBorder: 'border-pink-500/35',
		badgeText: 'text-pink-300',
		goalBg: 'bg-pink-500/15',
		goalBorder: 'border-pink-500/40',
		goalText: 'text-pink-100',
	},
	{
		id: 'gray',
		label: 'Cinza',
		hex: '#64748b',
		dotBg: 'bg-slate-500',
		badgeBg: 'bg-slate-500/15',
		badgeBorder: 'border-slate-500/35',
		badgeText: 'text-slate-300',
		goalBg: 'bg-slate-500/15',
		goalBorder: 'border-slate-500/40',
		goalText: 'text-slate-100',
	},
];

const COLOR_MAP = new Map<string, TeamColorDefinition>();
for (const c of TEAM_COLORS) {
	COLOR_MAP.set(c.id.toLowerCase(), c);
	COLOR_MAP.set(c.label.toLowerCase(), c);
	COLOR_MAP.set(c.hex.toLowerCase(), c);
}

export function getTeamColor(
	colorVal?: string | null,
	fallbackIndex: number = 0,
): TeamColorDefinition {
	if (colorVal) {
		const found = COLOR_MAP.get(colorVal.toLowerCase().trim());
		if (found) return found;

		// Caso tenha sido gravado como hex customizado
		if (colorVal.startsWith('#')) {
			return {
				id: colorVal,
				label: 'Colete',
				hex: colorVal,
				dotBg: '',
				badgeBg: 'bg-white/[0.04]',
				badgeBorder: 'border-white/20',
				badgeText: 'text-white',
				goalBg: 'bg-white/[0.06]',
				goalBorder: 'border-white/25',
				goalText: 'text-white',
			};
		}
	}

	const idx = Math.abs(fallbackIndex) % TEAM_COLORS.length;
	return TEAM_COLORS[idx];
}
