'use client';

import { Loading } from '@/components/Loading';
import { TeamColorTag } from '@/components/TeamColorTag';
import { useAuth } from '@/context/AuthContext';
import { fetchAPI } from '@/lib/api';
import { useMutation, useQueries, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Zap } from 'lucide-react';
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
	color?: string | null;
	round_id: number;
	players?: TeamPlayer[];
}

interface MatchEventItem {
	id_event: number;
	id_match_event?: number;
	match_id: number;
	team_id?: number | null;
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
	ouro: 'Ouro',
};

export default function LiveMatch({ params }: { params: { id: string } }) {
	const router = useRouter();
	const queryClient = useQueryClient();
	const { user } = useAuth();
	const isAdmin = Boolean(user?.is_admin || user?.role === 'admin');

	const [selectedSide, setSelectedSide] = useState<'home' | 'away'>('home');
	const [selectedPlayerId, setSelectedPlayerId] = useState<number | null>(
		null,
	);
	const [assistMode, setAssistMode] = useState<
		'none' | 'assistencia' | 'ouro'
	>('none');
	const [selectedAssistId, setSelectedAssistId] = useState<number | null>(
		null,
	);
	const [showExtraPlayers, setShowExtraPlayers] = useState(false);
	const [showExtraAssist, setShowExtraAssist] = useState(false);
	const [showExtraOuro, setShowExtraOuro] = useState(false);
	const [showExtraCameramen, setShowExtraCameramen] = useState(false);
	const [cameramanSearch, setCameramanSearch] = useState('');
	const [isEditing, setIsEditing] = useState(false);
	const [actionFeedback, setActionFeedback] = useState<{
		message: string;
		type: 'success' | 'error';
	} | null>(null);
	const [isSubmittingCooldown, setIsSubmittingCooldown] = useState(false);

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

	const fullPlayerList = useMemo(
		() => Array.from(playerMap.values()),
		[playerMap],
	);

	const playerTeamMap = useMemo(() => {
		const map = new Map<number, string>();
		for (const t of roundTeams) {
			for (const p of t.players ?? []) {
				map.set(p.id_player, t.name);
			}
		}
		if (homeTeam) {
			for (const p of homeTeam.players ?? []) {
				map.set(p.id_player, homeTeam.name);
			}
		}
		if (awayTeam) {
			for (const p of awayTeam.players ?? []) {
				map.set(p.id_player, awayTeam.name);
			}
		}
		return map;
	}, [roundTeams, homeTeam, awayTeam]);

	const opponentRoster: TeamPlayer[] = opponentTeam?.players ?? [];
	const assistIsOuro =
		assistMode === 'ouro' && selectedAssistId !== null;

	const activeRoster = useMemo(() => {
		if (activeTeam?.players && activeTeam.players.length > 0) {
			return activeTeam.players;
		}
		return allPlayers;
	}, [activeTeam, allPlayers]);

	const extraPlayers = useMemo(() => {
		if (!activeTeam?.players || activeTeam.players.length === 0) return [];
		const inTeamSet = new Set(activeTeam.players.map((p) => p.id_player));
		return fullPlayerList.filter((p) => !inTeamSet.has(p.id_player));
	}, [activeTeam, fullPlayerList]);

	// Assistência primária: jogadores do próprio time (excluindo o autor do gol)
	const assistPrimaryRoster = useMemo(() => {
		const teamPlayers =
			activeTeam?.players && activeTeam.players.length > 0
				? activeTeam.players
				: [];
		return teamPlayers.filter((p) => p.id_player !== selectedPlayerId);
	}, [activeTeam, selectedPlayerId]);

	// Assistência outros: todos os demais jogadores do campeonato/rodada (excluindo autor do gol)
	const assistOtherPlayers = useMemo(() => {
		const primarySet = new Set(assistPrimaryRoster.map((p) => p.id_player));
		const others = fullPlayerList.filter(
			(p) =>
				p.id_player !== selectedPlayerId &&
				!primarySet.has(p.id_player),
		);
		return others.sort((a, b) => {
			const aInRound = playerTeamMap.has(a.id_player);
			const bInRound = playerTeamMap.has(b.id_player);
			if (aInRound && !bInRound) return -1;
			if (!aInRound && bInRound) return 1;
			const nameA = (a.apelido || a.nome).toLowerCase();
			const nameB = (b.apelido || b.nome).toLowerCase();
			return nameA.localeCompare(nameB, 'pt-BR');
		});
	}, [fullPlayerList, selectedPlayerId, assistPrimaryRoster, playerTeamMap]);

	// Ouro primário: jogadores do time adversário (excluindo autor do gol)
	const ouroPrimaryRoster = useMemo(() => {
		const teamPlayers =
			opponentTeam?.players && opponentTeam.players.length > 0
				? opponentTeam.players
				: [];
		return teamPlayers.filter((p) => p.id_player !== selectedPlayerId);
	}, [opponentTeam, selectedPlayerId]);

	// Ouro outros: todos os demais jogadores do campeonato/rodada (excluindo autor do gol)
	const ouroOtherPlayers = useMemo(() => {
		const primarySet = new Set(ouroPrimaryRoster.map((p) => p.id_player));
		const others = fullPlayerList.filter(
			(p) =>
				p.id_player !== selectedPlayerId &&
				!primarySet.has(p.id_player),
		);
		return others.sort((a, b) => {
			const aInRound = playerTeamMap.has(a.id_player);
			const bInRound = playerTeamMap.has(b.id_player);
			if (aInRound && !bInRound) return -1;
			if (!aInRound && bInRound) return 1;
			const nameA = (a.apelido || a.nome).toLowerCase();
			const nameB = (b.apelido || b.nome).toLowerCase();
			return nameA.localeCompare(nameB, 'pt-BR');
		});
	}, [fullPlayerList, selectedPlayerId, ouroPrimaryRoster, playerTeamMap]);

	// Auto-select first player of the active team if none selected
	useEffect(() => {
		if (activeRoster.length > 0 && selectedPlayerId === null) {
			setSelectedPlayerId(activeRoster[0].id_player);
		}
	}, [activeRoster, selectedPlayerId]);

	const handleSelectSide = (side: 'home' | 'away') => {
		setSelectedSide(side);
		setAssistMode('none');
		setSelectedAssistId(null);
		setShowExtraPlayers(false);
		setShowExtraAssist(false);
		setShowExtraOuro(false);
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
			assistType,
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
			assistType?: 'assistencia' | 'ouro';
		}) => {
			const playId = type === 'gol' ? nextPlayId : undefined;
			const targetTeamId =
				teamSide === 'home'
					? match.home_team_id
					: match.away_team_id;
			const opponentTeamId =
				teamSide === 'home'
					? match.away_team_id
					: match.home_team_id;

			await fetchAPI('/events/', {
				method: 'POST',
				body: JSON.stringify({
					match_id: parseInt(params.id, 10),
					team_id: targetTeamId,
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
				// Assistência é do mesmo time do autor do gol; Ouro (falha) é do adversário
				const assistTeamId =
					assistType === 'ouro' ? opponentTeamId : targetTeamId;

				await fetchAPI('/events/', {
					method: 'POST',
					body: JSON.stringify({
						match_id: parseInt(params.id, 10),
						team_id: assistTeamId,
						event_type: assistType ?? 'assistencia',
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
		onSuccess: (_data, variables) => {
			invalidateMatch();
			setAssistMode('none');
			setSelectedAssistId(null);
			setShowExtraAssist(false);
			setShowExtraOuro(false);

			const pObj = playerMap.get(variables.playerId);
			const pName = pObj?.apelido || pObj?.nome || 'Jogador';
			const aObj = variables.assistPlayerId ? playerMap.get(variables.assistPlayerId) : null;
			const aName = aObj?.apelido || aObj?.nome;

			let msg = '';
			if (variables.type === 'gol') {
				const assistLabel = aName
					? variables.assistType === 'ouro'
						? ` · Ouro: ${aName}`
						: ` · Assistência: ${aName}`
					: '';
				msg = `Gol registrado para ${pName}${assistLabel}!`;
			} else if (variables.type === 'gol_contra') {
				msg = `Gol contra de ${pName} registrado!`;
			} else if (variables.type === 'cartao_amarelo') {
				msg = `Cartão amarelo para ${pName} registrado!`;
			} else if (variables.type === 'cartao_vermelho') {
				msg = `Cartão vermelho para ${pName} registrado!`;
			} else {
				msg = `Evento registrado com sucesso!`;
			}

			setActionFeedback({ message: msg, type: 'success' });
			setTimeout(() => setActionFeedback(null), 4000);
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
				let decrementHome = false;
				if (evt.team_id != null) {
					if (evt.event_type === 'gol') {
						decrementHome = evt.team_id === match.home_team_id;
					} else {
						// Gol contra pontua para o adversário do time que cometeu
						decrementHome = evt.team_id !== match.home_team_id;
					}
				} else {
					const isHomePlayer = homePlayerIds.has(evt.player_id);
					const isAwayPlayer = awayPlayerIds.has(evt.player_id);
					if (evt.event_type === 'gol') {
						if (isHomePlayer) {
							decrementHome = true;
						} else if (isAwayPlayer) {
							decrementHome = false;
						} else {
							// Jogador de fora/emprestado: desconta do lado que tem placar disponível
							decrementHome = currentHome > currentAway || currentAway === 0;
						}
					} else if (evt.event_type === 'gol_contra') {
						decrementHome = !isHomePlayer;
					}
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
		onSuccess: () => {
			invalidateMatch();
			setActionFeedback({
				message: 'Evento desfeito com sucesso!',
				type: 'success',
			});
			setTimeout(() => setActionFeedback(null), 3000);
		},
		onError: (err: Error) => {
			alert(`Erro ao desfazer evento: ${err.message}`);
		},
	});

	const updateScoreMutation = useMutation({
		mutationFn: async ({
			scoreHome,
			scoreAway,
		}: {
			scoreHome: number;
			scoreAway: number;
		}) => {
			const currentHome = Math.max(0, scoreHome);
			const currentAway = Math.max(0, scoreAway);
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
			setActionFeedback({
				message: 'Placar ajustado com sucesso!',
				type: 'success',
			});
			setTimeout(() => setActionFeedback(null), 3000);
		},
		onError: (err: Error) => {
			alert(`Erro ao ajustar placar: ${err.message}`);
		},
	});

	const handleAdjustScore = (side: 'home' | 'away', delta: number) => {
		const newHome = side === 'home' ? Math.max(0, homeScore + delta) : homeScore;
		const newAway = side === 'away' ? Math.max(0, awayScore + delta) : awayScore;
		updateScoreMutation.mutate({ scoreHome: newHome, scoreAway: newAway });
	};

	const finishMatchMutation = useMutation({
		mutationFn: async (_opts: { redirect: boolean }) => {
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
					is_finished: true,
				}),
			});
		},
		onSuccess: (_data, opts) => {
			invalidateMatch();
			setIsEditing(false);
			if (opts.redirect) {
				router.push(`/rounds/${match.round_id}`);
			}
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
			if ((e.event_type === 'assistencia' || e.event_type === 'ouro') && e.play_id) {
				assistByPlayId.set(e.play_id, e);
			}
		}

		let runHome = 0;
		let runAway = 0;
		const list: TimelineEntry[] = [];

		for (let i = 0; i < events.length; i++) {
			const e = events[i];
			const eid = e.id_event ?? e.id_match_event ?? i;

			if ((e.event_type === 'assistencia' || e.event_type === 'ouro') && e.play_id) {
				const hasMatchingGoal = events.some(
					(g) => g.event_type === 'gol' && g.play_id === e.play_id,
				);
				if (hasMatchingGoal) {
					pairedAssistIds.add(eid);
					continue;
				}
			}

			const isForHome =
				e.team_id != null
					? e.team_id === match?.home_team_id
					: homePlayerIds.has(e.player_id);
			const isForAway =
				e.team_id != null
					? e.team_id === match?.away_team_id
					: awayPlayerIds.has(e.player_id);

			if (e.event_type === 'gol') {
				if (isForHome) {
					runHome += 1;
				} else if (isForAway) {
					runAway += 1;
				}
			} else if (e.event_type === 'gol_contra') {
				if (isForHome) {
					runAway += 1;
				} else if (isForAway) {
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
			<div className="text-muted p-4">Partida não encontrada.</div>
		);

	const homeScore = match.home_score ?? match.score_home ?? 0;
	const awayScore = match.away_score ?? match.score_away ?? 0;
	const isFinished = Boolean(match.is_finished);
	const readOnly = isFinished && !isEditing;
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
		if (!selectedPlayerId || eventMutation.isPending || isSubmittingCooldown) return;
		setIsSubmittingCooldown(true);
		setTimeout(() => setIsSubmittingCooldown(false), 800);

		eventMutation.mutate({
			type,
			teamSide: selectedSide,
			playerId: selectedPlayerId,
			assistPlayerId:
				type === 'gol' && assistMode !== 'none'
					? selectedAssistId
					: null,
			assistType: assistMode === 'ouro' ? 'ouro' : 'assistencia',
		});
	};

	return (
		<div className="max-w-[1100px] w-full mx-auto flex flex-col gap-5 text-main animate-slide-down">
			{/* Top Header */}
			<div className="flex flex-wrap gap-3 justify-between items-center">
				<div>
					<Link
						href={`/rounds/${match.round_id}`}
						className="text-[13px] text-muted hover:text-main mb-1 inline-flex items-center gap-1.5 transition-colors"
					>
						<ArrowLeft size={16} /> Rodada #{match.round_id}
					</Link>
					<h1 className="m-0 text-2xl font-bold text-main">
						{readOnly
							? 'Resumo da partida'
							: isEditing
								? 'Editando partida'
								: 'Cobertura ao vivo'}
					</h1>
				</div>

				<div className="flex gap-3 items-center flex-wrap">
					{isAdmin && match?.round_id && (
						<Link
							href={`/rounds/${match.round_id}/mass`}
							className="min-h-[40px] px-4 rounded-[10px] border border-blue-600/30 dark:border-blue-500/40 bg-blue-50 hover:bg-blue-100 text-blue-700 dark:bg-blue-500/15 dark:hover:bg-blue-500/25 dark:text-blue-300 text-sm font-semibold flex items-center gap-2 cursor-pointer transition-colors shadow-sm"
						>
							<Zap size={15} className="text-blue-600 dark:text-blue-400" />
							<span>⚡ Cadastro em Massa</span>
						</Link>
					)}

					{isFinished ? (
						<span className="inline-flex items-center gap-2 text-[13px] font-semibold px-3 py-[5px] rounded-full bg-surface border border-border text-muted">
							<span className="w-2 h-2 rounded-full bg-muted" />
							Encerrada · Partida #{match.id_match ?? match.id}
						</span>
					) : (
						<span className="inline-flex items-center gap-2 text-[13px] font-semibold px-3 py-[5px] rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-600 dark:text-[#4ade80]">
							<span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
							Ao vivo · Partida #{match.id_match ?? match.id}
						</span>
					)}

					{readOnly ? (
						<button
							type="button"
							onClick={() => setIsEditing(true)}
							className="min-h-[40px] px-4 rounded-[10px] border border-blue-500/40 bg-blue-500/10 hover:bg-blue-500/20 text-[#bfdbfe] font-medium text-sm cursor-pointer transition-colors"
						>
							Editar partida
						</button>
					) : isEditing ? (
						<>
							<button
								type="button"
								disabled={finishMatchMutation.isPending}
								onClick={() => setIsEditing(false)}
								className="min-h-[40px] px-4 rounded-[10px] border border-border bg-surface hover:bg-nav-hover text-muted font-medium text-sm cursor-pointer transition-colors"
							>
								Cancelar
							</button>
							<button
								type="button"
								disabled={finishMatchMutation.isPending}
								onClick={() =>
									finishMatchMutation.mutate({ redirect: false })
								}
								className="min-h-[40px] px-4 rounded-[10px] border border-primary bg-primary hover:bg-primary-hover text-white font-medium text-sm cursor-pointer transition-colors disabled:opacity-50"
							>
								{finishMatchMutation.isPending
									? 'Salvando...'
									: 'Salvar alterações'}
							</button>
						</>
					) : (
						<button
							type="button"
							disabled={finishMatchMutation.isPending}
							onClick={() => {
								if (
									window.confirm(
										`Encerrar partida com placar ${homeTeamName} ${homeScore} × ${awayScore} ${awayTeamName}?`,
									)
								) {
									finishMatchMutation.mutate({ redirect: true });
								}
							}}
							className="min-h-[40px] px-4 rounded-[10px] border border-border bg-surface hover:bg-nav-hover text-main font-medium text-sm cursor-pointer transition-colors"
						>
							{finishMatchMutation.isPending
								? 'Encerrando...'
								: 'Encerrar partida'}
						</button>
					)}
				</div>
			</div>

			{/* Hero Scoreboard */}
			<section className="bg-surface border border-border shadow-xs rounded-[16px] grid grid-cols-[1fr_auto_1fr] items-center gap-6 px-6 sm:px-8 py-7">
				<div className="text-right min-w-0">
					<div className="text-lg sm:text-xl font-semibold text-main truncate flex items-center justify-end gap-2">
						<span className="truncate">{homeTeamName}</span>
						<TeamColorTag color={homeTeam?.color} fallbackIndex={0} />
					</div>
					<div className="text-[13px] text-muted">Mandante</div>
				</div>

				<div className="flex flex-col items-center gap-1.5">
					<div className="flex items-center gap-4 sm:gap-6 text-[44px] sm:text-[60px] font-bold leading-none tabular-nums text-main">
						<div className="flex items-center gap-2">
							{!readOnly && (
								<button
									type="button"
									title="Diminuir gol do mandante (-1)"
									disabled={homeScore <= 0 || updateScoreMutation.isPending}
									onClick={() => handleAdjustScore('home', -1)}
									className="w-7 h-7 sm:w-8 sm:h-8 rounded-full border border-border bg-background hover:bg-nav-hover text-sm text-muted hover:text-main flex items-center justify-center cursor-pointer transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
								>
									−
								</button>
							)}
							<span>{homeScore}</span>
							{!readOnly && (
								<button
									type="button"
									title="Aumentar gol do mandante (+1)"
									disabled={updateScoreMutation.isPending}
									onClick={() => handleAdjustScore('home', 1)}
									className="w-7 h-7 sm:w-8 sm:h-8 rounded-full border border-border bg-background hover:bg-nav-hover text-sm text-muted hover:text-main flex items-center justify-center cursor-pointer transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
								>
									+
								</button>
							)}
						</div>

						<span className="text-[26px] text-muted">×</span>

						<div className="flex items-center gap-2">
							{!readOnly && (
								<button
									type="button"
									title="Diminuir gol do visitante (-1)"
									disabled={awayScore <= 0 || updateScoreMutation.isPending}
									onClick={() => handleAdjustScore('away', -1)}
									className="w-7 h-7 sm:w-8 sm:h-8 rounded-full border border-border bg-background hover:bg-nav-hover text-sm text-muted hover:text-main flex items-center justify-center cursor-pointer transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
								>
									−
								</button>
							)}
							<span>{awayScore}</span>
							{!readOnly && (
								<button
									type="button"
									title="Aumentar gol do visitante (+1)"
									disabled={updateScoreMutation.isPending}
									onClick={() => handleAdjustScore('away', 1)}
									className="w-7 h-7 sm:w-8 sm:h-8 rounded-full border border-border bg-background hover:bg-nav-hover text-sm text-muted hover:text-main flex items-center justify-center cursor-pointer transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
								>
									+
								</button>
							)}
						</div>
					</div>
					{!readOnly && (
						<div className="text-[11px] text-muted tracking-wide">
							Ajuste manual do placar (+ / −)
						</div>
					)}
				</div>

				<div className="text-left min-w-0">
					<div className="text-lg sm:text-xl font-semibold text-main truncate flex items-center gap-2">
						<span className="truncate">{awayTeamName}</span>
						<TeamColorTag color={awayTeam?.color} fallbackIndex={1} />
					</div>
					<div className="text-[13px] text-muted">Visitante</div>
				</div>
			</section>

			{/* Card: Quem estava filmando */}
			<section className="bg-surface border border-border rounded-[16px] p-5 sm:p-6 flex flex-col gap-3.5">
				<div className="flex flex-wrap items-center justify-between gap-2">
					<div>
						<h2 className="m-0 text-base font-semibold text-main flex items-center gap-2">
							<span>🎥 Quem estava filmando</span>
						</h2>
						<p className="m-0 mt-0.5 text-xs text-muted">
							Selecione o jogador responsável pela gravação desta
							partida (soma pontos de câmera na temporada).
						</p>
					</div>

					{currentCameramanLabel ? (
						<span className="inline-flex items-center gap-2 text-xs font-semibold px-3 py-1.5 rounded-full bg-blue-500/15 border border-blue-500/30 text-primary">
							<span className="w-2 h-2 rounded-full bg-primary" />
							Filmando: {currentCameramanLabel}
						</span>
					) : (
						<span className="inline-flex items-center gap-1.5 text-xs font-medium px-3 py-1 rounded-full bg-surface border border-border text-muted">
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
								disabled={readOnly || updateCameramanMutation.isPending}
								onClick={() =>
									updateCameramanMutation.mutate(
										player.id_player,
									)
								}
								className={`min-h-[38px] px-3.5 rounded-[10px] border inline-flex items-center gap-2 text-sm transition-colors cursor-pointer disabled:opacity-50 ${isSelected
									? 'bg-primary border-primary text-white font-semibold'
									: 'border-border bg-surface hover:bg-nav-hover text-main font-medium'
									}`}
							>
								<span>{player.apelido || player.nome}</span>
								{teamName && (
									<span
										className={`text-[11px] px-1.5 py-0.5 rounded ${isSelected
											? 'bg-white/20 text-white'
											: 'bg-muted/10 text-muted'
											}`}
									>
										{teamName}
									</span>
								)}
							</button>
						);
					})}

					{!readOnly && otherCameramen.length > 0 && (
						<button
							type="button"
							onClick={() =>
								setShowExtraCameramen((prev) => !prev)
							}
							className="min-h-[38px] px-3.5 rounded-[10px] border border-dashed border-border bg-surface hover:bg-nav-hover text-muted inline-flex items-center text-sm font-medium cursor-pointer transition-colors"
						>
							Outros jogadores {showExtraCameramen ? '⌃' : '⌄'}
						</button>
					)}
				</div>

				{showExtraCameramen && otherCameramen.length > 0 && (
					<div className="pt-3 border-t border-border flex flex-col gap-2.5">
						<input
							type="text"
							value={cameramanSearch}
							onChange={(e) => setCameramanSearch(e.target.value)}
							placeholder="Buscar jogador para câmera..."
							className="w-full sm:max-w-xs min-h-[36px] px-3 rounded-[9px] bg-background border border-border text-main placeholder:text-muted text-xs focus:outline-none focus:border-primary"
						/>
						<div className="flex flex-wrap gap-1.5 max-h-40 overflow-y-auto">
							{filteredOtherCameramen.map((p) => {
								const isSelected =
									currentCameramanPlayerId === p.id_player;
								return (
									<button
										key={p.id_player}
										type="button"
										disabled={readOnly || updateCameramanMutation.isPending}
										onClick={() =>
											updateCameramanMutation.mutate(
												p.id_player,
											)
										}
										className={`min-h-[34px] px-3 rounded-lg border inline-flex items-center text-xs transition-colors cursor-pointer disabled:opacity-50 ${isSelected
											? 'bg-primary border-primary text-white font-semibold'
											: 'border-border bg-surface hover:bg-nav-hover text-muted'
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
			<div className={`grid grid-cols-1 gap-5 items-start ${readOnly ? '' : 'lg:grid-cols-2'}`}>
				{/* Left Card: Registrar evento */}
				{!readOnly && (
					<section className="bg-surface border border-border rounded-[16px] p-6 flex flex-col gap-[22px]">
						<h2 className="m-0 text-base font-semibold text-main">
							Registrar evento
						</h2>

						{/* TIME Segmented Control */}
						<div>
							<div className="text-xs tracking-[0.08em] text-muted font-semibold mb-2.5 uppercase">
								TIME
							</div>
							<div className="flex bg-background border border-border rounded-[10px] p-[3px]">
								<button
									type="button"
									onClick={() => handleSelectSide('home')}
									className={`flex-1 text-center py-[9px] px-3 rounded-[7px] font-semibold text-sm transition-colors cursor-pointer truncate ${selectedSide === 'home'
										? 'bg-primary/20 text-primary'
										: 'text-muted hover:text-main'
										}`}
								>
									{homeTeamName}
								</button>
								<button
									type="button"
									onClick={() => handleSelectSide('away')}
									className={`flex-1 text-center py-[9px] px-3 rounded-[7px] font-semibold text-sm transition-colors cursor-pointer truncate ${selectedSide === 'away'
										? 'bg-primary/20 text-primary'
										: 'text-muted hover:text-main'
										}`}
								>
									{awayTeamName}
								</button>
							</div>
						</div>

						{/* JOGADOR Pills */}
						<div>
							<div className="text-xs tracking-[0.08em] text-muted font-semibold mb-2.5 uppercase">
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
													setAssistMode('none');
												}
											}}
											className={`min-h-[40px] px-4 rounded-[10px] border inline-flex items-center text-sm transition-colors cursor-pointer ${isSelected
												? 'bg-primary border-primary text-white font-semibold'
												: 'border-border bg-surface hover:bg-nav-hover text-main font-medium'
												}`}
										>
											{p.apelido || p.nome}
										</button>
									);
								})}

								{/* Jogador emprestado selecionado fora do roster */}
								{selectedPlayerId &&
									!activeRoster.some((p) => p.id_player === selectedPlayerId) &&
									playerMap.has(selectedPlayerId) && (
										<button
											type="button"
											className="min-h-[40px] px-4 rounded-[10px] border inline-flex items-center gap-1.5 text-sm transition-colors cursor-pointer bg-primary border-primary text-white font-semibold"
										>
											<span>
												{playerMap.get(selectedPlayerId)?.apelido ||
													playerMap.get(selectedPlayerId)?.nome}
											</span>
											<span className="text-[10px] px-1.5 py-0.5 rounded bg-white/20 text-white font-normal">
												Emprestado
											</span>
										</button>
									)}

								{extraPlayers.length > 0 && (
									<button
										type="button"
										onClick={() =>
											setShowExtraPlayers((prev) => !prev)
										}
										className="min-h-[40px] px-4 rounded-[10px] border border-dashed border-border bg-surface hover:bg-nav-hover text-muted inline-flex items-center text-sm font-medium cursor-pointer transition-colors"
									>
										Outros jogadores {showExtraPlayers ? '⌃' : '⌄'}
									</button>
								)}
							</div>

							{showExtraPlayers && extraPlayers.length > 0 && (
								<div className="mt-2.5 pt-2.5 border-t border-border flex flex-wrap gap-1.5 max-h-36 overflow-y-auto">
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
														setAssistMode('none');
													}
												}}
												className={`min-h-[34px] px-3 rounded-lg border inline-flex items-center text-xs transition-colors cursor-pointer ${isSelected
													? 'bg-primary border-primary text-white font-semibold'
													: 'border-border bg-surface hover:bg-nav-hover text-muted'
													}`}
											>
												{p.apelido || p.nome}
											</button>
										);
									})}
								</div>
							)}
						</div>

						{/* ASSISTÊNCIA OU OURO (OPCIONAL) */}
						<div className="flex flex-col gap-2.5 bg-background border border-border rounded-[12px] p-3.5">
							<div className="flex items-center justify-between">
								<div className="text-xs tracking-[0.08em] text-muted font-semibold uppercase">
									ASSISTÊNCIA OU OURO (OPCIONAL)
								</div>
								{selectedAssistId !== null && (
									<button
										type="button"
										onClick={() => {
											setSelectedAssistId(null);
											setAssistMode('none');
										}}
										className="text-xs text-muted hover:text-red-500 underline cursor-pointer bg-transparent border-0"
									>
										Limpar seleção
									</button>
								)}
							</div>

							{/* 3 Modos: Sem assistência | Assistência | Ouro */}
							<div className="grid grid-cols-3 gap-2">
								<button
									type="button"
									onClick={() => {
										setAssistMode('none');
										setSelectedAssistId(null);
										setShowExtraAssist(false);
										setShowExtraOuro(false);
									}}
									className={`min-h-[38px] px-2 rounded-[8px] border text-xs sm:text-sm font-medium transition-colors cursor-pointer flex items-center justify-center ${assistMode === 'none'
										? 'bg-primary/15 border-primary text-primary font-semibold'
										: 'border-border bg-surface hover:bg-nav-hover text-muted'
										}`}
								>
									Sem assistência
								</button>
								<button
									type="button"
									onClick={() => {
										setAssistMode('assistencia');
										setSelectedAssistId(null);
										setShowExtraOuro(false);
									}}
									className={`min-h-[38px] px-2 rounded-[8px] border text-xs sm:text-sm font-medium transition-colors cursor-pointer flex items-center justify-center gap-1.5 ${assistMode === 'assistencia'
										? 'bg-primary/20 border-primary/60 text-primary font-semibold'
										: 'border-border bg-surface hover:bg-nav-hover text-muted'
										}`}
								>
									<span className="w-2 h-2 rounded-full bg-primary shrink-0" />
									<span>Assistência</span>
								</button>
								<button
									type="button"
									onClick={() => {
										setAssistMode('ouro');
										setSelectedAssistId(null);
										setShowExtraAssist(false);
									}}
									className={`min-h-[38px] px-2 rounded-[8px] border text-xs sm:text-sm font-medium transition-colors cursor-pointer flex items-center justify-center gap-1.5 ${assistMode === 'ouro'
										? 'bg-primary/20 border-primary/60 text-primary font-semibold'
										: 'border-border bg-surface hover:bg-nav-hover text-muted'
										}`}
								>
									<span className="w-[8px] h-2.5 rounded-[2px] bg-primary shrink-0" />
									<span>Ouro (falha)</span>
								</button>
							</div>

							{/* Lista de jogadores quando Assistência está ativo */}
							{assistMode === 'assistencia' && (
								<div className="flex flex-col gap-2 pt-1 border-t border-border mt-1">
									<div className="text-[11px] text-muted">
										Selecione o companheiro (ou emprestado) que deu o passe:
									</div>
									<div className="flex flex-wrap gap-2">
										{assistPrimaryRoster.map((p) => {
											const isSelected = selectedAssistId === p.id_player;
											return (
												<button
													key={`assist-prim-${p.id_player}`}
													type="button"
													onClick={() => {
														setSelectedAssistId(isSelected ? null : p.id_player);
													}}
													className={`min-h-[36px] px-3 rounded-[8px] border inline-flex items-center gap-1.5 text-xs sm:text-sm transition-colors cursor-pointer ${isSelected
														? 'bg-primary/25 border-primary/70 text-primary font-semibold'
														: 'border-border bg-surface hover:bg-nav-hover text-main'
														}`}
												>
													<span>{p.apelido || p.nome}</span>
												</button>
											);
										})}

										{/* Jogador emprestado selecionado fora do roster primário */}
										{selectedAssistId &&
											!assistPrimaryRoster.some((p) => p.id_player === selectedAssistId) &&
											playerMap.has(selectedAssistId) && (
												<button
													type="button"
													onClick={() => setSelectedAssistId(null)}
													className="min-h-[36px] px-3 rounded-[8px] border inline-flex items-center gap-1.5 text-xs sm:text-sm transition-colors cursor-pointer bg-primary/25 border-primary/70 text-primary font-semibold"
												>
													<span>
														{playerMap.get(selectedAssistId)?.apelido ||
															playerMap.get(selectedAssistId)?.nome}
													</span>
													<span className="text-[10px] px-1.5 py-0.5 rounded bg-blue-400/30 text-white font-normal">
														Emprestado
													</span>
												</button>
											)}

										{assistOtherPlayers.length > 0 && (
											<button
												type="button"
												onClick={() => setShowExtraAssist((prev) => !prev)}
												className="min-h-[36px] px-3 rounded-[8px] border border-dashed border-border bg-surface hover:bg-nav-hover text-muted inline-flex items-center text-xs sm:text-sm font-medium cursor-pointer transition-colors"
											>
												{showExtraAssist ? 'Ocultar outros ⌃' : 'Outros jogadores ⌄'}
											</button>
										)}
									</div>

									{showExtraAssist && assistOtherPlayers.length > 0 && (
										<div className="mt-1 pt-2 border-t border-border flex flex-wrap gap-1.5 max-h-36 overflow-y-auto">
											{assistOtherPlayers.map((p) => {
												const isSelected = selectedAssistId === p.id_player;
												const teamName = playerTeamMap.get(p.id_player);
												return (
													<button
														key={`assist-oth-${p.id_player}`}
														type="button"
														onClick={() => {
															setSelectedAssistId(isSelected ? null : p.id_player);
														}}
														className={`min-h-[32px] px-2.5 rounded-lg border inline-flex items-center gap-1.5 text-xs transition-colors cursor-pointer ${isSelected
															? 'bg-primary/25 border-primary/70 text-primary font-semibold'
															: 'border-dashed border-border bg-surface hover:bg-nav-hover text-muted'
															}`}
													>
														<span>{p.apelido || p.nome}</span>
														{teamName && (
															<span
																className={`text-[10px] px-1 py-0.2 rounded ${isSelected
																	? 'bg-primary/20 text-primary'
																	: 'bg-muted/10 text-muted'
																	}`}
															>
																{teamName}
															</span>
														)}
													</button>
												);
											})}
										</div>
									)}
								</div>
							)}

							{/* Lista de jogadores quando Ouro está ativo */}
							{assistMode === 'ouro' && (
								<div className="flex flex-col gap-2 pt-1 border-t border-border mt-1">
									<div className="text-[11px] text-muted">
										Selecione o adversário que falhou/entregou o gol:
									</div>
									<div className="flex flex-wrap gap-2">
										{ouroPrimaryRoster.map((p) => {
											const isSelected = selectedAssistId === p.id_player;
											return (
												<button
													key={`ouro-prim-${p.id_player}`}
													type="button"
													onClick={() => {
														setSelectedAssistId(isSelected ? null : p.id_player);
													}}
													className={`min-h-[36px] px-3 rounded-[8px] border inline-flex items-center gap-2 text-xs sm:text-sm transition-colors cursor-pointer ${isSelected
														? 'bg-primary/25 border-primary/70 text-primary font-semibold'
														: 'border-dashed border-border bg-surface hover:bg-nav-hover text-muted'
														}`}
												>
													<span className="w-[8px] h-2.5 rounded-[2px] bg-primary shrink-0" />
													<span>{p.apelido || p.nome}</span>
												</button>
											);
										})}

										{/* Jogador emprestado selecionado fora do roster primário do ouro */}
										{selectedAssistId &&
											!ouroPrimaryRoster.some((p) => p.id_player === selectedAssistId) &&
											playerMap.has(selectedAssistId) && (
												<button
													type="button"
													onClick={() => setSelectedAssistId(null)}
													className="min-h-[36px] px-3 rounded-[8px] border inline-flex items-center gap-1.5 text-xs sm:text-sm transition-colors cursor-pointer bg-primary/25 border-primary/70 text-primary font-semibold"
												>
													<span className="w-[8px] h-2.5 rounded-[2px] bg-primary shrink-0" />
													<span>
														{playerMap.get(selectedAssistId)?.apelido ||
															playerMap.get(selectedAssistId)?.nome}
													</span>
													<span className="text-[10px] px-1.5 py-0.5 rounded bg-blue-400/30 text-white font-normal">
														Emprestado
													</span>
												</button>
											)}

										{ouroOtherPlayers.length > 0 && (
											<button
												type="button"
												onClick={() => setShowExtraOuro((prev) => !prev)}
												className="min-h-[36px] px-3 rounded-[8px] border border-dashed border-border bg-surface hover:bg-nav-hover text-muted inline-flex items-center text-xs sm:text-sm font-medium cursor-pointer transition-colors"
											>
												{showExtraOuro ? 'Ocultar outros ⌃' : 'Outros jogadores ⌄'}
											</button>
										)}
									</div>

									{showExtraOuro && ouroOtherPlayers.length > 0 && (
										<div className="mt-1 pt-2 border-t border-border flex flex-wrap gap-1.5 max-h-36 overflow-y-auto">
											{ouroOtherPlayers.map((p) => {
												const isSelected = selectedAssistId === p.id_player;
												const teamName = playerTeamMap.get(p.id_player);
												return (
													<button
														key={`ouro-oth-${p.id_player}`}
														type="button"
														onClick={() => {
															setSelectedAssistId(isSelected ? null : p.id_player);
														}}
														className={`min-h-[32px] px-2.5 rounded-lg border inline-flex items-center gap-1.5 text-xs transition-colors cursor-pointer ${isSelected
															? 'bg-primary/25 border-primary/70 text-primary font-semibold'
															: 'border-dashed border-border bg-surface hover:bg-nav-hover text-muted'
															}`}
													>
														<span className="w-[7px] h-2.5 rounded-[2px] bg-primary shrink-0" />
														<span>{p.apelido || p.nome}</span>
														{teamName && (
															<span
																className={`text-[10px] px-1 py-0.2 rounded ${isSelected
																	? 'bg-primary/20 text-primary'
																	: 'bg-muted/10 text-muted'
																	}`}
															>
																{teamName}
															</span>
														)}
													</button>
												);
											})}
										</div>
									)}
								</div>
							)}
						</div>

						{/* Feedback Visual Imediato */}
						{actionFeedback && (
							<div
								className={`p-3 rounded-[10px] text-sm font-semibold flex items-center justify-between transition-all animate-in fade-in slide-in-from-top-1 ${actionFeedback.type === 'success'
									? 'bg-emerald-500/20 border border-emerald-500/40 text-emerald-300'
									: 'bg-rose-500/20 border border-rose-500/40 text-rose-300'
									}`}
							>
								<div className="flex items-center gap-2">
									<span>{actionFeedback.type === 'success' ? '✓' : '⚠'}</span>
									<span>{actionFeedback.message}</span>
								</div>
								<button
									type="button"
									onClick={() => setActionFeedback(null)}
									className="text-xs opacity-70 hover:opacity-100 cursor-pointer ml-2"
								>
									✕
								</button>
							</div>
						)}

						{/* EVENTO PARA JOGADOR */}
						<div>
							<div className="text-xs tracking-[0.08em] text-[#64748b] font-semibold mb-2.5 uppercase">
								EVENTO PARA {selectedPlayerLabel}
							</div>

							<button
								type="button"
								disabled={
									!selectedPlayerId || eventMutation.isPending || isSubmittingCooldown
								}
								onClick={() => handleRegisterEvent('gol')}
								className="w-full min-h-[52px] rounded-[10px] border border-[#16a34a] bg-[#16a34a] hover:bg-green-500 disabled:opacity-45 disabled:cursor-not-allowed text-white font-semibold text-base flex items-center justify-center gap-2 cursor-pointer transition-colors"
							>
								{eventMutation.isPending
									? 'Registrando gol...'
									: assistIsOuro
										? 'Registrar gol (com ouro)'
										: assistMode === 'assistencia' && selectedAssistId
											? 'Registrar gol (com assistência)'
											: 'Registrar gol'}
							</button>

						<div className="grid grid-cols-3 gap-3.5 mt-3.5">
							<button
								type="button"
								disabled={
									!selectedPlayerId || eventMutation.isPending || isSubmittingCooldown
								}
								onClick={() =>
									handleRegisterEvent('cartao_amarelo')
								}
								className="min-h-[48px] rounded-[10px] border border-border bg-surface hover:bg-nav-hover disabled:opacity-45 disabled:cursor-not-allowed text-main font-semibold text-sm flex items-center justify-center gap-2 cursor-pointer transition-colors"
							>
								<span className="w-[11px] h-[15px] rounded-[2px] bg-[#facc15] inline-block" />
								Amarelo
							</button>

							<button
								type="button"
								disabled={
									!selectedPlayerId || eventMutation.isPending || isSubmittingCooldown
								}
								onClick={() =>
									handleRegisterEvent('cartao_vermelho')
								}
								className="min-h-[48px] rounded-[10px] border border-border bg-surface hover:bg-nav-hover disabled:opacity-45 disabled:cursor-not-allowed text-main font-semibold text-sm flex items-center justify-center gap-2 cursor-pointer transition-colors"
							>
								<span className="w-[11px] h-[15px] rounded-[2px] bg-[#ef4444] inline-block" />
								Vermelho
							</button>

							<button
								type="button"
								disabled={
									!selectedPlayerId || eventMutation.isPending || isSubmittingCooldown
								}
								onClick={() =>
									handleRegisterEvent('gol_contra')
								}
								className="min-h-[48px] rounded-[10px] border border-border bg-surface hover:bg-nav-hover disabled:opacity-45 disabled:cursor-not-allowed text-main font-semibold text-sm flex items-center justify-center gap-2 cursor-pointer transition-colors"
							>
								Gol contra
							</button>
						</div>

						<div className="text-muted mt-2.5 text-xs">
							Gol contra conta para {opponentTeamName}.
						</div>
					</div>
					</section>
				)}

			{/* Right Card: Linha do tempo */}
			<section className="bg-surface border border-border rounded-[16px] p-6 flex flex-col">
				<div className="flex justify-between items-baseline mb-2">
					<h2 className="m-0 text-base font-semibold text-main">
						Linha do tempo
					</h2>
					<span className="text-[13px] text-muted">
						{timelineEntries.length}{' '}
						{timelineEntries.length === 1
							? 'evento'
							: 'eventos'}
					</span>
				</div>

				{timelineEntries.length === 0 ? (
					<div className="py-6 text-[13px] text-muted">
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

							const isHome =
								evt.team_id != null
									? evt.team_id === match.home_team_id
									: homePlayerIds.has(evt.player_id);
							const isAway =
								evt.team_id != null
									? evt.team_id === match.away_team_id
									: awayPlayerIds.has(evt.player_id);

							const registeredTeamName = playerTeamMap.get(evt.player_id);
							const eventTeamName = isHome
								? homeTeamName
								: isAway
									? awayTeamName
									: '';
							const isLoaned =
								Boolean(registeredTeamName) &&
								registeredTeamName !== eventTeamName;

							const playerTeamLabel = eventTeamName;

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
									<div className="w-7 h-7 rounded-full flex-none flex items-center justify-center text-xs font-bold bg-blue-500/[0.16] text-primary">
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
										const assistKind = entry.assistEvent?.event_type === 'ouro' ? 'Ouro' : 'Assistência';
										return `${assistKind}: ${assistLabel} · ${scorePart}`;
									}
									return scorePart;
								}
								return playerTeamLabel || `Lance #${evt.play_id ?? idx + 1}`;
							})();

							return (
								<div
									key={entry.key}
									className={`flex gap-3 py-3 items-start ${idx > 0
										? 'border-t border-border'
										: ''
										}`}
								>
									{renderBadge()}
									<div className="min-w-0 flex-1">
										<div className="font-semibold text-sm text-main flex items-center gap-1.5 flex-wrap">
											<span>
												{EVENT_TITLES[evt.event_type] ??
													evt.event_type}{' '}
												· {playerLabel}
											</span>
											{isLoaned && (
												<span className="text-[10px] px-1.5 py-0.5 rounded bg-blue-500/20 text-primary border border-blue-500/40 font-normal">
													Emprestado
												</span>
											)}
										</div>
										<div className="text-[13px] text-muted">
											{subtitle}
										</div>
									</div>
									{!readOnly && (
										<button
											type="button"
											disabled={deleteEntryMutation.isPending}
											onClick={() =>
												deleteEntryMutation.mutate(
													entry,
												)
											}
											className="ml-auto bg-transparent border-0 text-muted hover:text-red-500 font-medium text-xs cursor-pointer px-1.5 py-1 underline shrink-0 transition-colors"
										>
											Desfazer
										</button>
									)}
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
