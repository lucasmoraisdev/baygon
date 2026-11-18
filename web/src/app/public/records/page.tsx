'use client';

import React, { useState, useMemo } from 'react';
import { useQueries, useQuery } from '@tanstack/react-query';
import { fetchAPI } from '@/lib/api';
import { SeasonSelector, Season } from '@/components/SeasonSelector';
import { SearchableSelect } from '@/components/SearchableSelect';
import { Loading } from '@/components/Loading';
import {
	Award,
	Trophy,
	Sparkles,
	Gift,
	Flame,
	ShieldAlert,
	Goal,
	ShieldCheck,
	Zap,
	HelpCircle,
	Smile,
	Frown,
} from 'lucide-react';

interface AwardItem {
	id_award: number;
	round_id: number;
	event_type: string;
	players: { id_player: number; nome: string; apelido?: string | null }[];
	teams: { id_team: number; name: string }[];
}

const AWARD_CONFIG: Record<
	string,
	{ label: string; icon: string; color: string; desc: string }
> = {
	bola_cheia: {
		label: 'Bola Cheia (MVP)',
		icon: '🌟',
		color: 'from-amber-500/20 to-amber-500/5 text-amber-500 border-amber-500/30',
		desc: 'Melhor jogador da rodada eleito pela galera',
	},
	bola_murcha: {
		label: 'Bola Murcha',
		icon: '💩',
		color: 'from-slate-500/20 to-slate-500/5 text-slate-500 border-slate-500/30',
		desc: 'O lance ou atuação mais desastrosa do baba',
	},
	gol_rodada: {
		label: 'Gol da Rodada',
		icon: '⚽',
		color: 'from-emerald-500/20 to-emerald-500/5 text-emerald-500 border-emerald-500/30',
		desc: 'A pintura da rodada (Prêmio Puskás do baba)',
	},
	defesa_rodada: {
		label: 'Defesa da Rodada',
		icon: '🧤',
		color: 'from-blue-500/20 to-blue-500/5 text-blue-500 border-blue-500/30',
		desc: 'O milagre do goleiro que garantiu o resultado',
	},
	drible_rodada: {
		label: 'Drible da Rodada',
		icon: '🌀',
		color: 'from-purple-500/20 to-purple-500/5 text-purple-500 border-purple-500/30',
		desc: 'O drible desconcertante que levantou a arquibancada',
	},
	inacreditavel: {
		label: 'Inacreditável',
		icon: '😱',
		color: 'from-rose-500/20 to-rose-500/5 text-rose-500 border-rose-500/30',
		desc: 'O gol perdido sem goleiro ou o lance inacreditável',
	},
	goleiro_menos_vazado: {
		label: 'Goleiro Menos Vazado',
		icon: '🥅',
		color: 'from-cyan-500/20 to-cyan-500/5 text-cyan-500 border-cyan-500/30',
		desc: 'O paredão que sofreu menos gols na rodada',
	},
	time_vencedor_rodada: {
		label: 'Time Vencedor da Rodada',
		icon: '🏆',
		color: 'from-amber-400/20 to-amber-400/5 text-amber-500 border-amber-400/30',
		desc: 'Equipe que conquistou mais vitórias na rodada',
	},
};

