'use client';

import React, { useState, useMemo } from 'react';
import { useQueries, useQuery } from '@tanstack/react-query';
import { fetchAPI } from '@/lib/api';
import { SeasonSelector, Season } from '@/components/SeasonSelector';
import { SearchableSelect } from '@/components/SearchableSelect';
import { TeamColorTag } from '@/components/TeamColorTag';
import { Loading } from '@/components/Loading';
import {
	Users,
	Shield,
	Trophy,
	Sparkles,
	Search,
	UserCheck,
	Goal,
	Swords,
} from 'lucide-react';

export default function PublicTeamsPage() {
	const [selectedSeasonOverride, setSelectedSeasonOverride] = useState<string>('');
	const [selectedRound, setSelectedRound] = useState<string>('');
	const [searchPlayer, setSearchPlayer] = useState('');

	// Busca de temporadas, temporada atual e todos os times
	const [seasonsQuery, currentSeasonQuery, teamsQuery] = useQueries({
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
			{
				queryKey: ['public-teams'],
				queryFn: () => fetchAPI('/teams/').catch(() => []),
			},
		],
	});

	const seasons: Season[] = seasonsQuery.data ?? [];
	const currentSeason = currentSeasonQuery.data;
	const allTeams: any[] = teamsQuery.data ?? [];

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

	// Busca de partidas para calcular estatísticas dos times
	const matchesQuery = useQuery<any[]>({
		queryKey: ['public-matches', selectedSeason],
		queryFn: () =>
			fetchAPI(
				selectedSeason ? `/matches/season/${selectedSeason}` : '/matches/',
			).catch(() => []),
		enabled: Boolean(selectedSeason),
	});

	const rounds = useMemo(() => {
		const list = roundsQuery.data ?? [];
		return [...list].sort((a, b) => b.round_number - a.round_number);
	}, [roundsQuery.data]);

	const matches = matchesQuery.data ?? [];

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

	// Estatísticas calculadas por time
	const teamStatsMap = useMemo(() => {
		const map = new Map<
			number,
			{
				games: number;
				wins: number;
				draws: number;
				losses: number;
				goalsFor: number;
				goalsAgainst: number;
			}
		>();

		matches.forEach((m) => {
			if (selectedRound && String(m.round_id) !== selectedRound) return;

			const homeId = m.home_team_id;
			const awayId = m.away_team_id;
			const homeScore = m.score_home ?? m.home_score ?? 0;
			const awayScore = m.score_away ?? m.away_score ?? 0;

			if (homeId) {
				if (!map.has(homeId)) {
					map.set(homeId, {
						games: 0,
						wins: 0,
						draws: 0,
						losses: 0,
						goalsFor: 0,
						goalsAgainst: 0,
					});
				}
				const s = map.get(homeId)!;
				s.games += 1;
				s.goalsFor += homeScore;
				s.goalsAgainst += awayScore;
				if (homeScore > awayScore) s.wins += 1;
				else if (homeScore === awayScore) s.draws += 1;
				else s.losses += 1;
			}

			if (awayId) {
				if (!map.has(awayId)) {
					map.set(awayId, {
						games: 0,
						wins: 0,
						draws: 0,
						losses: 0,
						goalsFor: 0,
						goalsAgainst: 0,
					});
				}
				const s = map.get(awayId)!;
				s.games += 1;
				s.goalsFor += awayScore;
				s.goalsAgainst += homeScore;
				if (awayScore > homeScore) s.wins += 1;
				else if (awayScore === homeScore) s.draws += 1;
				else s.losses += 1;
			}
		});

		return map;
	}, [matches, selectedRound]);

	// Times da temporada / rodada selecionada
	const displayedTeams = useMemo(() => {
		const seasonRoundIds = new Set(rounds.map((r) => r.id_round));

		let list = allTeams.filter((t) => {
			if (selectedRound) {
				return String(t.round_id) === selectedRound;
			}
			return t.round_id && seasonRoundIds.has(t.round_id);
		});

		if (searchPlayer.trim()) {
			const term = searchPlayer.toLowerCase();
			list = list.filter((t) => {
				const hasMatchingPlayer = (t.players ?? []).some(
					(p: any) =>
						p.nome?.toLowerCase().includes(term) ||
						p.apelido?.toLowerCase().includes(term),
				);
				return t.name.toLowerCase().includes(term) || hasMatchingPlayer;
			});
		}

		return list;
	}, [allTeams, rounds, selectedRound, searchPlayer]);

	return (
		<div className="space-y-6">
			{/* Top Bar */}
			<div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-border">
				<div>
					<div className="flex items-center gap-2">
						<span className="p-2 rounded-xl bg-purple-500/10 text-purple-500 border border-purple-500/20">
							<Users size={22} />
						</span>
						<div>
							<h1 className="text-xl sm:text-2xl font-bold text-main tracking-tight">
								Times & Elencos
							</h1>
							<p className="text-xs sm:text-sm text-muted">
								Escalações de cada equipe, distribuição de potes e histórico de partidas
							</p>
						</div>
					</div>
				</div>

				<div className="flex items-center gap-2">
					<SeasonSelector
						seasons={seasons}
						selectedSeasonId={selectedSeason}
						onSelectSeason={(s) => setSelectedSeasonOverride(String(s.id_season))}
						isLoading={seasonsQuery.isLoading}
						className="w-full sm:w-[260px]"
					/>
				</div>
			</div>

			{/* Barra de Filtros e Busca */}
			<div className="bg-surface border border-border rounded-xl p-4 flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 shadow-xs">
				<div className="grid grid-cols-1 sm:grid-cols-2 gap-3 flex-1 max-w-xl">
					<SearchableSelect
						label="Rodada"
						placeholder="Todas as Rodadas"
						allOptionLabel={`Todas as Rodadas (${rounds.length})`}
						showAllOption
						searchPlaceholder="Buscar rodada..."
						options={roundOptions}
						value={selectedRound}
						onChange={(val) => setSelectedRound(val)}
					/>

					<div className="flex flex-col gap-1.5">
						<label className="text-xs font-semibold text-muted">
							Buscar Time ou Boleiro
						</label>
						<div className="relative">
							<Search
								size={14}
								className="absolute left-3 top-1/2 -translate-y-1/2 text-muted"
							/>
							<input
								type="text"
								value={searchPlayer}
								onChange={(e) => setSearchPlayer(e.target.value)}
								placeholder="Nome do jogador ou time..."
								className="w-full pl-8 pr-3 py-2 text-xs bg-background border border-border rounded-lg text-main placeholder:text-muted focus:outline-none focus:ring-1 focus:ring-primary min-h-[44px]"
							/>
						</div>
					</div>
				</div>

				<div className="flex items-center justify-between md:justify-end gap-3 pt-2 md:pt-0 border-t md:border-t-0 border-border text-xs text-muted">
					{(selectedRound || searchPlayer) && (
						<button
							type="button"
							onClick={() => {
								setSelectedRound('');
								setSearchPlayer('');
							}}
							className="text-xs text-primary hover:underline font-medium cursor-pointer"
						>
							Limpar filtros
						</button>
					)}
					<span>
						<strong className="text-main font-semibold">
							{displayedTeams.length}
						</strong>{' '}
						times listados
					</span>
				</div>
			</div>

			{/* Grid de Times */}
			{teamsQuery.isLoading ? (
				<div className="py-12">
					<Loading />
				</div>
			) : displayedTeams.length === 0 ? (
				<div className="bg-surface border border-border rounded-xl p-10 text-center text-muted text-sm">
					Nenhum time encontrado para este filtro.
				</div>
			) : (
				<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
					{displayedTeams.map((team) => {
						const stats = teamStatsMap.get(team.id_team) || {
							games: 0,
							wins: 0,
							draws: 0,
							losses: 0,
							goalsFor: 0,
							goalsAgainst: 0,
						};
						const goalDiff = stats.goalsFor - stats.goalsAgainst;
						const players: any[] = team.players ?? [];

						return (
							<div
								key={team.id_team}
								className="bg-surface border border-border rounded-xl shadow-xs overflow-hidden flex flex-col hover:border-primary/50 transition-all"
							>
								{/* Top Banner com Cor */}
								<div className="p-4 border-b border-border bg-surface-hover/50 flex items-center justify-between gap-2">
									<div className="flex items-center gap-2.5 min-w-0">
										<TeamColorTag
											color={team.color}
											size="md"
											showLabel={true}
										/>
										<h2 className="font-bold text-main text-base truncate" title={team.name}>
											{team.name}
										</h2>
									</div>
									<span className="text-[11px] font-semibold text-muted bg-background px-2 py-0.5 rounded border border-border shrink-0">
										{players.length} atletas
									</span>
								</div>

								{/* Estatísticas Rápidas do Time */}
								<div className="grid grid-cols-4 divide-x divide-border border-b border-border bg-background/50 text-center py-2.5 text-xs">
									<div>
										<span className="text-[10px] text-muted block uppercase">Jogos</span>
										<strong className="text-sm text-main font-bold">
											{stats.games}
										</strong>
									</div>
									<div>
										<span className="text-[10px] text-muted block uppercase">V - E - D</span>
										<strong className="text-sm font-bold text-main">
											<span className="text-emerald-500">{stats.wins}</span>-
											<span className="text-slate-400">{stats.draws}</span>-
											<span className="text-rose-500">{stats.losses}</span>
										</strong>
									</div>
									<div>
										<span className="text-[10px] text-muted block uppercase">Gols</span>
										<strong className="text-sm text-main font-bold">
											{stats.goalsFor}:{stats.goalsAgainst}
										</strong>
									</div>
									<div>
										<span className="text-[10px] text-muted block uppercase">Saldo</span>
										<strong
											className={`text-sm font-bold ${
												goalDiff > 0
													? 'text-emerald-500'
													: goalDiff < 0
													? 'text-rose-500'
													: 'text-muted'
											}`}
										>
											{goalDiff > 0 ? `+${goalDiff}` : goalDiff}
										</strong>
									</div>
								</div>

								{/* Elenco do Time */}
								<div className="p-4 flex-1 flex flex-col">
									<div className="flex items-center justify-between mb-3 text-xs text-muted font-semibold uppercase tracking-wider">
										<span>Elenco Escalado</span>
										<span>Pote</span>
									</div>

									{players.length === 0 ? (
										<div className="py-6 text-center text-xs text-muted">
											Nenhum jogador vinculado neste time.
										</div>
									) : (
										<div className="space-y-1.5 divide-y divide-border/40">
											{players.map((p: any) => (
												<div
													key={p.id_player}
													className="pt-1.5 first:pt-0 flex items-center justify-between text-xs"
												>
													<div className="flex items-center gap-2">
														<span className="w-6 h-6 rounded-full bg-primary/10 text-primary font-bold text-[10px] flex items-center justify-center shrink-0">
															{(p.apelido || p.nome || 'B')[0].toUpperCase()}
														</span>
														<div>
															<span className="font-semibold text-main block">
																{p.apelido || p.nome}
															</span>
															{p.apelido && p.nome && (
																<span className="text-[10px] text-muted block">
																	{p.nome}
																</span>
															)}
														</div>
													</div>

													<div className="flex items-center gap-2">
														{p.posicao && (
															<span className="text-[10px] text-muted bg-surface px-1.5 py-0.5 rounded border border-border">
																{p.posicao}
															</span>
														)}
														{p.potes != null && (
															<span className="text-[10px] font-bold text-primary bg-primary/10 px-1.5 py-0.5 rounded">
																P{p.potes}
															</span>
														)}
													</div>
												</div>
											))}
										</div>
									)}
								</div>
							</div>
						);
					})}
				</div>
			)}
		</div>
	);
}
