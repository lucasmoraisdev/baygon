'use client';

import { Loading } from '@/components/Loading';
import { fetchAPI } from '@/lib/api';
import { useMutation, useQueries, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';

interface TeamPlayer {
	id_player: number;
	nome: string;
	apelido?: string | null;
}

interface TeamDetail {
	id_team: number;
	name: string;
	round_id: number;
	players?: TeamPlayer[];
}

interface MatchEventItem {
	id_event: number;
	id_match_event?: number;
	match_id: number;
	player_id: number;
	event_type: string;
	play_id?: number | null;
}

interface TimelineEntry {
	key: string;
	mainEvent: MatchEventItem;
	assistEvent?: MatchEventItem;
	runningHome: number;
	runningAway: number;
}

const EVENT_TITLES: Record<string, string> = {
	gol: 'Gol',
	assistencia: 'Assistência',
	gol_contra: 'Gol contra',
	cartao_amarelo: 'Cartão amarelo',
	cartao_vermelho: 'Cartão vermelho',
	ouro: 'Cartão ouro',
};

export default function LiveMatch({ params }: { params: { id: string } }) {
	const router = useRouter();
	const queryClient = useQueryClient();

	const [selectedSide, setSelectedSide] = useState<'home' | 'away'>('home');
	const [selectedPlayerId, setSelectedPlayerId] = useState<number | null>(
		null,
	);
	const [selectedAssistId, setSelectedAssistId] = useState<number | null>(
		null,
	);
	const [showExtraPlayers, setShowExtraPlayers] = useState(false);
	const [showExtraCameramen, setShowExtraCameramen] = useState(false);
	const [cameramanSearch, setCameramanSearch] = useState('');

	const [matchQuery, eventsQuery, playersQuery] = useQueries({
		queries: [
			{
				queryKey: ['match', params.id],
				queryFn: () => fetchAPI(`/matches/${params.id}`),
				refetchInterval: 5000,
			},
			{
				queryKey: ['events', 'match', params.id],
				queryFn: () => fetchAPI(`/events/match/${params.id}`),
				refetchInterval: 5000,
			},
			{
				queryKey: ['players'],
				queryFn: () => fetchAPI('/players/').catch(() => []),
			},
		],
	});

	const match = matchQuery.data;

	const [homeTeamQuery, awayTeamQuery, roundTeamsQuery] = useQueries({
		queries: [
			{
				queryKey: ['team', match?.home_team_id],
				queryFn: () => fetchAPI(`/teams/${match.home_team_id}`),
				enabled: Boolean(match?.home_team_id),
			},
			{
				queryKey: ['team', match?.away_team_id],
				queryFn: () => fetchAPI(`/teams/${match.away_team_id}`),
				enabled: Boolean(match?.away_team_id),
			},
			{
				queryKey: ['teams', 'round', match?.round_id],
				queryFn: () =>
					fetchAPI(`/teams/round/${match.round_id}`).catch(() => []),
				enabled: Boolean(match?.round_id),
			},
		],
	});

	const allPlayers: TeamPlayer[] = playersQuery.data ?? [];
	const homeTeam: TeamDetail | undefined = homeTeamQuery.data;
	const awayTeam: TeamDetail | undefined = awayTeamQuery.data;
	const roundTeams: TeamDetail[] = roundTeamsQuery.data ?? [];
	const events: MatchEventItem[] = eventsQuery.data ?? [];

	const playerMap = useMemo(() => {
		const map = new Map<number, TeamPlayer>();
		for (const p of allPlayers) map.set(p.id_player, p);
		for (const t of roundTeams) {
			for (const p of t.players ?? []) map.set(p.id_player, p);
		}
		for (const p of homeTeam?.players ?? []) map.set(p.id_player, p);
		for (const p of awayTeam?.players ?? []) map.set(p.id_player, p);
		return map;
	}, [allPlayers, roundTeams, homeTeam, awayTeam]);

	const homePlayerIds = useMemo(
		() => new Set((homeTeam?.players ?? []).map((p) => p.id_player)),
		[homeTeam],
	);
	const awayPlayerIds = useMemo(
		() => new Set((awayTeam?.players ?? []).map((p) => p.id_player)),
		[awayTeam],
	);

	// Players in the round who are NOT playing in this match (waiting teams) come first as suggested cameramen
	const { suggestedCameramen, otherCameramen } = useMemo(() => {
		const suggestedMap = new Map<
			number,
			{ player: TeamPlayer; teamName?: string }
		>();

		// 1. Players from other teams in the same round (outside current match)
		for (const t of roundTeams) {
			if (
				t.id_team === match?.home_team_id ||
				t.id_team === match?.away_team_id
			) {
				continue;
			}
			for (const p of t.players ?? []) {
				if (
					!homePlayerIds.has(p.id_player) &&
					!awayPlayerIds.has(p.id_player)
				) {
					suggestedMap.set(p.id_player, {
						player: p,
						teamName: t.name,
					});
				}
			}
		}

		// If there are no external teams in the round (e.g. only 2 teams in round), suggest the match players directly
		if (suggestedMap.size === 0) {
			for (const p of homeTeam?.players ?? []) {
				suggestedMap.set(p.id_player, {
					player: p,
					teamName: homeTeam?.name,
				});
			}
			for (const p of awayTeam?.players ?? []) {
				suggestedMap.set(p.id_player, {
					player: p,
					teamName: awayTeam?.name,
				});
			}
		}

		// Make sure the currently selected cameraman is always visible in suggested pills
		const currentFilmedByPlayerId = match?.filmed_by_player_id;
		if (
			currentFilmedByPlayerId &&
			!suggestedMap.has(currentFilmedByPlayerId)
		) {
			const p = playerMap.get(currentFilmedByPlayerId);
			if (p) {
				suggestedMap.set(currentFilmedByPlayerId, { player: p });
			}
		}

		const suggestedList = Array.from(suggestedMap.values());
		const others = allPlayers.filter((p) => !suggestedMap.has(p.id_player));
		return {
			suggestedCameramen: suggestedList,
			otherCameramen: others,
		};
	}, [
		roundTeams,
		match?.home_team_id,
		match?.away_team_id,
		match?.filmed_by_player_id,
		homePlayerIds,
		awayPlayerIds,
		homeTeam,
		awayTeam,
		playerMap,
		allPlayers,
	]);

	const activeTeam = selectedSide === 'home' ? homeTeam : awayTeam;
	const opponentTeam = selectedSide === 'home' ? awayTeam : homeTeam;

	const activeRoster = useMemo(() => {
		if (activeTeam?.players && activeTeam.players.length > 0) {
			return activeTeam.players;
		}
		return allPlayers;
	}, [activeTeam, allPlayers]);

	const extraPlayers = useMemo(() => {
		if (!activeTeam?.players || activeTeam.players.length === 0) return [];
		const inTeamSet = new Set(activeTeam.players.map((p) => p.id_player));
		return allPlayers.filter((p) => !inTeamSet.has(p.id_player));
	}, [activeTeam, allPlayers]);

	// Auto-select first player of the active team if none selected
	useEffect(() => {
		if (activeRoster.length > 0 && selectedPlayerId === null) {
			setSelectedPlayerId(activeRoster[0].id_player);
		}
	}, [activeRoster, selectedPlayerId]);

	const handleSelectSide = (side: 'home' | 'away') => {
		setSelectedSide(side);
		setSelectedAssistId(null);
		setShowExtraPlayers(false);
		const targetTeam = side === 'home' ? homeTeam : awayTeam;
		const roster =
			targetTeam?.players && targetTeam.players.length > 0
				? targetTeam.players
				: allPlayers;
		setSelectedPlayerId(roster.length > 0 ? roster[0].id_player : null);
	};

	const nextPlayId = useMemo(() => {
		const ids = events.map((e) => e.play_id ?? 0);
		return (ids.length ? Math.max(...ids) : 0) + 1;
	}, [events]);

	const invalidateMatch = () => {
		queryClient.invalidateQueries({ queryKey: ['match', params.id] });
		queryClient.invalidateQueries({
			queryKey: ['events', 'match', params.id],
		});
		if (match?.round_id) {
			queryClient.invalidateQueries({
				queryKey: ['matches', 'round', String(match.round_id)],
			});
		}
	};

	const eventMutation = useMutation({
		mutationFn: async ({
			type,
			teamSide,
			playerId,
			assistPlayerId,
		}: {
			type:
				| 'gol'
				| 'gol_contra'
				| 'cartao_amarelo'
				| 'cartao_vermelho'
				| 'ouro';
			teamSide: 'home' | 'away';
			playerId: number;
			assistPlayerId?: number | null;
		}) => {
			const playId = type === 'gol' ? nextPlayId : undefined;
			await fetchAPI('/events/', {
				method: 'POST',
				body: JSON.stringify({
					match_id: parseInt(params.id, 10),
					event_type: type,
					player_id: playerId,
					play_id: playId ?? null,
				}),
			});

			if (
				type === 'gol' &&
				assistPlayerId &&
				assistPlayerId !== playerId
			) {
				await fetchAPI('/events/', {
					method: 'POST',
					body: JSON.stringify({
						match_id: parseInt(params.id, 10),
						event_type: 'assistencia',
						player_id: assistPlayerId,
						play_id: playId ?? null,
					}),
				});
			}

			if (type === 'gol' || type === 'gol_contra') {
				const currentHome = match.home_score ?? match.score_home ?? 0;
				const currentAway = match.away_score ?? match.score_away ?? 0;
				const scoreForHome =
					(teamSide === 'home' && type === 'gol') ||
					(teamSide === 'away' && type === 'gol_contra');

				const updates = scoreForHome
					? { score_home: currentHome + 1 }
					: { score_away: currentAway + 1 };

				await fetchAPI(`/matches/${params.id}`, {
					method: 'PUT',
					body: JSON.stringify(updates),
				});
			}
		},
		onSuccess: () => {
			invalidateMatch();
			setSelectedAssistId(null);
		},
		onError: (err: Error) => {
			alert(`Erro ao registrar evento: ${err.message}`);
		},
	});

	const deleteEntryMutation = useMutation({
		mutationFn: async (entry: TimelineEntry) => {
			const mainId =
				entry.mainEvent.id_event ?? entry.mainEvent.id_match_event;
			await fetchAPI(`/events/${mainId}`, { method: 'DELETE' });

			if (entry.assistEvent) {
				const assistId =
					entry.assistEvent.id_event ??
					entry.assistEvent.id_match_event;
				if (assistId) {
					await fetchAPI(`/events/${assistId}`, {
						method: 'DELETE',
					}).catch(() => null);
				}
			}

			const evt = entry.mainEvent;
			if (evt.event_type === 'gol' || evt.event_type === 'gol_contra') {
				const currentHome = match.home_score ?? match.score_home ?? 0;
				const currentAway = match.away_score ?? match.score_away ?? 0;
				const isHomePlayer = homePlayerIds.has(evt.player_id);
				const isAwayPlayer = awayPlayerIds.has(evt.player_id);

				let decrementHome = false;
				if (evt.event_type === 'gol' && isHomePlayer) {
					decrementHome = true;
				} else if (evt.event_type === 'gol_contra' && isAwayPlayer) {
					decrementHome = true;
				}

				const updates = decrementHome
					? { score_home: Math.max(0, currentHome - 1) }
					: { score_away: Math.max(0, currentAway - 1) };

				await fetchAPI(`/matches/${params.id}`, {
					method: 'PUT',
					body: JSON.stringify(updates),
				});
			}
		},
		onSuccess: invalidateMatch,
		onError: (err: Error) => {
			alert(`Erro ao desfazer evento: ${err.message}`);
		},
	});

	const finishMatchMutation = useMutation({
		mutationFn: async () => {
			const currentHome = match.home_score ?? match.score_home ?? 0;
			const currentAway = match.away_score ?? match.score_away ?? 0;
			const outcome =
				currentHome > currentAway
					? 'vitoria_mandante'
					: currentAway > currentHome
						? 'vitoria_visitante'
						: 'empate';

			return fetchAPI(`/matches/${params.id}`, {
				method: 'PUT',
				body: JSON.stringify({
					score_home: currentHome,
					score_away: currentAway,
					event_type: outcome,
				}),
			});
		},
		onSuccess: () => {
			invalidateMatch();
			router.push(`/rounds/${match.round_id}`);
		},
		onError: (err: Error) => {
			alert(`Erro ao encerrar partida: ${err.message}`);
		},
	});

	const updateCameramanMutation = useMutation({
		mutationFn: async (playerId: number) => {
			return fetchAPI(`/matches/${params.id}`, {
				method: 'PUT',
				body: JSON.stringify({
					filmed_by_player_id: playerId,
				}),
			});
		},
		onSuccess: () => {
			invalidateMatch();
		},
		onError: (err: Error) => {
			alert(`Erro ao atualizar quem estava filmando: ${err.message}`);
		},
	});

	// Build grouped timeline entries (pairing gol + assistencia with same play_id and tracking running score)
	const timelineEntries = useMemo<TimelineEntry[]>(() => {
		const assistByPlayId = new Map<number, MatchEventItem>();
		const pairedAssistIds = new Set<number>();

		for (const e of events) {
			if (e.event_type === 'assistencia' && e.play_id) {
				assistByPlayId.set(e.play_id, e);
			}
		}

		let runHome = 0;
		let runAway = 0;
		const list: TimelineEntry[] = [];

		for (let i = 0; i < events.length; i++) {
			const e = events[i];
			const eid = e.id_event ?? e.id_match_event ?? i;

			if (e.event_type === 'assistencia' && e.play_id) {
				const hasMatchingGoal = events.some(
					(g) => g.event_type === 'gol' && g.play_id === e.play_id,
				);
				if (hasMatchingGoal) {
					pairedAssistIds.add(eid);
					continue;
				}
			}

			if (e.event_type === 'gol') {
				if (homePlayerIds.has(e.player_id)) {
					runHome += 1;
				} else if (awayPlayerIds.has(e.player_id)) {
					runAway += 1;
				}
			} else if (e.event_type === 'gol_contra') {
				if (homePlayerIds.has(e.player_id)) {
					runAway += 1;
				} else if (awayPlayerIds.has(e.player_id)) {
					runHome += 1;
				}
			}

			const linkedAssist =
				e.event_type === 'gol' && e.play_id
					? assistByPlayId.get(e.play_id)
					: undefined;

			list.push({
				key: String(eid),
				mainEvent: e,
				assistEvent: linkedAssist,
				runningHome: runHome,
				runningAway: runAway,
			});
		}

		return list.reverse();
	}, [events, homePlayerIds, awayPlayerIds]);

	if (matchQuery.isLoading && !match) return <Loading />;
	if (!match)
		return (
			<div className="text-[#94a3b8] p-4">Partida não encontrada.</div>
		);

	const homeScore = match.home_score ?? match.score_home ?? 0;
	const awayScore = match.away_score ?? match.score_away ?? 0;
	const homeTeamName = homeTeam?.name ?? `Time #${match.home_team_id}`;
	const awayTeamName = awayTeam?.name ?? `Time #${match.away_team_id}`;
	const opponentTeamName =
		opponentTeam?.name ??
		(selectedSide === 'home' ? awayTeamName : homeTeamName);

	const selectedPlayerObj = selectedPlayerId
		? playerMap.get(selectedPlayerId)
		: null;
	const selectedPlayerLabel = selectedPlayerObj
		? selectedPlayerObj.apelido || selectedPlayerObj.nome
		: 'jogador selecionado';

	const currentCameramanPlayerId: number | null =
		match.filmed_by_player_id ?? null;
	const currentCameramanObj = currentCameramanPlayerId
		? playerMap.get(currentCameramanPlayerId)
		: null;
	const currentCameramanLabel = currentCameramanObj
		? currentCameramanObj.apelido || currentCameramanObj.nome
		: (match.filmed_by_name ?? null);

	const filteredOtherCameramen = otherCameramen.filter((p) => {
		if (!cameramanSearch.trim()) return true;
		const term = cameramanSearch.toLowerCase();
		return (
			p.nome.toLowerCase().includes(term) ||
			(p.apelido && p.apelido.toLowerCase().includes(term))
		);
	});

	const handleRegisterEvent = (
		type:
			| 'gol'
			| 'gol_contra'
			| 'cartao_amarelo'
			| 'cartao_vermelho'
			| 'ouro',
	) => {
		if (!selectedPlayerId) return;
		eventMutation.mutate({
			type,
			teamSide: selectedSide,
			playerId: selectedPlayerId,
			assistPlayerId: type === 'gol' ? selectedAssistId : null,
		});
	};

	return (
		<div className="max-w-[1100px] w-full mx-auto flex flex-col gap-5 text-[#e6edf7] animate-slide-down">
			{/* Top Header */}
			<div className="flex flex-wrap gap-3 justify-between items-center">
				<div>
					<Link
						href={`/rounds/${match.round_id}`}
						className="text-[13px] text-[#94a3b8] hover:text-[#e6edf7] mb-1 inline-block transition-colors"
					>
						← Rodada #{match.round_id}
					</Link>
					<h1 className="m-0 text-2xl font-bold text-[#e6edf7]">
						Cobertura ao vivo
					</h1>
				</div>

				<div className="flex gap-3 items-center flex-wrap">
					<span className="inline-flex items-center gap-2 text-[13px] font-semibold px-3 py-[5px] rounded-full bg-emerald-500/[0.14] text-[#4ade80]">
						<span className="w-2 h-2 rounded-full bg-[#4ade80] animate-pulse" />
						Ao vivo · Partida #{match.id_match ?? match.id}
					</span>
					<button
						type="button"
						disabled={finishMatchMutation.isPending}
						onClick={() => {
							if (
								window.confirm(
									`Encerrar partida com placar ${homeTeamName} ${homeScore} × ${awayScore} ${awayTeamName}?`,
								)
							) {
								finishMatchMutation.mutate();
							}
						}}
						className="min-h-[40px] px-4 rounded-[10px] border border-white/[0.14] bg-transparent hover:bg-white/[0.05] text-[#e6edf7] font-medium text-sm cursor-pointer transition-colors"
					>
						{finishMatchMutation.isPending
							? 'Encerrando...'
							: 'Encerrar partida'}
					</button>
				</div>
			</div>

			{/* Hero Scoreboard */}
			<section className="bg-gradient-to-b from-[#14203a] to-[#111a2e] border border-white/[0.07] rounded-[16px] grid grid-cols-[1fr_auto_1fr] items-center gap-6 px-6 sm:px-8 py-7">
				<div className="text-right min-w-0">
					<div className="text-lg sm:text-xl font-semibold text-[#e6edf7] truncate">
						{homeTeamName}
					</div>
					<div className="text-[13px] text-[#94a3b8]">Mandante</div>
				</div>

				<div className="flex items-center gap-5 text-[48px] sm:text-[64px] font-bold leading-none tabular-nums text-[#e6edf7]">
					<span>{homeScore}</span>
					<span className="text-[28px] text-[#64748b]">×</span>
					<span>{awayScore}</span>
				</div>

				<div className="text-left min-w-0">
					<div className="text-lg sm:text-xl font-semibold text-[#e6edf7] truncate">
						{awayTeamName}
					</div>
					<div className="text-[13px] text-[#94a3b8]">Visitante</div>
				</div>
			</section>

			{/* Card: Quem estava filmando */}
			<section className="bg-[#111a2e] border border-white/[0.07] rounded-[16px] p-5 sm:p-6 flex flex-col gap-3.5">
				<div className="flex flex-wrap items-center justify-between gap-2">
					<div>
						<h2 className="m-0 text-base font-semibold text-[#e6edf7] flex items-center gap-2">
							<span>🎥 Quem estava filmando</span>
						</h2>
						<p className="m-0 mt-0.5 text-xs text-[#94a3b8]">
							Selecione o jogador responsável pela gravação desta
							partida (soma pontos de câmera na temporada).
						</p>
					</div>

					{currentCameramanLabel ? (
						<span className="inline-flex items-center gap-2 text-xs font-semibold px-3 py-1.5 rounded-full bg-blue-500/[0.16] border border-blue-500/30 text-[#bfdbfe]">
							<span className="w-2 h-2 rounded-full bg-[#60a5fa]" />
							Filmando: {currentCameramanLabel}
						</span>
					) : (
						<span className="inline-flex items-center gap-1.5 text-xs font-medium px-3 py-1 rounded-full bg-white/[0.05] text-[#94a3b8]">
							Nenhum jogador selecionado
						</span>
					)}
				</div>

				<div className="flex flex-wrap gap-2">
					{suggestedCameramen.map(({ player, teamName }) => {
						const isSelected =
							currentCameramanPlayerId === player.id_player;
						return (
							<button
								key={player.id_player}
								type="button"
								disabled={updateCameramanMutation.isPending}
								onClick={() =>
									updateCameramanMutation.mutate(
										player.id_player,
									)
								}
								className={`min-h-[38px] px-3.5 rounded-[10px] border inline-flex items-center gap-2 text-sm transition-colors cursor-pointer disabled:opacity-50 ${
									isSelected
										? 'bg-[#2563eb] border-[#2563eb] text-white font-semibold'
										: 'border-white/[0.12] bg-white/[0.03] hover:bg-white/[0.06] text-[#e6edf7] font-medium'
								}`}
							>
								<span>{player.apelido || player.nome}</span>
								{teamName && (
									<span
										className={`text-[11px] px-1.5 py-0.5 rounded ${
											isSelected
												? 'bg-white/20 text-white'
												: 'bg-white/[0.06] text-[#94a3b8]'
										}`}
									>
										{teamName}
									</span>
								)}
							</button>
						);
					})}

					{otherCameramen.length > 0 && (
						<button
							type="button"
							onClick={() =>
								setShowExtraCameramen((prev) => !prev)
							}
							className="min-h-[38px] px-3.5 rounded-[10px] border border-dashed border-white/[0.18] bg-white/[0.02] hover:bg-white/[0.05] text-[#94a3b8] inline-flex items-center text-sm font-medium cursor-pointer transition-colors"
						>
							Outros jogadores {showExtraCameramen ? '⌃' : '⌄'}
						</button>
					)}
				</div>

				{showExtraCameramen && otherCameramen.length > 0 && (
					<div className="pt-3 border-t border-white/[0.07] flex flex-col gap-2.5">
						<input
							type="text"
							value={cameramanSearch}
							onChange={(e) => setCameramanSearch(e.target.value)}
							placeholder="Buscar jogador para câmera..."
							className="w-full sm:max-w-xs min-h-[36px] px-3 rounded-[9px] bg-[#0b1220] border border-white/[0.12] text-[#e6edf7] text-xs focus:outline-none focus:border-[#2563eb]"
						/>
						<div className="flex flex-wrap gap-1.5 max-h-40 overflow-y-auto">
							{filteredOtherCameramen.map((p) => {
								const isSelected =
									currentCameramanPlayerId === p.id_player;
								return (
									<button
										key={p.id_player}
										type="button"
										disabled={
											updateCameramanMutation.isPending
										}
										onClick={() =>
											updateCameramanMutation.mutate(
												p.id_player,
											)
										}
										className={`min-h-[34px] px-3 rounded-lg border inline-flex items-center text-xs transition-colors cursor-pointer disabled:opacity-50 ${
											isSelected
												? 'bg-[#2563eb] border-[#2563eb] text-white font-semibold'
												: 'border-white/[0.12] bg-white/[0.02] hover:bg-white/[0.05] text-[#94a3b8]'
										}`}
									>
										{p.apelido || p.nome}
									</button>
								);
							})}
						</div>
					</div>
				)}
			</section>

			{/* 2-Column Main Grid */}
			<div className="grid grid-cols-1 lg:grid-cols-2 gap-5 items-start">
				{/* Left Card: Registrar evento */}
				<section className="bg-[#111a2e] border border-white/[0.07] rounded-[16px] p-6 flex flex-col gap-[22px]">
					<h2 className="m-0 text-base font-semibold text-[#e6edf7]">
						Registrar evento
					</h2>

					{/* TIME Segmented Control */}
					<div>
						<div className="text-xs tracking-[0.08em] text-[#64748b] font-semibold mb-2.5 uppercase">
							TIME
						</div>
						<div className="flex bg-[#0b1220] border border-white/[0.12] rounded-[10px] p-[3px]">
							<button
								type="button"
								onClick={() => handleSelectSide('home')}
								className={`flex-1 text-center py-[9px] px-3 rounded-[7px] font-semibold text-sm transition-colors cursor-pointer truncate ${
									selectedSide === 'home'
										? 'bg-blue-500/20 text-[#bfdbfe]'
										: 'text-[#94a3b8] hover:text-[#e6edf7]'
								}`}
							>
								{homeTeamName}
							</button>
							<button
								type="button"
								onClick={() => handleSelectSide('away')}
								className={`flex-1 text-center py-[9px] px-3 rounded-[7px] font-semibold text-sm transition-colors cursor-pointer truncate ${
									selectedSide === 'away'
										? 'bg-blue-500/20 text-[#bfdbfe]'
										: 'text-[#94a3b8] hover:text-[#e6edf7]'
								}`}
							>
								{awayTeamName}
							</button>
						</div>
					</div>

					{/* JOGADOR Pills */}
					<div>
						<div className="text-xs tracking-[0.08em] text-[#64748b] font-semibold mb-2.5 uppercase">
							JOGADOR
						</div>
						<div className="flex flex-wrap gap-2">
							{activeRoster.map((p) => {
								const isSelected =
									selectedPlayerId === p.id_player;
								return (
									<button
										key={p.id_player}
										type="button"
										onClick={() => {
											setSelectedPlayerId(p.id_player);
											if (
												selectedAssistId === p.id_player
											) {
												setSelectedAssistId(null);
											}
										}}
										className={`min-h-[40px] px-4 rounded-[10px] border inline-flex items-center text-sm transition-colors cursor-pointer ${
											isSelected
												? 'bg-[#2563eb] border-[#2563eb] text-white font-semibold'
												: 'border-white/[0.12] bg-white/[0.03] hover:bg-white/[0.06] text-[#e6edf7] font-medium'
										}`}
									>
										{p.apelido || p.nome}
									</button>
								);
							})}

							{extraPlayers.length > 0 && (
								<button
									type="button"
									onClick={() =>
										setShowExtraPlayers((prev) => !prev)
									}
									className="min-h-[40px] px-4 rounded-[10px] border border-dashed border-white/[0.18] bg-white/[0.02] hover:bg-white/[0.05] text-[#94a3b8] inline-flex items-center text-sm font-medium cursor-pointer transition-colors"
								>
									Outros jogadores {showExtraPlayers ? '⌃' : '⌄'}
								</button>
							)}
						</div>

						{showExtraPlayers && extraPlayers.length > 0 && (
							<div className="mt-2.5 pt-2.5 border-t border-white/[0.07] flex flex-wrap gap-1.5 max-h-36 overflow-y-auto">
								{extraPlayers.map((p) => {
									const isSelected =
										selectedPlayerId === p.id_player;
									return (
										<button
											key={p.id_player}
											type="button"
											onClick={() => {
												setSelectedPlayerId(
													p.id_player,
												);
												if (
													selectedAssistId ===
													p.id_player
												) {
													setSelectedAssistId(null);
												}
											}}
											className={`min-h-[34px] px-3 rounded-lg border inline-flex items-center text-xs transition-colors cursor-pointer ${
												isSelected
													? 'bg-[#2563eb] border-[#2563eb] text-white font-semibold'
													: 'border-white/[0.12] bg-white/[0.02] hover:bg-white/[0.05] text-[#94a3b8]'
											}`}
										>
											{p.apelido || p.nome}
										</button>
									);
								})}
							</div>
						)}
					</div>

					{/* ASSISTÊNCIA (OPCIONAL) Pills */}
					<div>
						<div className="text-xs tracking-[0.08em] text-[#64748b] font-semibold mb-2.5 uppercase">
							ASSISTÊNCIA (OPCIONAL)
						</div>
						<div className="flex flex-wrap gap-2">
							<button
								type="button"
								onClick={() => setSelectedAssistId(null)}
								className={`min-h-[40px] px-4 rounded-[10px] border inline-flex items-center text-sm transition-colors cursor-pointer ${
									selectedAssistId === null
										? 'bg-blue-500/20 border-blue-500/40 text-[#bfdbfe] font-semibold'
										: 'border-white/[0.12] bg-white/[0.03] hover:bg-white/[0.06] text-[#e6edf7] font-medium'
								}`}
							>
								Sem assistência
							</button>

							{activeRoster
								.filter((p) => p.id_player !== selectedPlayerId)
								.map((p) => {
									const isAssistSelected =
										selectedAssistId === p.id_player;
									return (
										<button
											key={p.id_player}
											type="button"
											onClick={() =>
												setSelectedAssistId(
													isAssistSelected
														? null
														: p.id_player,
												)
											}
											className={`min-h-[40px] px-4 rounded-[10px] border inline-flex items-center text-sm transition-colors cursor-pointer ${
												isAssistSelected
													? 'bg-blue-500/20 border-blue-500/40 text-[#bfdbfe] font-semibold'
													: 'border-white/[0.12] bg-white/[0.03] hover:bg-white/[0.06] text-[#e6edf7] font-medium'
											}`}
										>
											{p.apelido || p.nome}
										</button>
									);
								})}
						</div>
					</div>

					{/* EVENTO PARA JOGADOR */}
					<div>
						<div className="text-xs tracking-[0.08em] text-[#64748b] font-semibold mb-2.5 uppercase">
							EVENTO PARA {selectedPlayerLabel}
						</div>

						<button
							type="button"
							disabled={
								!selectedPlayerId || eventMutation.isPending
							}
							onClick={() => handleRegisterEvent('gol')}
							className="w-full min-h-[52px] rounded-[10px] border border-[#16a34a] bg-[#16a34a] hover:bg-green-500 disabled:opacity-45 disabled:cursor-not-allowed text-white font-semibold text-base flex items-center justify-center gap-2 cursor-pointer transition-colors"
						>
							Registrar gol
						</button>

						<div className="grid grid-cols-2 gap-2.5 mt-2.5">
							<button
								type="button"
								disabled={
									!selectedPlayerId || eventMutation.isPending
								}
								onClick={() =>
									handleRegisterEvent('cartao_amarelo')
								}
								className="min-h-[48px] rounded-[10px] border border-white/[0.14] bg-transparent hover:bg-white/[0.05] disabled:opacity-45 disabled:cursor-not-allowed text-[#e6edf7] font-semibold text-sm flex items-center justify-center gap-2 cursor-pointer transition-colors"
							>
								<span className="w-[11px] h-[15px] rounded-[2px] bg-[#facc15] inline-block" />
								Amarelo
							</button>

							<button
								type="button"
								disabled={
									!selectedPlayerId || eventMutation.isPending
								}
								onClick={() =>
									handleRegisterEvent('cartao_vermelho')
								}
								className="min-h-[48px] rounded-[10px] border border-white/[0.14] bg-transparent hover:bg-white/[0.05] disabled:opacity-45 disabled:cursor-not-allowed text-[#e6edf7] font-semibold text-sm flex items-center justify-center gap-2 cursor-pointer transition-colors"
							>
								<span className="w-[11px] h-[15px] rounded-[2px] bg-[#ef4444] inline-block" />
								Vermelho
							</button>

							<button
								type="button"
								disabled={
									!selectedPlayerId || eventMutation.isPending
								}
								onClick={() => handleRegisterEvent('ouro')}
								className="min-h-[48px] rounded-[10px] border border-white/[0.14] bg-transparent hover:bg-white/[0.05] disabled:opacity-45 disabled:cursor-not-allowed text-[#e6edf7] font-semibold text-sm flex items-center justify-center gap-2 cursor-pointer transition-colors"
							>
								<span className="w-[11px] h-[15px] rounded-[2px] bg-[#3b82f6] inline-block" />
								Ouro
							</button>

							<button
								type="button"
								disabled={
									!selectedPlayerId || eventMutation.isPending
								}
								onClick={() =>
									handleRegisterEvent('gol_contra')
								}
								className="min-h-[48px] rounded-[10px] border border-white/[0.14] bg-transparent hover:bg-white/[0.05] disabled:opacity-45 disabled:cursor-not-allowed text-[#e6edf7] font-semibold text-sm flex items-center justify-center gap-2 cursor-pointer transition-colors"
							>
								Gol contra
							</button>
						</div>

						<div className="text-[#94a3b8] mt-2.5 text-xs">
							Gol contra conta para {opponentTeamName}.
						</div>
					</div>
				</section>

				{/* Right Card: Linha do tempo */}
				<section className="bg-[#111a2e] border border-white/[0.07] rounded-[16px] p-6 flex flex-col">
					<div className="flex justify-between items-baseline mb-2">
						<h2 className="m-0 text-base font-semibold text-[#e6edf7]">
							Linha do tempo
						</h2>
						<span className="text-[13px] text-[#94a3b8]">
							{timelineEntries.length}{' '}
							{timelineEntries.length === 1
								? 'evento'
								: 'eventos'}
						</span>
					</div>

					{timelineEntries.length === 0 ? (
						<div className="py-6 text-[13px] text-[#94a3b8]">
							Nenhum evento ainda. Escolha um jogador para
							começar.
						</div>
					) : (
						<div className="flex flex-col">
							{timelineEntries.map((entry, idx) => {
								const evt = entry.mainEvent;
								const p = playerMap.get(evt.player_id);
								const playerLabel = p
									? p.apelido || p.nome
									: `Jogador #${evt.player_id}`;

								const assistPlayer = entry.assistEvent
									? playerMap.get(entry.assistEvent.player_id)
									: undefined;
								const assistLabel = assistPlayer
									? assistPlayer.apelido || assistPlayer.nome
									: undefined;

								const isHome = homePlayerIds.has(evt.player_id);
								const isAway = awayPlayerIds.has(evt.player_id);
								const playerTeamLabel = isHome
									? homeTeamName
									: isAway
										? awayTeamName
										: '';

								const renderBadge = () => {
									if (evt.event_type === 'gol') {
										return (
											<div className="w-7 h-7 rounded-full flex-none flex items-center justify-center text-xs font-bold bg-emerald-500/[0.16] text-[#4ade80]">
												G
											</div>
										);
									}
									if (evt.event_type === 'gol_contra') {
										return (
											<div className="w-7 h-7 rounded-full flex-none flex items-center justify-center text-[11px] font-bold bg-red-500/[0.16] text-[#f87171]">
												GC
											</div>
										);
									}
									if (evt.event_type === 'cartao_amarelo') {
										return (
											<div className="w-7 h-7 rounded-full flex-none flex items-center justify-center bg-yellow-400/[0.16]">
												<span className="w-[9px] h-3 rounded-[2px] bg-[#facc15] inline-block" />
											</div>
										);
									}
									if (evt.event_type === 'cartao_vermelho') {
										return (
											<div className="w-7 h-7 rounded-full flex-none flex items-center justify-center bg-red-500/[0.16]">
												<span className="w-[9px] h-3 rounded-[2px] bg-[#ef4444] inline-block" />
											</div>
										);
									}
									if (evt.event_type === 'ouro') {
										return (
											<div className="w-7 h-7 rounded-full flex-none flex items-center justify-center bg-blue-500/[0.16]">
												<span className="w-[9px] h-3 rounded-[2px] bg-[#3b82f6] inline-block" />
											</div>
										);
									}
									return (
										<div className="w-7 h-7 rounded-full flex-none flex items-center justify-center text-xs font-bold bg-blue-500/[0.16] text-[#60a5fa]">
											A
										</div>
									);
								};

								const subtitle = (() => {
									if (
										evt.event_type === 'gol' ||
										evt.event_type === 'gol_contra'
									) {
										const scorePart = `${homeTeamName} ${entry.runningHome} × ${entry.runningAway} ${awayTeamName}`;
										if (assistLabel) {
											return `Assistência: ${assistLabel} · ${scorePart}`;
										}
										return scorePart;
									}
									return playerTeamLabel || `Lance #${evt.play_id ?? idx + 1}`;
								})();

								return (
									<div
										key={entry.key}
										className={`flex gap-3 py-3 items-start ${
											idx > 0
												? 'border-t border-white/[0.06]'
												: ''
										}`}
									>
										{renderBadge()}
										<div className="min-w-0 flex-1">
											<div className="font-semibold text-sm text-[#e6edf7]">
												{EVENT_TITLES[evt.event_type] ??
													evt.event_type}{' '}
												· {playerLabel}
											</div>
											<div className="text-[13px] text-[#94a3b8]">
												{subtitle}
											</div>
										</div>
										<button
											type="button"
											disabled={
												deleteEntryMutation.isPending
											}
											onClick={() =>
												deleteEntryMutation.mutate(
													entry,
												)
											}
											className="ml-auto bg-transparent border-0 text-[#94a3b8] hover:text-[#f87171] font-medium text-xs cursor-pointer px-1.5 py-1 underline shrink-0 transition-colors"
										>
											Desfazer
										</button>
									</div>
								);
							})}
						</div>
					)}
				</section>
			</div>
		</div>
	);
}