export default function PublicRecordsPage() {
	const [selectedSeasonOverride, setSelectedSeasonOverride] = useState<string>('');
	const [selectedRoundOverride, setSelectedRoundOverride] = useState<string>('');

	// Busca de temporadas e temporada atual
	const [seasonsQuery, currentSeasonQuery] = useQueries({
		queries: [
			{
				queryKey: ['public-seasons'],
				queryFn: () => fetchAPI('/seasons/').catch(() => []),
			},
			{
				queryKey: ['public-seasons', 'current'],
				queryFn: async () => {
					try {
						return await fetchAPI('/seasons/current');
					} catch {
						return null;
					}
				},
			},
		],
	});

	const seasons: Season[] = seasonsQuery.data ?? [];
	const currentSeason = currentSeasonQuery.data;

	const selectedSeason =
		selectedSeasonOverride ||
		currentSeason?.id_season?.toString() ||
		seasons[0]?.id_season?.toString() ||
		'';

	// Busca de rodadas da temporada
	const roundsQuery = useQuery<any[]>({
		queryKey: ['public-rounds', selectedSeason],
		queryFn: () =>
			fetchAPI(
				selectedSeason ? `/rounds/season/${selectedSeason}` : '/rounds/',
			).catch(() => []),
		enabled: Boolean(selectedSeason),
	});

	// Busca de ranking para recordes gerais da temporada
	const rankingQuery = useQuery<any>({
		queryKey: ['public-ranking-records', selectedSeason],
		queryFn: () =>
			fetchAPI(
				selectedSeason
					? `/rankings/association?season_id=${selectedSeason}`
					: '/rankings/association',
			).catch(() => null),
		enabled: Boolean(selectedSeason),
	});

	const rounds = useMemo(() => {
		const list = roundsQuery.data ?? [];
		return [...list].sort((a, b) => b.round_number - a.round_number);
	}, [roundsQuery.data]);

	const selectedRoundId =
		selectedRoundOverride || rounds[0]?.id_round?.toString() || '';

	// Busca de prêmios da rodada e vencedores da roleta
	const [awardsQuery, rouletteWinnersQuery] = useQueries({
		queries: [
			{
				queryKey: ['public-awards', selectedRoundId],
				queryFn: () =>
					fetchAPI(`/awards/round/${selectedRoundId}`).catch(() => []),
				enabled: Boolean(selectedRoundId),
			},
			{
				queryKey: ['public-roulette-winners', selectedRoundId],
				queryFn: () =>
					fetchAPI(`/roulette-prizes/round/${selectedRoundId}`).catch(() => []),
				enabled: Boolean(selectedRoundId),
			},
		],
	});

	const awards: AwardItem[] = awardsQuery.data ?? [];
	const rouletteWinners: any[] = rouletteWinnersQuery.data ?? [];
	const rankingRows: any[] = rankingQuery.data?.rows ?? [];

	const roundOptions = useMemo(() => {
		return rounds.map((r) => {
			const isOngoing = !r.end_time;
			return {
				value: String(r.id_round),
				label: `Rodada ${r.round_number}${isOngoing ? ' (Em andamento)' : ''}`,
				badge: isOngoing ? 'Em andamento' : 'Concluída',
				badgeVariant: (isOngoing ? 'success' : 'default') as 'success' | 'default',
			};
		});
	}, [rounds]);

	// Recordes da temporada
	const seasonLeaders = useMemo(() => {
		if (!rankingRows.length) return null;

		const topPoints = [...rankingRows].sort(
			(a, b) => b.ranking_geral - a.ranking_geral,
		)[0];
		const topScorer = [...rankingRows].sort(
			(a, b) => b.artilharia - a.artilharia,
		)[0];
		const topAssister = [...rankingRows].sort(
			(a, b) => b.assistencias - a.assistencias,
		)[0];
		const topCleanSheets = [...rankingRows].sort(
			(a, b) => b.clean_sheets - a.clean_sheets,
		)[0];
		const topWins = [...rankingRows].sort(
			(a, b) => b.babas_conquistados - a.babas_conquistados,
		)[0];
		const topMvp = [...rankingRows].sort(
			(a, b) => b.bola_cheia - a.bola_cheia,
		)[0];

		return {
			topPoints,
			topScorer,
			topAssister,
			topCleanSheets,
			topWins,
			topMvp,
		};
	}, [rankingRows]);

	// Mapeamento dos prêmios da rodada por event_type
	const awardsByType = useMemo(() => {
		const map = new Map<string, AwardItem>();
		awards.forEach((a) => map.set(a.event_type, a));
		return map;
	}, [awards]);

	return (
		<div className="space-y-6">
			{/* Top Bar */}
			<div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-border">
				<div>
					<div className="flex items-center gap-2">
						<span className="p-2 rounded-xl bg-amber-500/10 text-amber-500 border border-amber-500/20">
							<Award size={22} />
						</span>
						<div>
							<h1 className="text-xl sm:text-2xl font-bold text-main tracking-tight">
								Recordes & Premiações
							</h1>
							<p className="text-xs sm:text-sm text-muted">
								Destaques individuais, Bola Cheia, Bola Murcha, Roleta e marcas históricas
							</p>
						</div>
					</div>
				</div>

				<div className="flex items-center sm:justify-end shrink-0 w-full sm:w-auto">
					<SeasonSelector
						seasons={seasons}
						selectedSeasonId={selectedSeason}
						onSelectSeason={(s) => setSelectedSeasonOverride(String(s.id_season))}
						isLoading={seasonsQuery.isLoading}
						className="w-full sm:w-auto sm:min-w-[220px]"
					/>
				</div>
			</div>

			{/* Recordes da Temporada Selecionada */}
			{seasonLeaders && (
				<div className="space-y-3">
					<div className="flex items-center gap-2">
						<Sparkles size={18} className="text-amber-500" />
						<h2 className="text-sm sm:text-base font-bold text-main uppercase tracking-wider">
							Líderes de Recordes na Temporada
						</h2>
					</div>

					<div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
						{/* Maior Pontuador */}
						<div className="bg-surface border border-border rounded-xl p-3.5 flex flex-col justify-between shadow-xs">
							<span className="text-[10px] font-bold uppercase tracking-wider text-amber-500 flex items-center gap-1">
								👑 Maior Pontuador
							</span>
							<div className="my-2">
								<strong className="text-sm font-bold text-main block truncate" title={seasonLeaders.topPoints?.boleiro}>
									{seasonLeaders.topPoints?.boleiro || '—'}
								</strong>
								<span className="text-xs text-muted">
									{seasonLeaders.topPoints?.posicao || 'Boleiro'}
								</span>
							</div>
							<span className="text-lg font-black text-amber-500">
								{seasonLeaders.topPoints?.ranking_geral} <span className="text-xs font-normal text-muted">pts</span>
							</span>
						</div>

						{/* Artilheiro */}
						<div className="bg-surface border border-border rounded-xl p-3.5 flex flex-col justify-between shadow-xs">
							<span className="text-[10px] font-bold uppercase tracking-wider text-emerald-500 flex items-center gap-1">
								⚽ Chuteira de Ouro
							</span>
							<div className="my-2">
								<strong className="text-sm font-bold text-main block truncate" title={seasonLeaders.topScorer?.boleiro}>
									{seasonLeaders.topScorer?.boleiro || '—'}
								</strong>
								<span className="text-xs text-muted">
									{seasonLeaders.topScorer?.posicao || 'Boleiro'}
								</span>
							</div>
							<span className="text-lg font-black text-emerald-500">
								{seasonLeaders.topScorer?.artilharia} <span className="text-xs font-normal text-muted">gols</span>
							</span>
						</div>

						{/* Garçom */}
						<div className="bg-surface border border-border rounded-xl p-3.5 flex flex-col justify-between shadow-xs">
							<span className="text-[10px] font-bold uppercase tracking-wider text-blue-500 flex items-center gap-1">
								🎯 Rei dos Passes
							</span>
							<div className="my-2">
								<strong className="text-sm font-bold text-main block truncate" title={seasonLeaders.topAssister?.boleiro}>
									{seasonLeaders.topAssister?.boleiro || '—'}
								</strong>
								<span className="text-xs text-muted">
									{seasonLeaders.topAssister?.posicao || 'Boleiro'}
								</span>
							</div>
							<span className="text-lg font-black text-blue-500">
								{seasonLeaders.topAssister?.assistencias} <span className="text-xs font-normal text-muted">assists</span>
							</span>
						</div>

						{/* Vitórias */}
						<div className="bg-surface border border-border rounded-xl p-3.5 flex flex-col justify-between shadow-xs">
							<span className="text-[10px] font-bold uppercase tracking-wider text-purple-500 flex items-center gap-1">
								🏆 Mais Vitorioso
							</span>
							<div className="my-2">
								<strong className="text-sm font-bold text-main block truncate" title={seasonLeaders.topWins?.boleiro}>
									{seasonLeaders.topWins?.boleiro || '—'}
								</strong>
								<span className="text-xs text-muted">
									{seasonLeaders.topWins?.posicao || 'Boleiro'}
								</span>
							</div>
							<span className="text-lg font-black text-purple-500">
								{seasonLeaders.topWins?.babas_conquistados} <span className="text-xs font-normal text-muted">vitórias</span>
							</span>
						</div>

						{/* Clean Sheets */}
						<div className="bg-surface border border-border rounded-xl p-3.5 flex flex-col justify-between shadow-xs">
							<span className="text-[10px] font-bold uppercase tracking-wider text-cyan-500 flex items-center gap-1">
								🧤 Paredão
							</span>
							<div className="my-2">
								<strong className="text-sm font-bold text-main block truncate" title={seasonLeaders.topCleanSheets?.boleiro}>
									{seasonLeaders.topCleanSheets?.boleiro || '—'}
								</strong>
								<span className="text-xs text-muted">
									{seasonLeaders.topCleanSheets?.posicao || 'Boleiro'}
								</span>
							</div>
							<span className="text-lg font-black text-cyan-500">
								{seasonLeaders.topCleanSheets?.clean_sheets} <span className="text-xs font-normal text-muted">jogos</span>
							</span>
						</div>

						{/* Bola Cheia */}
						<div className="bg-surface border border-border rounded-xl p-3.5 flex flex-col justify-between shadow-xs">
							<span className="text-[10px] font-bold uppercase tracking-wider text-amber-500 flex items-center gap-1">
								🌟 Mais MVPs
							</span>
							<div className="my-2">
								<strong className="text-sm font-bold text-main block truncate" title={seasonLeaders.topMvp?.boleiro}>
									{seasonLeaders.topMvp?.boleiro || '—'}
								</strong>
								<span className="text-xs text-muted">
									{seasonLeaders.topMvp?.posicao || 'Boleiro'}
								</span>
							</div>
							<span className="text-lg font-black text-amber-500">
								{seasonLeaders.topMvp?.bola_cheia} <span className="text-xs font-normal text-muted">premiações</span>
							</span>
						</div>
					</div>
				</div>
			)}

			{/* Premiações da Rodada Selecionada */}
			<div className="space-y-4 pt-4 border-t border-border">
				<div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
					<div>
						<h2 className="text-base sm:text-lg font-bold text-main">
							Premiações da Rodada
						</h2>
						<p className="text-xs text-muted">
							Vencedores de cada categoria oficial do baba
						</p>
					</div>

					<div className="w-full sm:w-64">
						<SearchableSelect
							placeholder="Selecione a rodada"
							options={roundOptions}
							value={selectedRoundId}
							onChange={(val) => setSelectedRoundOverride(val)}
						/>
					</div>
				</div>

				{awardsQuery.isLoading ? (
					<div className="py-12">
						<Loading />
					</div>
				) : (
					<div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
						{Object.entries(AWARD_CONFIG).map(([eventType, config]) => {
							const awardItem = awardsByType.get(eventType);
							const hasWinner =
								(awardItem?.players && awardItem.players.length > 0) ||
								(awardItem?.teams && awardItem.teams.length > 0);

							return (
								<div
									key={eventType}
									className={`bg-surface border rounded-xl p-4 flex flex-col justify-between gap-3 shadow-xs transition-all ${
										hasWinner ? 'border-primary/40' : 'border-border'
									}`}
								>
									<div>
										<div className="flex items-center gap-2 mb-2">
											<span className="text-2xl">{config.icon}</span>
											<div>
												<h3 className="font-bold text-sm text-main leading-tight">
													{config.label}
												</h3>
												<p className="text-[11px] text-muted line-clamp-1">
													{config.desc}
												</p>
											</div>
										</div>

										<div className="mt-3 pt-3 border-t border-border">
											{hasWinner ? (
												<div className="space-y-1">
													{awardItem?.players?.map((p) => (
														<div
															key={p.id_player}
															className="flex items-center gap-2 py-1 px-2 rounded-lg bg-surface-hover border border-border"
														>
															<span className="w-5 h-5 rounded-full bg-primary/20 text-primary font-black text-[10px] flex items-center justify-center">
																★
															</span>
															<span className="font-bold text-xs text-main">
																{p.apelido || p.nome}
															</span>
														</div>
													))}
													{awardItem?.teams?.map((t) => (
														<div
															key={t.id_team}
															className="flex items-center gap-2 py-1 px-2 rounded-lg bg-surface-hover border border-border"
														>
															<span className="w-5 h-5 rounded-full bg-amber-500/20 text-amber-500 font-black text-[10px] flex items-center justify-center">
																🏆
															</span>
															<span className="font-bold text-xs text-main">
																{t.name}
															</span>
														</div>
													))}
												</div>
											) : (
												<span className="text-xs text-muted italic">
													Ainda não definido nesta rodada
												</span>
											)}
										</div>
									</div>
								</div>
							);
						})}
					</div>
				)}

				{/* Vencedores da Roleta */}
				{rouletteWinners.length > 0 && (
					<div className="bg-gradient-to-r from-purple-500/10 via-surface to-surface border border-purple-500/20 rounded-xl p-5 shadow-xs space-y-3">
						<div className="flex items-center gap-2">
							<span className="text-2xl">🎰</span>
							<div>
								<h3 className="text-base font-bold text-main">
									Sorteados na Roleta do Baba
								</h3>
								<p className="text-xs text-muted">
									Boleiros contemplados com prêmios na rodada
								</p>
							</div>
						</div>

						<div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
							{rouletteWinners.map((winner, idx) => (
								<div
									key={winner.id_winner || idx}
									className="bg-surface border border-border rounded-lg p-3 flex items-center gap-3 shadow-xs"
								>
									<div className="w-8 h-8 rounded-lg bg-purple-500/15 text-purple-600 dark:text-purple-400 font-bold flex items-center justify-center shrink-0">
										<Gift size={16} />
									</div>
									<div className="min-w-0">
										<span className="font-bold text-xs text-main block truncate">
											{winner.player_name || `Boleiro #${winner.player_id}`}
										</span>
										<span className="text-[11px] text-purple-600 dark:text-purple-400 font-semibold block truncate">
											🎁 {winner.prize_name || 'Brinde do Baba'}
										</span>
									</div>
								</div>
							))}
						</div>
					</div>
				)}
			</div>
		</div>
	);
}
