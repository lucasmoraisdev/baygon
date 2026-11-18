'use client';

import React, { useState, useMemo } from 'react';
import { useQueries, useQuery } from '@tanstack/react-query';
import { fetchAPI } from '@/lib/api';
import { SeasonSelector, Season } from '@/components/SeasonSelector';
import { SearchableSelect } from '@/components/SearchableSelect';
import { TeamColorTag } from '@/components/TeamColorTag';
import { Loading } from '@/components/Loading';
import {
	Swords,
	Calendar,
	Clock,
	ChevronDown,
	ChevronUp,
	Goal,
	Sparkles,
	Filter,
	Users,
	AlertCircle,
	CheckCircle2,
} from 'lucide-react';

interface MatchEvent {
	id_event?: number;
	id_match_event?: number;
	match_id: number;
	team_id?: number | null;
	player_id?: number | null;
	event_type: string;
	play_id?: number | null;
}

interface MatchItem {
	id?: number;
	id_match?: number;
	round_id: number;
	home_team_id: number;
	away_team_id: number;
	score_home?: number;
	score_away?: number;
	home_score?: number;
	away_score?: number;
	is_finished?: boolean;
	finished_at?: string | null;
	events?: MatchEvent[];
}

export default function PublicMatchesPage() {
	const [selectedSeasonOverride, setSelectedSeasonOverride] = useState<string>('');
	const [selectedRound, setSelectedRound] = useState<string>('');
	const [selectedTeam, setSelectedTeam] = useState<string>('');
	const [expandedMatchId, setExpandedMatchId] = useState<number | null>(null);

	// Busca de temporadas, temporada atual, times e jogadores
	const [seasonsQuery, currentSeasonQuery, teamsQuery, playersQuery] = useQueries({
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
				queryKey: ['public-teams-all'],
				queryFn: () => fetchAPI('/teams/').catch(() => []),
			},
			{
				queryKey: ['public-players-all'],
				queryFn: () => fetchAPI('/players/').catch(() => []),
			},
		],
	});

	const seasons: Season[] = seasonsQuery.data ?? [];
	const currentSeason = currentSeasonQuery.data;
	const allTeams: any[] = teamsQuery.data ?? [];
	const allPlayers: any[] = playersQuery.data ?? [];

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

	// Busca de partidas da temporada
	const matchesQuery = useQuery<MatchItem[]>({
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

	// Mapas rápidos de consulta
	const teamMap = useMemo(() => {
		const map = new Map<number, any>();
		allTeams.forEach((t) => map.set(t.id_team, t));
		return map;
	}, [allTeams]);

	const playerMap = useMemo(() => {
		const map = new Map<number, string>();
		allPlayers.forEach((p) => {
			map.set(p.id_player, p.apelido || p.nome);
		});
		return map;
	}, [allPlayers]);

	const roundMap = useMemo(() => {
		const map = new Map<number, any>();
		rounds.forEach((r) => map.set(r.id_round, r));
		return map;
	}, [rounds]);

	// Opções para SearchableSelect de Rodadas
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

	// Opções para SearchableSelect de Times
	const teamOptions = useMemo(() => {
		// Times participantes das partidas da temporada
		const seasonTeamIds = new Set<number>();
		matches.forEach((m) => {
			if (m.home_team_id) seasonTeamIds.add(m.home_team_id);
			if (m.away_team_id) seasonTeamIds.add(m.away_team_id);
		});

		const filtered = allTeams.filter((t) => seasonTeamIds.has(t.id_team));
		return (filtered.length ? filtered : allTeams).map((t) => ({
			value: String(t.id_team),
			label: t.name,
		}));
	}, [matches, allTeams]);

	// Partidas filtradas
	const filteredMatches = useMemo(() => {
		let list = [...matches];

		if (selectedRound) {
			list = list.filter((m) => String(m.round_id) === selectedRound);
		}

		if (selectedTeam) {
			const teamId = Number(selectedTeam);
			list = list.filter(
				(m) => m.home_team_id === teamId || m.away_team_id === teamId,
			);
		}

		// Ordenar partidas por ID decrescente ou por rodada
		return list.sort((a, b) => {
			const idA = a.id_match ?? a.id ?? 0;
			const idB = b.id_match ?? b.id ?? 0;
			return idB - idA;
		});
	}, [matches, selectedRound, selectedTeam]);

	const toggleExpand = (id: number) => {
		setExpandedMatchId((prev) => (prev === id ? null : id));
	};

	return (
		<div className="space-y-6">
			{/* Top Bar */}
			<div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-border">
				<div>
					<div className="flex items-center gap-2">
						<span className="p-2 rounded-xl bg-blue-500/10 text-blue-500 border border-blue-500/20">
							<Swords size={22} />
						</span>
						<div>
							<h1 className="text-xl sm:text-2xl font-bold text-main tracking-tight">
								Partidas & Placares
							</h1>
							<p className="text-xs sm:text-sm text-muted">
								Resultados em tempo real, confrontos, gols e autores da rodada
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

			{/* Barra de Filtros */}
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

					<SearchableSelect
						label="Time"
						placeholder="Todos os Times"
						allOptionLabel={`Todos os Times (${teamOptions.length})`}
						showAllOption
						searchPlaceholder="Buscar time..."
						options={teamOptions}
						value={selectedTeam}
						onChange={(val) => setSelectedTeam(val)}
					/>
				</div>

				<div className="flex items-center justify-between md:justify-end gap-3 pt-2 md:pt-0 border-t md:border-t-0 border-border text-xs text-muted">
					{(selectedRound || selectedTeam) && (
						<button
							type="button"
							onClick={() => {
								setSelectedRound('');
								setSelectedTeam('');
							}}
							className="text-xs text-primary hover:underline font-medium cursor-pointer"
						>
							Limpar filtros
						</button>
					)}
					<span>
						<strong className="text-main font-semibold">
							{filteredMatches.length}
						</strong>{' '}
						partidas listadas
					</span>
				</div>
			</div>

			{/* Lista de Partidas */}
			{matchesQuery.isLoading ? (
				<div className="py-12">
					<Loading />
				</div>
			) : filteredMatches.length === 0 ? (
				<div className="bg-surface border border-border rounded-xl p-10 text-center text-muted text-sm">
					Nenhuma partida encontrada com os filtros selecionados.
				</div>
			) : (
				<div className="grid grid-cols-1 md:grid-cols-2 gap-4">
					{filteredMatches.map((m, index) => {
						const matchId = m.id_match ?? m.id ?? index + 1;
						const homeTeam = teamMap.get(m.home_team_id);
						const awayTeam = teamMap.get(m.away_team_id);
						const round = roundMap.get(m.round_id);

						const homeScore = m.score_home ?? m.home_score ?? 0;
						const awayScore = m.score_away ?? m.away_score ?? 0;
						const isFinished = m.is_finished ?? true;
						const isExpanded = expandedMatchId === matchId;

						// Eventos de gols
						const goalEvents = (m.events ?? []).filter(
							(e) =>
								e.event_type === 'gol' ||
								e.event_type === 'gol_contra' ||
								e.event_type === 'penalti_convertido',
						);

						return (
							<div
								key={matchId}
								className="bg-surface border border-border rounded-xl shadow-xs hover:border-primary/50 transition-all overflow-hidden flex flex-col"
							>
								{/* Header do Card */}
								<div className="px-4 py-2.5 bg-surface-hover/60 border-b border-border flex items-center justify-between text-xs">
									<div className="flex items-center gap-2">
										<span className="font-semibold text-main">
											Partida #{matchId}
										</span>
										{round && (
											<span className="text-muted">
												· Rodada {round.round_number}
											</span>
										)}
									</div>
									<div>
										{isFinished ? (
											<span className="inline-flex items-center gap-1 text-[11px] font-medium text-muted">
												<CheckCircle2 size={12} className="text-slate-400" />
												Finalizada
											</span>
										) : (
											<span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-600 dark:text-emerald-400 animate-pulse">
												<span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
												Em Andamento
											</span>
										)}
									</div>
								</div>

								{/* Placar Central */}
								<div className="p-4 sm:p-5 flex items-center justify-between gap-3">
									{/* Time da Casa: Tag à esquerda do nome */}
									<div className="flex-1 min-w-0 flex items-center justify-end gap-2 text-right">
										<TeamColorTag
											color={homeTeam?.color}
											size="sm"
											showLabel={true}
										/>
										<span
											className="font-bold text-main text-sm sm:text-base leading-tight truncate"
											title={homeTeam?.name}
										>
											{homeTeam?.name || `Time ${m.home_team_id}`}
										</span>
									</div>

									{/* Placar Numérico */}
									<div className="shrink-0 flex items-center justify-center px-3.5 py-1.5 rounded-lg bg-background border border-border shadow-inner min-w-[72px]">
										<span className="text-2xl sm:text-3xl font-black text-main tracking-tight">
											{homeScore}
										</span>
										<span className="mx-2 text-xs font-semibold text-muted">
											x
										</span>
										<span className="text-2xl sm:text-3xl font-black text-main tracking-tight">
											{awayScore}
										</span>
									</div>

									{/* Time Visitante: Tag à direita do nome */}
									<div className="flex-1 min-w-0 flex items-center justify-start gap-2 text-left">
										<span
											className="font-bold text-main text-sm sm:text-base leading-tight truncate"
											title={awayTeam?.name}
										>
											{awayTeam?.name || `Time ${m.away_team_id}`}
										</span>
										<TeamColorTag
											color={awayTeam?.color}
											size="sm"
											showLabel={true}
										/>
									</div>
								</div>

								{/* Rodapé do Card com Ação de Expandir Detalhes */}
								<div className="mt-auto px-4 py-2.5 border-t border-border bg-surface-hover/30 flex items-center justify-between text-xs">
									<div className="flex items-center gap-1 text-muted">
										<Goal size={14} className="text-primary" />
										<span>{goalEvents.length} gol(s) no jogo</span>
									</div>

									{goalEvents.length > 0 && (
										<button
											type="button"
											onClick={() => toggleExpand(matchId)}
											className="inline-flex items-center gap-1 text-primary font-semibold hover:underline cursor-pointer"
										>
											<span>{isExpanded ? 'Ocultar lances' : 'Ver lances'}</span>
											{isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
										</button>
									)}
								</div>

								{/* Detalhes de Lances Expansíveis */}
								{isExpanded && goalEvents.length > 0 && (
									<div className="px-4 py-3 bg-background border-t border-border space-y-2 animate-fade-in text-xs">
										<div className="font-semibold text-muted text-[11px] uppercase tracking-wider">
											Gols da partida:
										</div>
										<div className="space-y-1.5">
											{goalEvents.map((evt, idx) => {
												const playerName = evt.player_id
													? playerMap.get(evt.player_id) || `Jogador #${evt.player_id}`
													: 'Boleiro';
												const isHome = evt.team_id === m.home_team_id;

												return (
													<div
														key={evt.id_event ?? evt.id_match_event ?? idx}
														className="flex items-center justify-between py-1 px-2 rounded bg-surface border border-border"
													>
														<div className="flex items-center gap-2">
															<span>⚽</span>
															<span className="font-semibold text-main">
																{playerName}
															</span>
															{evt.event_type === 'gol_contra' && (
																<span className="text-[10px] text-rose-500 font-bold bg-rose-500/10 px-1 rounded">
																	GOL CONTRA
																</span>
															)}
															{evt.event_type === 'penalti_convertido' && (
																<span className="text-[10px] text-amber-500 font-bold bg-amber-500/10 px-1 rounded">
																	PÊNALTI
																</span>
															)}
														</div>
														<span className="text-[11px] text-muted">
															{isHome ? homeTeam?.name : awayTeam?.name}
														</span>
													</div>
												);
											})}
										</div>
									</div>
								)}
							</div>
						);
					})}
				</div>
			)}
		</div>
	);
}
