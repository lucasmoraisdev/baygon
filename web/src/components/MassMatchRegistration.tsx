'use client';

import { FormField } from '@/components/FormField';
import { Loading } from '@/components/Loading';
import { Select } from '@/components/Select';
import { TeamColorTag } from '@/components/TeamColorTag';
import { getTeamColor } from '@/lib/teamColors';
import { fetchAPI } from '@/lib/api';
import { Player, RoulettePrize, RoundRouletteWinner, Season, Team } from '@/types/types';
import { useMutation, useQueries, useQueryClient } from '@tanstack/react-query';
import {
	Award as AwardIcon,
	Camera,
	Check,
	Gift,
	Medal,
	Pencil,
	Plus,
	RotateCcw,
	Settings,
	Sparkles,
	Trash2,
	Trophy,
	Users,
	X,
	Zap,
} from 'lucide-react';
import React, { useEffect, useMemo, useState } from 'react';

interface GoalSlot {
	id: string;
	playerId: number | null;
	isOwnGoal: boolean;
	teamSide: 'home' | 'away'; // time que pontua
	assistMode: 'none' | 'assistencia' | 'ouro';
	assistPlayerId: number | null;
}

interface MatchRowState {
	key: string;
	id_match?: number;
	homeTeamId: number | null;
	awayTeamId: number | null;
	goals: GoalSlot[];
	cameramanPlayerId: number | null;
	isConfirmed: boolean;
	isEditing: boolean;
}

interface AwardConfig {
	event_type: string;
	label: string;
	target: 'player' | 'team';
	icon: string;
}

const AWARD_CATALOG: AwardConfig[] = [
	{ event_type: 'time_vencedor_rodada', label: 'Time Vencedor da Rodada (Pizza)', target: 'team', icon: '🏆' },
	{ event_type: 'bola_cheia', label: 'Bola Cheia (MVP)', target: 'player', icon: '🌟' },
	{ event_type: 'bola_murcha', label: 'Bola Murcha', target: 'player', icon: '💩' },
	{ event_type: 'gol_rodada', label: 'Gol da Rodada', target: 'player', icon: '⚽' },
	{ event_type: 'defesa_rodada', label: 'Defesa da Rodada', target: 'player', icon: '🧤' },
	{ event_type: 'drible_rodada', label: 'Drible da Rodada', target: 'player', icon: '🌀' },
	{ event_type: 'inacreditavel', label: 'Inacreditável', target: 'player', icon: '😱' },
	{ event_type: 'goleiro_menos_vazado', label: 'Goleiro Menos Vazado', target: 'player', icon: '🥅' },
	{ event_type: 'roleta_1', label: 'Roleta 1', target: 'player', icon: '🎰' },
	{ event_type: 'roleta_2', label: 'Roleta 2', target: 'player', icon: '🎰' },
];

export function MassMatchRegistration({
	roundId,
	onClose,
	onSuccess,
}: {
	roundId: number | string;
	onClose?: () => void;
	onSuccess?: () => void;
}) {
	const queryClient = useQueryClient();
	const rId = String(roundId);

	// Queries
	const [
		roundQuery,
		teamsQuery,
		matchesQuery,
		playersQuery,
		awardsQuery,
		scoresQuery,
		roulettePrizesQuery,
		roundRouletteQuery,
	] = useQueries({
		queries: [
			{
				queryKey: ['round', rId],
				queryFn: () => fetchAPI(`/rounds/${rId}`),
			},
			{
				queryKey: ['teams', 'round', rId],
				queryFn: () => fetchAPI(`/teams/round/${rId}`).catch(() => []),
				staleTime: 0,
				refetchOnMount: 'always',
			},
			{
				queryKey: ['matches', 'round', rId],
				queryFn: () => fetchAPI(`/matches/round/${rId}`).catch(() => []),
			},
			{
				queryKey: ['players'],
				queryFn: () => fetchAPI('/players/').catch(() => []),
			},
			{
				queryKey: ['awards', 'round', rId],
				queryFn: () => fetchAPI(`/awards/round/${rId}`).catch(() => []),
			},
			{
				queryKey: ['rankings', 'round', rId],
				queryFn: () => fetchAPI(`/rankings/round/${rId}`).catch(() => []),
			},
			{
				queryKey: ['roulette-prizes'],
				queryFn: () => fetchAPI('/roulette-prizes/').catch(() => []),
			},
			{
				queryKey: ['round-roulette', rId],
				queryFn: () => fetchAPI(`/roulette-prizes/round/${rId}`).catch(() => []),
			},
		],
	});

	const round = roundQuery.data;
	const teams: Team[] = teamsQuery.data ?? [];
	const existingMatches: any[] = matchesQuery.data ?? [];
	const allPlayers: Player[] = playersQuery.data ?? [];
	const existingAwards: any[] = awardsQuery.data ?? [];
	const existingScores: any[] = scoresQuery.data ?? [];
	const roulettePrizes: RoulettePrize[] = roulettePrizesQuery.data ?? [];
	const existingRoundRoulette: RoundRouletteWinner[] = roundRouletteQuery.data ?? [];

	// Estado da seleção de prêmios ganhos na Roleta 1 e Roleta 2
	const [rouletteSelections, setRouletteSelections] = useState<
		Record<'roleta_1' | 'roleta_2', { prize_id: number | null }>
	>({
		roleta_1: { prize_id: null },
		roleta_2: { prize_id: null },
	});
	const [isPrizeModalOpen, setIsPrizeModalOpen] = useState(false);
	const [newPrizeName, setNewPrizeName] = useState('');
	const [newPrizeDesc, setNewPrizeDesc] = useState('');

	// Mapeamentos rápidos
	const playerMap = useMemo(() => {
		const m = new Map<number, Player>();
		for (const p of allPlayers) m.set(p.id_player, p);
		return m;
	}, [allPlayers]);

	const teamMap = useMemo(() => {
		const m = new Map<number, Team>();
		for (const t of teams) m.set(t.id_team, t);
		return m;
	}, [teams]);

	const playerTeamInRoundMap = useMemo(() => {
		const m = new Map<number, { id_team: number; name: string }>();
		for (const t of teams) {
			for (const p of t.players ?? []) {
				m.set(p.id_player, { id_team: t.id_team, name: t.name });
			}
		}
		return m;
	}, [teams]);

	// Estado das linhas da tabela de partidas
	const [rows, setRows] = useState<MatchRowState[]>([]);
	const [activeGoalModal, setActiveGoalModal] = useState<{
		rowKey: string;
		goalIndex: number;
	} | null>(null);

	// Estado das premiações
	const [selectedAwards, setSelectedAwards] = useState<
		Record<string, { player_id?: number | null; team_id?: number | null }>
	>({});

	// Estado dos pontos de colaboração (player_id -> pontos)
	const [collabPoints, setCollabPoints] = useState<Record<number, number>>({});
	const [collabNotes, setCollabNotes] = useState<Record<number, string>>({});
	const [selectedCollabPlayerId, setSelectedCollabPlayerId] = useState<string>('');

	// Jogadores disponíveis para adicionar colaboração (remove quem já foi adicionado)
	const availableCollabPlayers = useMemo(() => {
		return allPlayers.filter((p) => collabPoints[p.id_player] === undefined);
	}, [allPlayers, collabPoints]);

	// Estado dos Ouros da Rodada (player_id -> quantidade de ouros)
	const [roundOuros, setRoundOuros] = useState<Record<number, number>>({});
	const [selectedOuroPlayerId, setSelectedOuroPlayerId] = useState<string>('');

	// Jogadores disponíveis para adicionar ouros
	const availableOuroPlayers = useMemo(() => {
		return allPlayers.filter((p) => roundOuros[p.id_player] === undefined);
	}, [allPlayers, roundOuros]);

	// Estado de Jogadores Extras / Emprestados (player_id -> { wins, draws, losses })
	const [extraPlayerStats, setExtraPlayerStats] = useState<
		Record<number, { wins: number; draws: number; losses: number }>
	>({});
	const [selectedExtraPlayerId, setSelectedExtraPlayerId] = useState<string>('');

	// Jogadores disponíveis para adicionar como extra
	const availableExtraPlayers = useMemo(() => {
		return allPlayers.filter((p) => extraPlayerStats[p.id_player] === undefined);
	}, [allPlayers, extraPlayerStats]);

	// Detecção automática de jogos disputados por jogadores extras a partir dos gols/assistências marcados
	const autoDetectedExtraStats = useMemo(() => {
		const playerMatchOutcomes = new Map<number, Map<string, 'win' | 'draw' | 'loss'>>();

		const teamPlayersSet = new Map<number, Set<number>>();
		for (const t of teams) {
			const set = new Set<number>();
			for (const p of t.players ?? []) set.add(p.id_player);
			teamPlayersSet.set(t.id_team, set);
		}

		for (const r of rows) {
			if (!r.isConfirmed || !r.homeTeamId || !r.awayTeamId) continue;

			const homeGoals = r.goals.filter((g) => g.teamSide === 'home').length;
			const awayGoals = r.goals.filter((g) => g.teamSide === 'away').length;

			const homeResult: 'win' | 'draw' | 'loss' =
				homeGoals > awayGoals ? 'win' : homeGoals < awayGoals ? 'loss' : 'draw';
			const awayResult: 'win' | 'draw' | 'loss' =
				awayGoals > homeGoals ? 'win' : awayGoals < homeGoals ? 'loss' : 'draw';

			const homeTeamOfficial = teamPlayersSet.get(r.homeTeamId) ?? new Set<number>();
			const awayTeamOfficial = teamPlayersSet.get(r.awayTeamId) ?? new Set<number>();

			const recordPlayerParticipation = (pid: number | null, side: 'home' | 'away') => {
				if (!pid) return;
				const isHome = side === 'home';
				const officialRoster = isHome ? homeTeamOfficial : awayTeamOfficial;
				// Se o jogador não pertence ao elenco titular desse time, ele é um jogador extra atuando pelo time
				if (!officialRoster.has(pid)) {
					const outcome = isHome ? homeResult : awayResult;
					if (!playerMatchOutcomes.has(pid)) {
						playerMatchOutcomes.set(pid, new Map());
					}
					playerMatchOutcomes.get(pid)!.set(r.key, outcome);
				}
			};

			for (const g of r.goals) {
				recordPlayerParticipation(g.playerId, g.teamSide);
				if (g.assistPlayerId) {
					recordPlayerParticipation(g.assistPlayerId, g.teamSide);
				}
			}
		}

		const result: Record<number, { wins: number; draws: number; losses: number; matchCount: number }> = {};
		playerMatchOutcomes.forEach((matchMap, pid) => {
			let wins = 0;
			let draws = 0;
			let losses = 0;
			matchMap.forEach((outcome) => {
				if (outcome === 'win') wins++;
				else if (outcome === 'draw') draws++;
				else if (outcome === 'loss') losses++;
			});
			result[pid] = { wins, draws, losses, matchCount: matchMap.size };
		});
		return result;
	}, [rows, teams]);

	const [feedbackMsg, setFeedbackMsg] = useState<{
		type: 'success' | 'error';
		message: string;
	} | null>(null);

	// Inicializa linhas baseadas em existingMatches
	useEffect(() => {
		if (!existingMatches || existingMatches.length === 0) {
			if (rows.length === 0) {
				setRows([
					{
						key: `new-${Date.now()}-0`,
						homeTeamId: null,
						awayTeamId: null,
						goals: [],
						cameramanPlayerId: null,
						isConfirmed: false,
						isEditing: true,
					},
				]);
			}
			return;
		}

		// Se já temos partidas existentes, carrega cada uma com seus eventos
		const loadInitialRows = async () => {
			const loadedRows: MatchRowState[] = [];
			for (const m of existingMatches) {
				const mId = m.id_match ?? m.id;
				let eventsList: any[] = [];
				try {
					eventsList = await fetchAPI(`/events/match/${mId}`);
				} catch {
					eventsList = [];
				}

				// Agrupar gols e assistências/ouros pelo play_id
				const goalEvents = eventsList.filter(
					(e) => e.event_type === 'gol' || e.event_type === 'gol_contra',
				);
				const assistEvents = eventsList.filter(
					(e) => e.event_type === 'assistencia' || e.event_type === 'ouro',
				);
				const assistByPlayId = new Map<number, any>();
				for (const a of assistEvents) {
					if (a.play_id) assistByPlayId.set(a.play_id, a);
				}

				const goals: GoalSlot[] = goalEvents.map((g, idx) => {
					const linkedAssist = g.play_id ? assistByPlayId.get(g.play_id) : undefined;
					const isOwnGoal = g.event_type === 'gol_contra';
					const isHomeTeam = g.team_id != null ? g.team_id === m.home_team_id : false;
					return {
						id: String(g.id_event ?? idx),
						playerId: g.player_id,
						isOwnGoal,
						teamSide: isHomeTeam ? 'home' : 'away',
						assistMode: linkedAssist
							? linkedAssist.event_type === 'ouro'
								? 'ouro'
								: 'assistencia'
							: 'none',
						assistPlayerId: linkedAssist ? linkedAssist.player_id : null,
					};
				});

				loadedRows.push({
					key: `match-${mId}`,
					id_match: mId,
					homeTeamId: m.home_team_id,
					awayTeamId: m.away_team_id,
					goals,
					cameramanPlayerId: m.filmed_by_player_id ?? null,
					isConfirmed: true,
					isEditing: false,
				});
			}

			// Sempre mantém uma linha vazia no fim para adicionar a próxima
			loadedRows.push({
				key: `new-${Date.now()}`,
				homeTeamId: null,
				awayTeamId: null,
				goals: [],
				cameramanPlayerId: null,
				isConfirmed: false,
				isEditing: true,
			});

			setRows(loadedRows);
		};

		loadInitialRows();
	}, [existingMatches.length]);

	// Inicializa premiações existentes
	useEffect(() => {
		if (existingAwards && existingAwards.length > 0) {
			const map: Record<string, { player_id?: number | null; team_id?: number | null }> = {};
			for (const aw of existingAwards) {
				if (aw.event_type === 'roleta') {
					if (aw.players?.[0]) {
						map['roleta_1'] = { player_id: aw.players[0].id_player, team_id: null };
					}
					if (aw.players?.[1]) {
						map['roleta_2'] = { player_id: aw.players[1].id_player, team_id: null };
					}
				} else {
					map[aw.event_type] = {
						player_id: aw.players?.[0]?.id_player ?? null,
						team_id: aw.teams?.[0]?.id_team ?? null,
					};
				}
			}
			setSelectedAwards(map);
		}
	}, [existingAwards]);

	// Inicializa pontos de colaboração e estatísticas de extras existentes
	useEffect(() => {
		if (existingScores && existingScores.length > 0) {
			const colMap: Record<number, number> = {};
			const extraMap: Record<number, { wins: number; draws: number; losses: number }> = {};
			for (const sc of existingScores) {
				if (sc.points_collaboration && sc.points_collaboration > 0) {
					colMap[sc.player_id] = sc.points_collaboration;
				}
				const w = sc.extra_matches_won ?? 0;
				const d = sc.extra_matches_drawn ?? 0;
				const l = sc.extra_matches_lost ?? 0;
				if (w > 0 || d > 0 || l > 0) {
					extraMap[sc.player_id] = { wins: w, draws: d, losses: l };
				}
			}
			setCollabPoints((prev) => ({ ...colMap, ...prev }));
			if (Object.keys(extraMap).length > 0) {
				setExtraPlayerStats((prev) => ({ ...extraMap, ...prev }));
			}
		}
	}, [existingScores]);

	// Carrega ouros da rodada
	useEffect(() => {
		fetchAPI(`/events/round/${rId}/ouros`)
			.then((items: Array<{ player_id: number; count: number }>) => {
				if (Array.isArray(items) && items.length > 0) {
					const map: Record<number, number> = {};
					for (const it of items) {
						map[it.player_id] = it.count;
					}
					setRoundOuros(map);
				}
			})
			.catch(() => { });
	}, [rId]);

	// Atualiza automaticamente extraPlayerStats com jogadores extras detectados em partidas confirmadas
	useEffect(() => {
		setExtraPlayerStats((prev) => {
			let changed = false;
			const next = { ...prev };
			for (const [pidStr, det] of Object.entries(autoDetectedExtraStats)) {
				const pid = Number(pidStr);
				if (!next[pid]) {
					next[pid] = { wins: det.wins, draws: det.draws, losses: det.losses };
					changed = true;
				}
			}
			return changed ? next : prev;
		});
	}, [autoDetectedExtraStats]);

	// Inicializa vencedores e prêmios da roleta salvos da rodada
	useEffect(() => {
		if (existingRoundRoulette && existingRoundRoulette.length > 0) {
			const map: Record<'roleta_1' | 'roleta_2', { prize_id: number | null }> = {
				roleta_1: { prize_id: null },
				roleta_2: { prize_id: null },
			};
			const awMap: Record<string, { player_id: number | null; team_id: number | null }> = {};
			for (const w of existingRoundRoulette) {
				const key = w.roulette_number === 2 ? 'roleta_2' : 'roleta_1';
				map[key] = { prize_id: w.prize_id ?? null };
				if (w.player_id) {
					awMap[key] = { player_id: w.player_id, team_id: null };
				}
			}
			setRouletteSelections((prev) => ({ ...prev, ...map }));
			if (Object.keys(awMap).length > 0) {
				setSelectedAwards((prev) => ({ ...prev, ...awMap }));
			}
		}
	}, [existingRoundRoulette]);

	// Mutations para gerenciar prêmios da roleta
	const createPrizeMutation = useMutation({
		mutationFn: async ({ name, description }: { name: string; description?: string }) => {
			return await fetchAPI('/roulette-prizes/', {
				method: 'POST',
				body: JSON.stringify({ name, description }),
			});
		},
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ['roulette-prizes'] });
			setNewPrizeName('');
			setNewPrizeDesc('');
		},
		onError: (err: Error) => alert(`Erro ao cadastrar prêmio: ${err.message}`),
	});

	const deletePrizeMutation = useMutation({
		mutationFn: async (prizeId: number) => {
			await fetchAPI(`/roulette-prizes/${prizeId}`, { method: 'DELETE' });
		},
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ['roulette-prizes'] });
		},
		onError: (err: Error) => alert(`Erro ao excluir prêmio: ${err.message}`),
	});

	// Sugestão de cinegrafistas para pontos de colaboração (+1 ponto)
	useEffect(() => {
		const cameramenIds = new Set<number>();
		for (const r of rows) {
			if (r.cameramanPlayerId) cameramenIds.add(r.cameramanPlayerId);
		}
		if (cameramenIds.size > 0) {
			setCollabPoints((prev) => {
				const next = { ...prev };
				cameramenIds.forEach((cid) => {
					if (!next[cid]) {
						next[cid] = 1;
					}
				});
				return next;
			});
		}
	}, [rows]);

	// Calcula placar de uma linha
	const calculateScore = (row: MatchRowState) => {
		let home = 0;
		let away = 0;
		for (const g of row.goals) {
			if (!g.playerId) continue;
			if (g.isOwnGoal) {
				// Gol contra pontua para o adversário do time selecionado
				if (g.teamSide === 'home') away += 1;
				else home += 1;
			} else {
				if (g.teamSide === 'home') home += 1;
				else away += 1;
			}
		}
		return { home, away };
	};

	// Handlers de linha
	const handleUpdateRowField = <K extends keyof MatchRowState>(
		key: string,
		field: K,
		value: MatchRowState[K],
	) => {
		setRows((prev) =>
			prev.map((r) => {
				if (r.key !== key) return r;
				const updated = { ...r, [field]: value };
				return updated;
			}),
		);
	};

	// Salvar ou confirmar uma partida individual
	const saveMatchMutation = useMutation({
		mutationFn: async (row: MatchRowState) => {
			if (!row.homeTeamId || !row.awayTeamId) {
				throw new Error('Selecione os dois times da partida.');
			}
			if (row.homeTeamId === row.awayTeamId) {
				throw new Error('O time da casa e o visitante não podem ser o mesmo.');
			}

			const { home: scoreHome, away: scoreAway } = calculateScore(row);
			const outcome =
				scoreHome > scoreAway
					? 'vitoria_mandante'
					: scoreAway > scoreHome
						? 'vitoria_visitante'
						: 'empate';

			let matchId = row.id_match;

			// 1. Criar ou atualizar partida
			if (matchId) {
				await fetchAPI(`/matches/${matchId}`, {
					method: 'PUT',
					body: JSON.stringify({
						home_team_id: row.homeTeamId,
						away_team_id: row.awayTeamId,
						score_home: scoreHome,
						score_away: scoreAway,
						event_type: outcome,
						filmed_by_player_id: row.cameramanPlayerId ?? null,
						is_finished: true,
					}),
				});

				// Limpar eventos antigos da partida para re-gravar limpo
				const oldEvents = await fetchAPI(`/events/match/${matchId}`).catch(() => []);
				for (const ev of oldEvents) {
					const eid = ev.id_event ?? ev.id_match_event;
					if (eid) {
						await fetchAPI(`/events/${eid}`, { method: 'DELETE' }).catch(() => null);
					}
				}
			} else {
				const created = await fetchAPI('/matches/', {
					method: 'POST',
					body: JSON.stringify({
						round_id: parseInt(rId, 10),
						home_team_id: row.homeTeamId,
						away_team_id: row.awayTeamId,
						score_home: scoreHome,
						score_away: scoreAway,
						event_type: outcome,
						filmed_by_player_id: row.cameramanPlayerId ?? null,
						is_finished: true,
					}),
				});
				matchId = created?.id_match ?? created?.id;

				// Garantir que is_finished: true esteja salvo
				if (matchId) {
					await fetchAPI(`/matches/${matchId}`, {
						method: 'PUT',
						body: JSON.stringify({ is_finished: true }),
					}).catch(() => null);
				}
			}

			// 2. Gravar os gols e assistências/ouros
			let playIdCounter = 1;
			for (const g of row.goals) {
				if (!g.playerId) continue;

				const targetTeamId = g.teamSide === 'home' ? row.homeTeamId : row.awayTeamId;
				const opponentTeamId = g.teamSide === 'home' ? row.awayTeamId : row.homeTeamId;

				// Salva o gol principal
				await fetchAPI('/events/', {
					method: 'POST',
					body: JSON.stringify({
						match_id: matchId,
						team_id: targetTeamId,
						event_type: g.isOwnGoal ? 'gol_contra' : 'gol',
						player_id: g.playerId,
						play_id: playIdCounter,
					}),
				});

				// Se houver assistência ou ouro
				if (g.assistMode !== 'none' && g.assistPlayerId && g.assistPlayerId !== g.playerId) {
					const assistTeamId = g.assistMode === 'ouro' ? opponentTeamId : targetTeamId;
					await fetchAPI('/events/', {
						method: 'POST',
						body: JSON.stringify({
							match_id: matchId,
							team_id: assistTeamId,
							event_type: g.assistMode,
							player_id: g.assistPlayerId,
							play_id: playIdCounter,
						}),
					});
				}

				playIdCounter++;
			}

			return { matchId, rowKey: row.key };
		},
		onSuccess: ({ matchId, rowKey }) => {
			queryClient.invalidateQueries({ queryKey: ['matches', 'round', rId] });
			queryClient.invalidateQueries({ queryKey: ['round', rId] });

			setRows((prev) => {
				const next = prev.map((r) => {
					if (r.key === rowKey) {
						return {
							...r,
							id_match: matchId,
							isConfirmed: true,
							isEditing: false,
						};
					}
					return r;
				});

				// Se confirmamos a última linha, adiciona automaticamente a próxima
				const hasOpenRow = next.some((r) => !r.isConfirmed || r.isEditing);
				if (!hasOpenRow) {
					next.push({
						key: `new-${Date.now()}`,
						homeTeamId: null,
						awayTeamId: null,
						goals: [],
						cameramanPlayerId: null,
						isConfirmed: false,
						isEditing: true,
					});
				}
				return next;
			});

			setFeedbackMsg({
				type: 'success',
				message: 'Partida salva e confirmada com sucesso!',
			});
			setTimeout(() => setFeedbackMsg(null), 3000);
		},
		onError: (err: Error) => {
			alert(`Erro ao salvar partida: ${err.message}`);
		},
	});

	// Excluir uma partida
	const deleteMatchMutation = useMutation({
		mutationFn: async (row: MatchRowState) => {
			if (row.id_match) {
				await fetchAPI(`/matches/${row.id_match}`, { method: 'DELETE' });
			}
			return row.key;
		},
		onSuccess: (deletedKey) => {
			queryClient.invalidateQueries({ queryKey: ['matches', 'round', rId] });
			setRows((prev) => {
				const filtered = prev.filter((r) => r.key !== deletedKey);
				if (filtered.length === 0) {
					filtered.push({
						key: `new-${Date.now()}`,
						homeTeamId: null,
						awayTeamId: null,
						goals: [],
						cameramanPlayerId: null,
						isConfirmed: false,
						isEditing: true,
					});
				}
				return filtered;
			});
			setFeedbackMsg({
				type: 'success',
				message: 'Partida excluída com sucesso.',
			});
			setTimeout(() => setFeedbackMsg(null), 3000);
		},
		onError: (err: Error) => alert(`Erro ao excluir: ${err.message}`),
	});

	// Finalizar Rodada: Salvar Premiações e Recalcular Pontuações
	const finalizeRoundMutation = useMutation({
		mutationFn: async () => {
			// 0. Garantir que todas as partidas confirmadas estejam salvas como encerradas (is_finished: true)
			for (const r of rows) {
				if (r.id_match && r.isConfirmed) {
					await fetchAPI(`/matches/${r.id_match}`, {
						method: 'PUT',
						body: JSON.stringify({ is_finished: true }),
					}).catch(() => null);
				}
			}

			// 1. Sincronizar Ouros da Rodada
			const ourosPayload = Object.entries(roundOuros)
				.filter(([_, count]) => count > 0)
				.map(([pidStr, count]) => ({
					player_id: Number(pidStr),
					count,
				}));

			await fetchAPI(`/events/round/${rId}/ouros`, {
				method: 'POST',
				body: JSON.stringify({ ouros: ourosPayload }),
			}).catch(() => null);

			// 2. Salvar Premiações da Rodada
			const awardsPayload = Object.entries(selectedAwards)
				.filter(([key, val]) => key !== 'roleta_1' && key !== 'roleta_2' && Boolean(val.player_id || val.team_id))
				.map(([eventType, val]) => ({
					event_type: eventType,
					player_ids: val.player_id ? [val.player_id] : [],
					team_ids: val.team_id ? [val.team_id] : [],
				}));

			// Agrupa Roleta 1 e Roleta 2 sob event_type: "roleta"
			const roletaPlayerIds: number[] = [];
			if (selectedAwards['roleta_1']?.player_id) {
				roletaPlayerIds.push(selectedAwards['roleta_1'].player_id);
			}
			if (selectedAwards['roleta_2']?.player_id) {
				if (!roletaPlayerIds.includes(selectedAwards['roleta_2'].player_id)) {
					roletaPlayerIds.push(selectedAwards['roleta_2'].player_id);
				}
			}
			if (roletaPlayerIds.length > 0) {
				awardsPayload.push({
					event_type: 'roleta',
					player_ids: roletaPlayerIds,
					team_ids: [],
				});
			}

			if (awardsPayload.length > 0) {
				await fetchAPI(`/awards/round/${rId}/batch`, {
					method: 'POST',
					body: JSON.stringify({
						awards: awardsPayload,
						recalculate_scores: false,
					}),
				});
			}

			// 2.1 Sincronizar Vencedores e Prêmios da Roleta
			const roulettePayload: Array<{ roulette_number: number; player_id: number; prize_id: number | null }> = [];
			if (selectedAwards['roleta_1']?.player_id) {
				roulettePayload.push({
					roulette_number: 1,
					player_id: selectedAwards['roleta_1'].player_id,
					prize_id: rouletteSelections['roleta_1']?.prize_id ?? null,
				});
			}
			if (selectedAwards['roleta_2']?.player_id) {
				roulettePayload.push({
					roulette_number: 2,
					player_id: selectedAwards['roleta_2'].player_id,
					prize_id: rouletteSelections['roleta_2']?.prize_id ?? null,
				});
			}

			if (roulettePayload.length > 0) {
				await fetchAPI(`/roulette-prizes/round/${rId}`, {
					method: 'POST',
					body: JSON.stringify({ winners: roulettePayload }),
				}).catch(() => null);
			}

			// 3. Calcular Pontuações com Pontos de Colaboração e Estatísticas de Jogadores Extras
			const collabPayload: Record<string, number> = {};
			for (const [pidStr, pts] of Object.entries(collabPoints)) {
				if (pts > 0) {
					collabPayload[pidStr] = pts;
				}
			}

			const extraStatsPayload: Record<string, { wins: number; draws: number; losses: number }> = {};
			for (const [pidStr, st] of Object.entries(extraPlayerStats)) {
				if (st.wins > 0 || st.draws > 0 || st.losses > 0) {
					extraStatsPayload[pidStr] = st;
				}
			}

			const calcRes = await fetchAPI(`/rules/round/${rId}/calculate-scores`, {
				method: 'POST',
				body: JSON.stringify({
					collaboration_points: collabPayload,
					extra_player_stats: extraStatsPayload,
				}),
			});

			return calcRes;
		},
		onSuccess: (res) => {
			queryClient.invalidateQueries({ queryKey: ['awards', 'round', rId] });
			queryClient.invalidateQueries({ queryKey: ['round-roulette', rId] });
			queryClient.invalidateQueries({ queryKey: ['rankings'] });
			queryClient.invalidateQueries({ queryKey: ['round', rId] });
			queryClient.invalidateQueries({ queryKey: ['events'] });

			setFeedbackMsg({
				type: 'success',
				message: `Rodada finalizada com sucesso! Pontuações calculadas para ${res.players_scored ?? 'todos os'} jogadores.`,
			});

			if (onSuccess) onSuccess();
		},
		onError: (err: Error) => {
			alert(`Erro ao finalizar rodada: ${err.message}`);
		},
	});

	if (roundQuery.isLoading || teamsQuery.isLoading) return <Loading />;

	return (
		<div className="flex flex-col gap-6 text-[#e6edf7] max-w-[1300px] w-full mx-auto animate-slide-down">
			{/* Top Bar / Header */}
			<div className="flex flex-wrap items-center justify-between gap-4 p-5 rounded-[16px] bg-[#111a2e] border border-white/[0.08]">
				<div>
					<div className="flex items-center gap-2 mb-1">
						<span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold uppercase tracking-wider bg-blue-500/20 text-[#60a5fa] border border-blue-500/30">
							Modo Admin
						</span>
						<span className="text-xs text-[#94a3b8]">
							Rodada #{round?.round_number ?? rId}
						</span>
					</div>
					<h1 className="text-xl sm:text-2xl font-bold text-white m-0 flex items-center gap-2">
						<span>⚡ Cadastro em Massa de Partidas</span>
					</h1>
					<p className="text-xs sm:text-sm text-[#94a3b8] mt-1 m-0">
						Lance todas as partidas da súmula linha a linha, registre premiações e calcule os pontos totais da rodada.
					</p>
				</div>

				<div className="flex items-center gap-3">
					{onClose && (
						<button
							type="button"
							onClick={onClose}
							className="px-4 py-2 rounded-[10px] border border-white/[0.14] bg-white/[0.03] hover:bg-white/[0.08] text-sm text-[#e6edf7] font-medium cursor-pointer transition-colors"
						>
							Voltar
						</button>
					)}
				</div>
			</div>

			{/* Banner de Feedback */}
			{feedbackMsg && (
				<div
					className={`p-4 rounded-[12px] text-sm font-semibold flex items-center justify-between transition-all ${feedbackMsg.type === 'success'
						? 'bg-emerald-500/20 border border-emerald-500/40 text-emerald-300'
						: 'bg-rose-500/20 border border-rose-500/40 text-rose-300'
						}`}
				>
					<div className="flex items-center gap-2">
						<span>{feedbackMsg.type === 'success' ? '✓' : '⚠'}</span>
						<span>{feedbackMsg.message}</span>
					</div>
					<button
						type="button"
						onClick={() => setFeedbackMsg(null)}
						className="text-xs opacity-75 hover:opacity-100 cursor-pointer"
					>
						✕
					</button>
				</div>
			)}

			{/* TABELA DE PARTIDAS */}
			<div className="bg-[#111a2e] border border-white/[0.08] rounded-[16px] overflow-hidden flex flex-col">
				<div className="px-5 py-4 border-b border-white/[0.06] flex items-center justify-between bg-white/[0.01]">
					<div>
						<h2 className="text-base font-semibold text-white m-0">
							Partidas da Rodada ({rows.filter((r) => r.isConfirmed).length} confirmada
							{rows.filter((r) => r.isConfirmed).length === 1 ? '' : 's'})
						</h2>
						<span className="text-xs text-[#94a3b8]">
							Preencha os times, os gols com assistências/ouro e o cinegrafista.
						</span>
					</div>
				</div>

				<div className="overflow-x-auto">
					<table className="w-full text-left border-collapse min-w-[1150px]">
						<thead>
							<tr className="border-b border-white/[0.08] bg-white/[0.02] text-[11px] text-[#94a3b8] uppercase tracking-wider font-semibold">
								<th className="py-3 px-3 text-center w-12">#</th>
								<th className="py-3 px-3 min-w-[240px]">Times da Partida</th>
								<th className="py-3 px-2 min-w-[125px]">Gol (1)</th>
								<th className="py-3 px-2 min-w-[125px]">Gol (2)</th>
								<th className="py-3 px-2 min-w-[125px]">Gol (3)</th>
								<th className="py-3 px-2 min-w-[125px]">Gol (4)</th>
								<th className="py-3 px-2 min-w-[125px]">Gol (5)</th>
								<th className="py-3 px-3 min-w-[150px]">Câmera</th>
								<th className="py-3 px-3 text-center min-w-[110px]">Ações</th>
							</tr>
						</thead>
						<tbody className="divide-y divide-white/[0.06] text-sm">
							{rows.map((row, rowIdx) => {
								const { home: scoreHome, away: scoreAway } = calculateScore(row);
								const homeTeam = row.homeTeamId ? teamMap.get(row.homeTeamId) : null;
								const awayTeam = row.awayTeamId ? teamMap.get(row.awayTeamId) : null;

								return (
									<tr
										key={row.key}
										className={`transition-colors ${row.isConfirmed && !row.isEditing
											? 'bg-white/[0.01] hover:bg-white/[0.02]'
											: 'bg-blue-500/[0.04]'
											}`}
									>
										{/* Número da partida */}
										<td className="py-3 px-3 text-center text-xs font-bold text-[#64748b]">
											{rowIdx + 1}
										</td>

										{/* Times ou Placar Confirmado */}
										<td className="py-3 px-3">
											{row.isConfirmed && !row.isEditing ? (
												<div className="flex items-center gap-2">
													<span className="font-bold text-white text-base flex items-center gap-2 flex-wrap">
														<span className="flex items-center gap-1.5">
															{homeTeam?.name || 'Casa'}
														</span>
														<span className="text-[#60a5fa] px-2 py-0.5 rounded-lg bg-blue-500/20 text-sm font-black border border-blue-500/30">
															{scoreHome} × {scoreAway}
														</span>
														<span className="flex items-center gap-1.5">
															{awayTeam?.name || 'Visitante'}
														</span>
													</span>
												</div>
											) : (
												<div className="flex items-center gap-2">
													<div className="flex items-center gap-1">
														<select
															value={row.homeTeamId ?? ''}
															onChange={(e) =>
																handleUpdateRowField(
																	row.key,
																	'homeTeamId',
																	e.target.value
																		? parseInt(e.target.value, 10)
																		: null,
																)
															}
															className="w-[120px] bg-[#1b2845] border border-white/[0.12] rounded-[8px] px-2 py-1.5 text-xs text-white focus:outline-none focus:border-blue-500"
														>
															<option value="">Time Casa</option>
															{teams.map((t) => (
																<option
																	key={`home-${t.id_team}`}
																	value={t.id_team}
																	disabled={t.id_team === row.awayTeamId}
																>
																	{t.name}
																</option>
															))}
														</select>
													</div>

													<span className="text-xs font-bold text-[#64748b]">×</span>

													<div className="flex items-center gap-1">
														<select
															value={row.awayTeamId ?? ''}
															onChange={(e) =>
																handleUpdateRowField(
																	row.key,
																	'awayTeamId',
																	e.target.value
																		? parseInt(e.target.value, 10)
																		: null,
																)
															}
															className="w-[120px] bg-[#1b2845] border border-white/[0.12] rounded-[8px] px-2 py-1.5 text-xs text-white focus:outline-none focus:border-blue-500"
														>
															<option value="">Time Fora</option>
															{teams.map((t) => (
																<option
																	key={`away-${t.id_team}`}
																	value={t.id_team}
																	disabled={t.id_team === row.homeTeamId}
																>
																	{t.name}
																</option>
															))}
														</select>
													</div>
												</div>
											)}
										</td>

										{/* GOLS 1 a 5 */}
										{[0, 1, 2, 3, 4].map((gIdx) => {
											const goal = row.goals[gIdx];
											const goalPlayer = goal?.playerId
												? playerMap.get(goal.playerId)
												: null;
											const assistPlayer = goal?.assistPlayerId
												? playerMap.get(goal.assistPlayerId)
												: null;

											const isRowReadOnly = row.isConfirmed && !row.isEditing;
											const goalTeam = goal ? (goal.teamSide === 'home' ? homeTeam : awayTeam) : null;
											const teamColor = getTeamColor(goalTeam?.color, 0);

											return (
												<td key={`goal-cell-${row.key}-${gIdx}`} className="py-2.5 px-2">
													{goal && goal.playerId ? (
														<div
															className={`p-1.5 rounded-[8px] border text-xs flex flex-col gap-0.5 relative group transition-all shadow-sm ${goal.isOwnGoal
																? 'bg-rose-500/15 border-rose-500/40 text-rose-200'
																: `${teamColor.goalBg} ${teamColor.goalBorder} ${teamColor.goalText}`
																}`}
														>
															<div className="flex items-center justify-between gap-1">
																<span className="font-semibold truncate max-w-[95px] flex items-center gap-1">
																	<span
																		className="w-2 h-2 rounded-full shrink-0 shadow-sm"
																		style={{ backgroundColor: teamColor.hex }}
																		title={`Colete ${teamColor.label}`}
																	/>
																	<span>{goal.isOwnGoal ? 'GC · ' : '⚽ '}</span>
																	<span className="truncate">
																		{goalPlayer?.apelido || goalPlayer?.nome}
																	</span>
																</span>
																{!isRowReadOnly && (
																	<button
																		type="button"
																		onClick={() => {
																			const newGoals = [...row.goals];
																			newGoals.splice(gIdx, 1);
																			handleUpdateRowField(
																				row.key,
																				'goals',
																				newGoals,
																			);
																		}}
																		className="text-white/60 hover:text-rose-400 text-[10px] cursor-pointer"
																	>
																		✕
																	</button>
																)}
															</div>

															<div className="text-[10px] opacity-85 truncate max-w-[110px] flex items-center gap-1">
																<span
																	className="text-[9px] px-1 py-0.2 rounded font-semibold shrink-0"
																	style={{
																		backgroundColor: `${teamColor.hex}22`,
																		color: teamColor.hex,
																	}}
																>
																	{teamColor.label}
																</span>
																<span className="truncate">
																	{goal.assistMode === 'none'
																		? 'Sem ass'
																		: goal.assistMode === 'ouro'
																			? `Ouro: ${assistPlayer?.apelido || assistPlayer?.nome || 'Adv'}`
																			: `Ass: ${assistPlayer?.apelido || assistPlayer?.nome || 'Comp'}`}
																</span>
															</div>

															{!isRowReadOnly && (
																<button
																	type="button"
																	onClick={() =>
																		setActiveGoalModal({
																			rowKey: row.key,
																			goalIndex: gIdx,
																		})
																	}
																	className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center rounded-[8px] text-[10px] font-semibold text-white transition-opacity cursor-pointer"
																>
																	Alterar
																</button>
															)}
														</div>
													) : (
														!isRowReadOnly && (
															<button
																type="button"
																disabled={!row.homeTeamId || !row.awayTeamId}
																onClick={() =>
																	setActiveGoalModal({
																		rowKey: row.key,
																		goalIndex: gIdx,
																	})
																}
																className="w-full min-h-[36px] rounded-[8px] border border-dashed border-white/[0.14] bg-white/[0.02] hover:bg-white/[0.06] text-[#94a3b8] hover:text-white text-xs font-medium flex items-center justify-center gap-1 cursor-pointer transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
															>
																<Plus size={12} />
																<span>Gol {gIdx + 1}</span>
															</button>
														)
													)}
												</td>
											);
										})}

										{/* Cinegrafista */}
										<td className="py-3 px-3">
											{row.isConfirmed && !row.isEditing ? (
												<div className="flex items-center gap-1.5 text-xs text-[#94a3b8]">
													<Camera size={13} className="text-[#60a5fa]" />
													<span className="truncate max-w-[120px]">
														{row.cameramanPlayerId
															? playerMap.get(row.cameramanPlayerId)?.apelido ||
															playerMap.get(row.cameramanPlayerId)?.nome
															: 'Ninguém'}
													</span>
												</div>
											) : (
												<select
													value={row.cameramanPlayerId ?? ''}
													onChange={(e) =>
														handleUpdateRowField(
															row.key,
															'cameramanPlayerId',
															e.target.value
																? parseInt(e.target.value, 10)
																: null,
														)
													}
													className="w-full bg-[#1b2845] border border-white/[0.12] rounded-[8px] px-2 py-1.5 text-xs text-white focus:outline-none focus:border-blue-500"
												>
													<option value="">Filmado por...</option>
													{allPlayers.map((p) => (
														<option key={`cam-${p.id_player}`} value={p.id_player}>
															{p.apelido || p.nome}
														</option>
													))}
												</select>
											)}
										</td>

										{/* Ações */}
										<td className="py-3 px-3 text-center">
											{row.isConfirmed && !row.isEditing ? (
												<div className="inline-flex items-center gap-1.5">
													<button
														type="button"
														onClick={() =>
															handleUpdateRowField(row.key, 'isEditing', true)
														}
														title="Editar partida"
														className="p-1.5 rounded-lg border border-white/[0.12] bg-white/[0.04] hover:bg-white/[0.08] text-[#94a3b8] hover:text-white cursor-pointer transition-colors"
													>
														<Pencil size={14} />
													</button>
													<button
														type="button"
														onClick={() => {
															if (confirm('Deseja excluir esta partida?')) {
																deleteMatchMutation.mutate(row);
															}
														}}
														title="Excluir partida"
														className="p-1.5 rounded-lg border border-rose-500/30 bg-rose-500/10 hover:bg-rose-500/20 text-rose-300 cursor-pointer transition-colors"
													>
														<Trash2 size={14} />
													</button>
												</div>
											) : (
												<button
													type="button"
													disabled={
														!row.homeTeamId ||
														!row.awayTeamId ||
														saveMatchMutation.isPending
													}
													onClick={() => saveMatchMutation.mutate(row)}
													className="min-h-[34px] px-3 rounded-[8px] bg-[#16a34a] hover:bg-green-500 disabled:opacity-40 disabled:cursor-not-allowed text-white font-semibold text-xs flex items-center justify-center gap-1.5 cursor-pointer transition-colors mx-auto"
												>
													<Check size={14} />
													<span>Confirmar</span>
												</button>
											)}
										</td>
									</tr>
								);
							})}
						</tbody>
					</table>
				</div>
			</div>

			{/* SEÇÃO PÓS-PARTIDAS: PREMIAÇÕES E COLABORAÇÃO */}
			<div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
				{/* 1. Premiações da Rodada */}
				<div className="p-5 rounded-[16px] bg-[#111a2e] border border-white/[0.08] flex flex-col gap-4">
					<div className="flex items-center gap-2 border-b border-white/[0.06] pb-3">
						<Trophy className="text-yellow-400" size={20} />
						<div>
							<h3 className="text-base font-bold text-white m-0">Premiações da Rodada</h3>
							<p className="text-xs text-[#94a3b8] m-0">
								Defina os destaques e vencedores da rodada.
							</p>
						</div>
					</div>

					<div className="flex flex-col gap-3.5">
						{AWARD_CATALOG.map((aw) => {
							const current = selectedAwards[aw.event_type] || {};

							return (
								<div
									key={aw.event_type}
									className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-2.5 rounded-[10px] bg-white/[0.02] border border-white/[0.05]"
								>
									<div className="flex items-center gap-2 text-xs font-semibold text-[#e6edf7]">
										<span className="text-base">{aw.icon}</span>
										<span>{aw.label}</span>
									</div>

									{aw.target === 'team' ? (
										<select
											value={current.team_id ?? ''}
											onChange={(e) => {
												const val = e.target.value
													? parseInt(e.target.value, 10)
													: null;
												setSelectedAwards((prev) => ({
													...prev,
													[aw.event_type]: { team_id: val },
												}));
											}}
											className="w-full sm:w-[200px] bg-[#1b2845] border border-white/[0.12] rounded-[8px] px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-blue-500"
										>
											<option value="">Selecionar time...</option>
											{teams.map((t) => (
												<option key={t.id_team} value={t.id_team}>
													{t.name}
												</option>
											))}
										</select>
									) : aw.event_type === 'roleta_1' || aw.event_type === 'roleta_2' ? (
										<div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 w-full sm:w-auto">
											<select
												value={current.player_id ?? ''}
												onChange={(e) => {
													const val = e.target.value
														? parseInt(e.target.value, 10)
														: null;
													setSelectedAwards((prev) => ({
														...prev,
														[aw.event_type]: { player_id: val },
													}));
												}}
												className="w-full sm:w-[170px] bg-[#1b2845] border border-white/[0.12] rounded-[8px] px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-blue-500"
											>
												<option value="">Selecionar vencedor...</option>
												{allPlayers.map((p) => {
													const tInfo = playerTeamInRoundMap.get(p.id_player);
													return (
														<option key={p.id_player} value={p.id_player}>
															{p.apelido || p.nome}
															{tInfo ? ` (${tInfo.name})` : ''}
														</option>
													);
												})}
											</select>

											<select
												value={rouletteSelections[aw.event_type as 'roleta_1' | 'roleta_2']?.prize_id ?? ''}
												onChange={(e) => {
													const val = e.target.value
														? parseInt(e.target.value, 10)
														: null;
													const key = aw.event_type as 'roleta_1' | 'roleta_2';
													setRouletteSelections((prev) => ({
														...prev,
														[key]: { prize_id: val },
													}));
												}}
												className="w-full sm:w-[170px] bg-[#1b2845] border border-yellow-500/40 rounded-[8px] px-2.5 py-1.5 text-xs text-yellow-300 focus:outline-none focus:border-yellow-500"
											>
												<option value="">🎁 Prêmio ganho...</option>
												{roulettePrizes.map((prz) => (
													<option key={prz.id_roulette_prize} value={prz.id_roulette_prize}>
														{prz.name}
													</option>
												))}
											</select>

											<button
												type="button"
												onClick={() => setIsPrizeModalOpen(true)}
												title="Cadastrar / Gerenciar Prêmios da Roleta"
												className="px-2 py-1.5 rounded-[8px] border border-yellow-500/40 bg-yellow-500/10 hover:bg-yellow-500/20 text-yellow-300 text-xs font-semibold flex items-center justify-center gap-1 cursor-pointer shrink-0 transition-colors"
											>
												<Plus size={13} />
												<span className="hidden sm:inline">Prêmio</span>
											</button>
										</div>
									) : (
										<select
											value={current.player_id ?? ''}
											onChange={(e) => {
												const val = e.target.value
													? parseInt(e.target.value, 10)
													: null;
												setSelectedAwards((prev) => ({
													...prev,
													[aw.event_type]: { player_id: val },
												}));
											}}
											className="w-full sm:w-[200px] bg-[#1b2845] border border-white/[0.12] rounded-[8px] px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-blue-500"
										>
											<option value="">Selecionar jogador...</option>
											{allPlayers.map((p) => {
												const tInfo = playerTeamInRoundMap.get(p.id_player);
												return (
													<option key={p.id_player} value={p.id_player}>
														{p.apelido || p.nome}
														{tInfo ? ` (${tInfo.name})` : ''}
													</option>
												);
											})}
										</select>
									)}
								</div>
							);
						})}
					</div>
				</div>

				{/* 2. Pontuações de Colaboração */}
				<div className="p-5 rounded-[16px] bg-[#111a2e] border border-white/[0.08] flex flex-col gap-4 h-full">
					<div className="flex items-center gap-2 border-b border-white/[0.06] pb-3">
						<Sparkles className="text-blue-400" size={20} />
						<div>
							<h3 className="text-base font-bold text-white m-0">Pontuações de Colaboração</h3>
							<p className="text-xs text-[#94a3b8] m-0">
								Pontos extras para jogadores que filmaram, levaram bola, coletes ou organizaram.
							</p>
						</div>
					</div>

					{/* Adicionar jogador para colaboração */}
					<div className="flex gap-2">
						<select
							value={selectedCollabPlayerId}
							onChange={(e) => setSelectedCollabPlayerId(e.target.value)}
							className="flex-1 bg-[#1b2845] border border-white/[0.12] rounded-[8px] px-3 py-2 text-xs text-white focus:outline-none focus:border-blue-500"
						>
							<option value="">
								{availableCollabPlayers.length === 0
									? 'Todos os jogadores já adicionados'
									: 'Adicionar jogador para colaboração...'}
							</option>
							{availableCollabPlayers.map((p) => {
								const tInfo = playerTeamInRoundMap.get(p.id_player);
								return (
									<option key={p.id_player} value={p.id_player}>
										{p.apelido || p.nome}
										{tInfo ? ` (${tInfo.name})` : ''}
									</option>
								);
							})}
						</select>
						<button
							type="button"
							disabled={!selectedCollabPlayerId}
							onClick={() => {
								const pid = parseInt(selectedCollabPlayerId, 10);
								if (pid) {
									setCollabPoints((prev) => ({
										...prev,
										[pid]: (prev[pid] ?? 0) + 1,
									}));
									setSelectedCollabPlayerId('');
								}
							}}
							className="px-3.5 py-2 rounded-[8px] bg-blue-600 hover:bg-blue-500 disabled:opacity-40 text-xs font-semibold text-white cursor-pointer transition-colors"
						>
							+ Adicionar
						</button>
					</div>

					{/* Lista de Colaboradores com flex-1 ocupando todo o espaço vertical */}
					<div className="flex-1 flex flex-col gap-2 min-h-[320px] max-h-[580px] overflow-y-auto pr-1.5">
						{Object.keys(collabPoints).length === 0 ? (
							<div className="flex-1 py-12 flex flex-col items-center justify-center text-center text-xs text-[#64748b] border border-dashed border-white/[0.08] rounded-[10px]">
								Nenhum ponto de colaboração atribuído ainda.
							</div>
						) : (
							Object.entries(collabPoints).map(([pidStr, pts]) => {
								const pid = parseInt(pidStr, 10);
								const p = playerMap.get(pid);
								if (!p) return null;

								return (
									<div
										key={`collab-${pid}`}
										className="w-full shrink-0 flex items-center justify-between gap-3 p-3 rounded-[10px] bg-white/[0.02] border border-white/[0.06] hover:border-white/[0.12] transition-colors"
									>
										<div className="min-w-0">
											<div className="text-xs font-bold text-white truncate">
												{p.apelido || p.nome}
											</div>
											<div className="text-[10px] text-[#94a3b8]">
												{collabNotes[pid] || 'Colaboração na rodada'}
											</div>
										</div>

										<div className="flex items-center gap-2">
											<div className="flex items-center border border-white/[0.14] rounded-lg bg-black/20 overflow-hidden">
												<button
													type="button"
													onClick={() =>
														setCollabPoints((prev) => ({
															...prev,
															[pid]: Math.max(0, (prev[pid] ?? 1) - 1),
														}))
													}
													className="px-2 py-1 text-xs hover:bg-white/[0.08] text-[#94a3b8] cursor-pointer"
												>
													−
												</button>
												<span className="px-2.5 py-1 text-xs font-bold text-white min-w-[28px] text-center">
													+{pts}
												</span>
												<button
													type="button"
													onClick={() =>
														setCollabPoints((prev) => ({
															...prev,
															[pid]: (prev[pid] ?? 0) + 1,
														}))
													}
													className="px-2 py-1 text-xs hover:bg-white/[0.08] text-[#94a3b8] cursor-pointer"
												>
													+
												</button>
											</div>

											<button
												type="button"
												onClick={() => {
													setCollabPoints((prev) => {
														const n = { ...prev };
														delete n[pid];
														return n;
													});
												}}
												className="text-xs text-[#94a3b8] hover:text-rose-400 p-1 cursor-pointer"
											>
												✕
											</button>
										</div>
									</div>
								);
							})
						)}
					</div>
				</div>
			</div>

			{/* SEÇÃO PÓS-PARTIDAS: OUROS DA RODADA E JOGADORES EXTRAS */}
			<div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
				{/* 3. Ouros da Rodada */}
				<div className="p-5 rounded-[16px] bg-[#111a2e] border border-white/[0.08] flex flex-col gap-4 h-full">
					<div className="flex items-center justify-between border-b border-white/[0.06] pb-3">
						<div className="flex items-center gap-2">
							<Medal className="text-yellow-400" size={20} />
							<div>
								<h3 className="text-base font-bold text-white m-0">Ouros da Rodada</h3>
								<p className="text-xs text-[#94a3b8] m-0">
									Lance os ouros (falhas) concedidos a cada jogador nesta rodada.
								</p>
							</div>
						</div>
						{Object.keys(roundOuros).length > 0 && (
							<span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-yellow-500/20 text-yellow-300 border border-yellow-500/30">
								{Object.values(roundOuros).reduce((a, b) => a + b, 0)} ouro(s)
							</span>
						)}
					</div>

					{/* Adicionar jogador para ouro */}
					<div className="flex gap-2">
						<select
							value={selectedOuroPlayerId}
							onChange={(e) => setSelectedOuroPlayerId(e.target.value)}
							className="flex-1 bg-[#1b2845] border border-white/[0.12] rounded-[8px] px-3 py-2 text-xs text-white focus:outline-none focus:border-yellow-500"
						>
							<option value="">
								{availableOuroPlayers.length === 0
									? 'Todos os jogadores já adicionados'
									: 'Adicionar jogador para ouro...'}
							</option>
							{availableOuroPlayers.map((p) => {
								const tInfo = playerTeamInRoundMap.get(p.id_player);
								return (
									<option key={p.id_player} value={p.id_player}>
										{p.apelido || p.nome}
										{tInfo ? ` (${tInfo.name})` : ''}
									</option>
								);
							})}
						</select>
						<button
							type="button"
							disabled={!selectedOuroPlayerId}
							onClick={() => {
								const pid = parseInt(selectedOuroPlayerId, 10);
								if (pid) {
									setRoundOuros((prev) => ({
										...prev,
										[pid]: (prev[pid] ?? 0) + 1,
									}));
									setSelectedOuroPlayerId('');
								}
							}}
							className="px-3.5 py-2 rounded-[8px] bg-yellow-600 hover:bg-yellow-500 disabled:opacity-40 text-xs font-semibold text-white cursor-pointer transition-colors"
						>
							+ Adicionar Ouro
						</button>
					</div>

					{/* Lista de Ouros */}
					<div className="flex-1 flex flex-col gap-2 min-h-[220px] max-h-[420px] overflow-y-auto pr-1.5">
						{Object.keys(roundOuros).length === 0 ? (
							<div className="flex-1 py-10 flex flex-col items-center justify-center text-center text-xs text-[#64748b] border border-dashed border-white/[0.08] rounded-[10px]">
								Nenhum ouro registrado para esta rodada.
							</div>
						) : (
							Object.entries(roundOuros).map(([pidStr, count]) => {
								const pid = parseInt(pidStr, 10);
								const p = playerMap.get(pid);
								if (!p) return null;
								const tInfo = playerTeamInRoundMap.get(pid);

								return (
									<div
										key={`ouro-${pid}`}
										className="w-full shrink-0 flex items-center justify-between gap-3 p-3 rounded-[10px] bg-white/[0.02] border border-white/[0.06] hover:border-yellow-500/30 transition-colors"
									>
										<div className="min-w-0">
											<div className="text-xs font-bold text-white truncate flex items-center gap-1.5">
												<span>{p.apelido || p.nome}</span>
												{tInfo && (
													<span className="text-[10px] px-1.5 py-0.2 rounded bg-white/[0.08] text-[#94a3b8] font-normal">
														{tInfo.name}
													</span>
												)}
											</div>
											<div className="text-[10px] text-yellow-400/80 font-medium">
												Ouro (falha na rodada)
											</div>
										</div>

										<div className="flex items-center gap-2">
											<div className="flex items-center border border-yellow-500/30 rounded-lg bg-black/20 overflow-hidden">
												<button
													type="button"
													onClick={() =>
														setRoundOuros((prev) => ({
															...prev,
															[pid]: Math.max(1, (prev[pid] ?? 1) - 1),
														}))
													}
													className="px-2 py-1 text-xs hover:bg-white/[0.08] text-[#94a3b8] cursor-pointer"
												>
													−
												</button>
												<span className="px-2.5 py-1 text-xs font-bold text-yellow-300 min-w-[28px] text-center">
													{count}
												</span>
												<button
													type="button"
													onClick={() =>
														setRoundOuros((prev) => ({
															...prev,
															[pid]: (prev[pid] ?? 0) + 1,
														}))
													}
													className="px-2 py-1 text-xs hover:bg-white/[0.08] text-[#94a3b8] cursor-pointer"
												>
													+
												</button>
											</div>

											<button
												type="button"
												onClick={() => {
													setRoundOuros((prev) => {
														const n = { ...prev };
														delete n[pid];
														return n;
													});
												}}
												className="text-xs text-[#94a3b8] hover:text-rose-400 p-1 cursor-pointer"
											>
												✕
											</button>
										</div>
									</div>
								);
							})
						)}
					</div>
				</div>

				{/* 4. Jogadores Extras / Emprestados */}
				<div className="p-5 rounded-[16px] bg-[#111a2e] border border-white/[0.08] flex flex-col gap-4 h-full">
					<div className="flex items-center justify-between border-b border-white/[0.06] pb-3">
						<div className="flex items-center gap-2">
							<Users className="text-indigo-400" size={20} />
							<div>
								<h3 className="text-base font-bold text-white m-0">Jogadores Extras / Emprestados</h3>
								<p className="text-xs text-[#94a3b8] m-0">
									Marque vitórias (+3 pts) e empates (+1 pt) para jogadores que completaram times.
								</p>
							</div>
						</div>
					</div>

					{/* Adicionar jogador extra manualmente */}
					<div className="flex gap-2">
						<select
							value={selectedExtraPlayerId}
							onChange={(e) => setSelectedExtraPlayerId(e.target.value)}
							className="flex-1 bg-[#1b2845] border border-white/[0.12] rounded-[8px] px-3 py-2 text-xs text-white focus:outline-none focus:border-indigo-500"
						>
							<option value="">
								{availableExtraPlayers.length === 0
									? 'Todos os jogadores já adicionados'
									: 'Adicionar jogador extra / emprestado...'}
							</option>
							{availableExtraPlayers.map((p) => {
								const tInfo = playerTeamInRoundMap.get(p.id_player);
								return (
									<option key={p.id_player} value={p.id_player}>
										{p.apelido || p.nome}
										{tInfo ? ` (${tInfo.name})` : ''}
									</option>
								);
							})}
						</select>
						<button
							type="button"
							disabled={!selectedExtraPlayerId}
							onClick={() => {
								const pid = parseInt(selectedExtraPlayerId, 10);
								if (pid) {
									const det = autoDetectedExtraStats[pid] || { wins: 0, draws: 0, losses: 0 };
									setExtraPlayerStats((prev) => ({
										...prev,
										[pid]: { wins: det.wins, draws: det.draws, losses: det.losses },
									}));
									setSelectedExtraPlayerId('');
								}
							}}
							className="px-3.5 py-2 rounded-[8px] bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 text-xs font-semibold text-white cursor-pointer transition-colors"
						>
							+ Adicionar Extra
						</button>
					</div>

					{/* Lista de Jogadores Extras */}
					<div className="flex-1 flex flex-col gap-2.5 min-h-[220px] max-h-[420px] overflow-y-auto pr-1.5">
						{Object.keys(extraPlayerStats).length === 0 ? (
							<div className="flex-1 py-10 flex flex-col items-center justify-center text-center text-xs text-[#64748b] border border-dashed border-white/[0.08] rounded-[10px]">
								Nenhum jogador extra registrado nesta rodada.
							</div>
						) : (
							Object.entries(extraPlayerStats).map(([pidStr, stats]) => {
								const pid = parseInt(pidStr, 10);
								const p = playerMap.get(pid);
								if (!p) return null;
								const tInfo = playerTeamInRoundMap.get(pid);
								const det = autoDetectedExtraStats[pid];
								const teamPoints = stats.wins * 3 + stats.draws * 1;

								return (
									<div
										key={`extra-${pid}`}
										className="w-full shrink-0 flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3 rounded-[10px] bg-white/[0.02] border border-white/[0.06] hover:border-indigo-500/30 transition-colors"
									>
										<div className="min-w-0">
											<div className="text-xs font-bold text-white truncate flex items-center gap-1.5">
												<span>{p.apelido || p.nome}</span>
												{tInfo && (
													<span className="text-[10px] px-1.5 py-0.2 rounded bg-white/[0.08] text-[#94a3b8] font-normal">
														{tInfo.name}
													</span>
												)}
											</div>
										</div>

										<div className="flex items-center gap-2.5 flex-wrap">
											{/* Vitórias */}
											<div className="flex items-center gap-1 bg-black/20 border border-green-500/30 rounded-lg overflow-hidden px-1 py-0.5" title="Vitórias (+3 pts)">
												<span className="text-[10px] font-bold text-green-400 pl-1">V:</span>
												<button
													type="button"
													onClick={() =>
														setExtraPlayerStats((prev) => ({
															...prev,
															[pid]: {
																...prev[pid],
																wins: Math.max(0, (prev[pid]?.wins ?? 0) - 1),
															},
														}))
													}
													className="px-1.5 py-0.5 text-xs text-[#94a3b8] hover:text-white"
												>
													−
												</button>
												<span className="text-xs font-bold text-green-300 min-w-[16px] text-center">
													{stats.wins}
												</span>
												<button
													type="button"
													onClick={() =>
														setExtraPlayerStats((prev) => ({
															...prev,
															[pid]: {
																...prev[pid],
																wins: (prev[pid]?.wins ?? 0) + 1,
															},
														}))
													}
													className="px-1.5 py-0.5 text-xs text-[#94a3b8] hover:text-white"
												>
													+
												</button>
											</div>

											{/* Empates */}
											<div className="flex items-center gap-1 bg-black/20 border border-blue-500/30 rounded-lg overflow-hidden px-1 py-0.5" title="Empates (+1 pt)">
												<span className="text-[10px] font-bold text-blue-400 pl-1">E:</span>
												<button
													type="button"
													onClick={() =>
														setExtraPlayerStats((prev) => ({
															...prev,
															[pid]: {
																...prev[pid],
																draws: Math.max(0, (prev[pid]?.draws ?? 0) - 1),
															},
														}))
													}
													className="px-1.5 py-0.5 text-xs text-[#94a3b8] hover:text-white"
												>
													−
												</button>
												<span className="text-xs font-bold text-blue-300 min-w-[16px] text-center">
													{stats.draws}
												</span>
												<button
													type="button"
													onClick={() =>
														setExtraPlayerStats((prev) => ({
															...prev,
															[pid]: {
																...prev[pid],
																draws: (prev[pid]?.draws ?? 0) + 1,
															},
														}))
													}
													className="px-1.5 py-0.5 text-xs text-[#94a3b8] hover:text-white"
												>
													+
												</button>
											</div>

											{/* Derrotas */}
											<div className="flex items-center gap-1 bg-black/20 border border-rose-500/30 rounded-lg overflow-hidden px-1 py-0.5" title="Derrotas (0 pts)">
												<span className="text-[10px] font-bold text-rose-400 pl-1">D:</span>
												<button
													type="button"
													onClick={() =>
														setExtraPlayerStats((prev) => ({
															...prev,
															[pid]: {
																...prev[pid],
																losses: Math.max(0, (prev[pid]?.losses ?? 0) - 1),
															},
														}))
													}
													className="px-1.5 py-0.5 text-xs text-[#94a3b8] hover:text-white"
												>
													−
												</button>
												<span className="text-xs font-bold text-rose-300 min-w-[16px] text-center">
													{stats.losses}
												</span>
												<button
													type="button"
													onClick={() =>
														setExtraPlayerStats((prev) => ({
															...prev,
															[pid]: {
																...prev[pid],
																losses: (prev[pid]?.losses ?? 0) + 1,
															},
														}))
													}
													className="px-1.5 py-0.5 text-xs text-[#94a3b8] hover:text-white"
												>
													+
												</button>
											</div>

											{/* Pontos de time calculados */}
											<span className="text-[11px] font-bold px-2 py-1 rounded bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
												+{teamPoints} pts
											</span>

											<button
												type="button"
												onClick={() => {
													setExtraPlayerStats((prev) => {
														const n = { ...prev };
														delete n[pid];
														return n;
													});
												}}
												className="text-xs text-[#94a3b8] hover:text-rose-400 p-1 cursor-pointer"
											>
												✕
											</button>
										</div>
									</div>
								);
							})
						)}
					</div>
				</div>
			</div>

			{/* BOTÃO FINALIZAR RODADA & CALCULAR PONTUAÇÕES TOTAIS */}
			<div className="p-5 rounded-[16px] bg-gradient-to-r from-blue-900/40 via-blue-600/20 to-emerald-900/30 border border-blue-500/30 flex flex-col sm:flex-row items-center justify-between gap-4 shadow-xl">
				<div>
					<h3 className="text-base font-bold text-white m-0 flex items-center gap-2">
						<Zap className="text-yellow-400" size={18} />
						<span>Finalizar e Consolidar Rodada</span>
					</h3>
					<p className="text-xs text-[#94a3b8] mt-1 m-0">
						Grave as premiações, pontos de colaboração e processe o ranking geral completo da temporada.
					</p>
				</div>

				<button
					type="button"
					disabled={finalizeRoundMutation.isPending}
					onClick={() => {
						if (confirm('Deseja salvar premiações e recalcular pontuações de toda a rodada?')) {
							finalizeRoundMutation.mutate();
						}
					}}
					className="min-h-[48px] px-6 rounded-[12px] bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 disabled:opacity-40 text-white font-bold text-sm flex items-center justify-center gap-2 shadow-lg shadow-blue-500/20 cursor-pointer transition-all"
				>
					{finalizeRoundMutation.isPending ? (
						<span>Calculando pontuações...</span>
					) : (
						<>
							<Check size={18} />
							<span>Salvar e Calcular Pontuações Totais</span>
						</>
					)}
				</button>
			</div>

			{/* MODAL COMPACTO DE CONFIGURAÇÃO DO GOL */}
			{activeGoalModal && (() => {
				const activeRow = rows.find((r) => r.key === activeGoalModal.rowKey);
				if (!activeRow) return null;

				const homeTeam = activeRow.homeTeamId ? teamMap.get(activeRow.homeTeamId) : null;
				const awayTeam = activeRow.awayTeamId ? teamMap.get(activeRow.awayTeamId) : null;

				const currentGoal: GoalSlot = activeRow.goals[activeGoalModal.goalIndex] || {
					id: `new-${Date.now()}`,
					playerId: null,
					isOwnGoal: false,
					teamSide: 'home',
					assistMode: 'none',
					assistPlayerId: null,
				};

				return (
					<GoalConfigModal
						goal={currentGoal}
						goalNumber={activeGoalModal.goalIndex + 1}
						homeTeam={homeTeam}
						awayTeam={awayTeam}
						allPlayers={allPlayers}
						playerTeamMap={playerTeamInRoundMap}
						onSave={(updatedGoal) => {
							const newGoals = [...activeRow.goals];
							newGoals[activeGoalModal.goalIndex] = updatedGoal;
							handleUpdateRowField(activeRow.key, 'goals', newGoals);
							setActiveGoalModal(null);
						}}
						onClose={() => setActiveGoalModal(null)}
					/>
				);
			})()}

			{/* MODAL DE CADASTRO E GERENCIAMENTO DE PRÊMIOS DA ROLETA */}
			{isPrizeModalOpen && (
				<div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in">
					<div className="bg-[#111a2e] border border-white/[0.14] rounded-[16px] max-w-[500px] w-full p-5 flex flex-col gap-4 text-[#e6edf7] shadow-2xl">
						<div className="flex items-center justify-between border-b border-white/[0.08] pb-3">
							<div className="flex items-center gap-2">
								<Gift className="text-yellow-400" size={20} />
								<div>
									<h3 className="text-base font-bold text-white m-0">Prêmios da Roleta</h3>
									<p className="text-xs text-[#94a3b8] m-0">
										Cadastre os prêmios disponíveis para os vencedores da roleta.
									</p>
								</div>
							</div>
							<button
								type="button"
								onClick={() => setIsPrizeModalOpen(false)}
								className="text-[#94a3b8] hover:text-white p-1 text-sm cursor-pointer"
							>
								✕
							</button>
						</div>

						{/* Formulário para novo prêmio */}
						<div className="flex flex-col gap-2 p-3 rounded-[10px] bg-white/[0.03] border border-white/[0.08]">
							<span className="text-xs font-bold text-yellow-300 uppercase">
								+ Novo Prêmio
							</span>
							<div className="flex flex-col sm:flex-row gap-2">
								<input
									type="text"
									placeholder="Nome do prêmio (ex: Camisa, Pix R$ 50, Cerveja)..."
									value={newPrizeName}
									onChange={(e) => setNewPrizeName(e.target.value)}
									className="flex-1 bg-[#1b2845] border border-white/[0.14] rounded-[8px] px-3 py-2 text-xs text-white focus:outline-none focus:border-yellow-500"
								/>
								<button
									type="button"
									disabled={!newPrizeName.trim() || createPrizeMutation.isPending}
									onClick={() => {
										if (newPrizeName.trim()) {
											createPrizeMutation.mutate({
												name: newPrizeName.trim(),
												description: newPrizeDesc.trim() || undefined,
											});
										}
									}}
									className="px-4 py-2 rounded-[8px] bg-yellow-600 hover:bg-yellow-500 disabled:opacity-40 text-xs font-bold text-white cursor-pointer transition-colors shrink-0"
								>
									{createPrizeMutation.isPending ? 'Salvando...' : 'Cadastrar'}
								</button>
							</div>
							<input
								type="text"
								placeholder="Descrição / patrocinador (opcional)..."
								value={newPrizeDesc}
								onChange={(e) => setNewPrizeDesc(e.target.value)}
								className="bg-[#1b2845] border border-white/[0.14] rounded-[8px] px-3 py-1.5 text-xs text-[#94a3b8] focus:outline-none focus:border-yellow-500"
							/>
						</div>

						{/* Lista de Prêmios Cadastrados */}
						<div className="flex flex-col gap-2">
							<span className="text-xs font-semibold text-[#94a3b8] uppercase">
								Prêmios Cadastrados ({roulettePrizes.length})
							</span>
							<div className="flex flex-col gap-1.5 max-h-[220px] overflow-y-auto pr-1">
								{roulettePrizes.length === 0 ? (
									<div className="py-6 text-center text-xs text-[#64748b] border border-dashed border-white/[0.08] rounded-[8px]">
										Nenhum prêmio cadastrado ainda. Digite acima e clique em Cadastrar.
									</div>
								) : (
									roulettePrizes.map((prz) => (
										<div
											key={prz.id_roulette_prize}
											className="flex items-center justify-between gap-2 p-2.5 rounded-[8px] bg-white/[0.02] border border-white/[0.06]"
										>
											<div className="min-w-0">
												<div className="text-xs font-bold text-white truncate flex items-center gap-1.5">
													<span>🎁</span>
													<span>{prz.name}</span>
												</div>
												{prz.description && (
													<div className="text-[10px] text-[#94a3b8] truncate">
														{prz.description}
													</div>
												)}
											</div>
											<button
												type="button"
												title="Excluir prêmio"
												onClick={() => {
													if (confirm(`Deseja excluir o prêmio "${prz.name}"?`)) {
														deletePrizeMutation.mutate(prz.id_roulette_prize);
													}
												}}
												className="p-1.5 text-[#94a3b8] hover:text-rose-400 hover:bg-rose-500/10 rounded cursor-pointer transition-colors"
											>
												<Trash2 size={13} />
											</button>
										</div>
									))
								)}
							</div>
						</div>

						<div className="flex justify-end pt-2 border-t border-white/[0.08]">
							<button
								type="button"
								onClick={() => setIsPrizeModalOpen(false)}
								className="px-4 py-2 rounded-[8px] bg-white/[0.08] hover:bg-white/[0.14] text-xs font-semibold text-white cursor-pointer transition-colors"
							>
								Concluído
							</button>
						</div>
					</div>
				</div>
			)}
		</div>
	);
}

// Modal interno para preenchimento de um Gol + Assistência/Ouro
function GoalConfigModal({
	goal,
	goalNumber,
	homeTeam,
	awayTeam,
	allPlayers,
	playerTeamMap,
	onSave,
	onClose,
}: {
	goal: GoalSlot;
	goalNumber: number;
	homeTeam: Team | null | undefined;
	awayTeam: Team | null | undefined;
	allPlayers: Player[];
	playerTeamMap: Map<number, { id_team: number; name: string }>;
	onSave: (updated: GoalSlot) => void;
	onClose: () => void;
}) {
	const [teamSide, setTeamSide] = useState<'home' | 'away'>(goal.teamSide || 'home');
	const [playerId, setPlayerId] = useState<number | null>(goal.playerId);
	const [isOwnGoal, setIsOwnGoal] = useState<boolean>(goal.isOwnGoal);
	const [assistMode, setAssistMode] = useState<'none' | 'assistencia' | 'ouro'>(
		goal.assistMode || 'none',
	);
	const [assistPlayerId, setAssistPlayerId] = useState<number | null>(
		goal.assistPlayerId || null,
	);
	const [showOtherScorers, setShowOtherScorers] = useState(false);
	const [showOtherAssists, setShowOtherAssists] = useState(false);

	const activeTeam = teamSide === 'home' ? homeTeam : awayTeam;
	const opponentTeam = teamSide === 'home' ? awayTeam : homeTeam;

	// Elenco do time que marca o gol
	const activeRoster = activeTeam?.players ?? [];
	const opponentRoster = opponentTeam?.players ?? [];

	// Outros jogadores (emprestados)
	const otherPlayers = useMemo(() => {
		const activeSet = new Set(activeRoster.map((p) => p.id_player));
		return allPlayers.filter((p) => !activeSet.has(p.id_player));
	}, [allPlayers, activeRoster]);

	return (
		<div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in">
			<div className="bg-[#111a2e] border border-white/[0.12] rounded-[16px] max-w-[550px] w-full p-5 flex flex-col gap-4 text-[#e6edf7] shadow-2xl">
				<div className="flex items-center justify-between border-b border-white/[0.08] pb-3">
					<div>
						<h3 className="text-base font-bold text-white m-0">Configurar Gol ({goalNumber})</h3>
						<span className="text-xs text-[#94a3b8]">
							Selecione quem pontuou e se houve assistência ou ouro.
						</span>
					</div>
					<button
						type="button"
						onClick={onClose}
						className="text-[#94a3b8] hover:text-white p-1 text-sm cursor-pointer"
					>
						✕
					</button>
				</div>

				{/* 1. Time que pontua */}
				<div className="flex flex-col gap-1.5">
					<span className="text-xs font-semibold text-[#94a3b8] uppercase">Gol marcado para:</span>
					<div className="grid grid-cols-2 gap-2">
						{(() => {
							const homeColor = getTeamColor(homeTeam?.color, 0);
							const awayColor = getTeamColor(awayTeam?.color, 0);
							return (
								<>
									<button
										type="button"
										onClick={() => {
											setTeamSide('home');
											setPlayerId(null);
											setAssistPlayerId(null);
										}}
										className={`min-h-[42px] px-3 rounded-[10px] border text-xs sm:text-sm font-semibold transition-colors cursor-pointer flex items-center justify-center gap-2 ${teamSide === 'home'
											? `${homeColor.goalBg} ${homeColor.goalBorder} ${homeColor.goalText} shadow-md`
											: 'border-white/[0.12] bg-white/[0.02] text-[#94a3b8] hover:bg-white/[0.05]'
											}`}
									>
										<span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: homeColor.hex }} />
										<span className="truncate">{homeTeam?.name || 'Time Casa'}</span>
										<span className="text-[10px] opacity-75">({homeColor.label})</span>
									</button>

									<button
										type="button"
										onClick={() => {
											setTeamSide('away');
											setPlayerId(null);
											setAssistPlayerId(null);
										}}
										className={`min-h-[42px] px-3 rounded-[10px] border text-xs sm:text-sm font-semibold transition-colors cursor-pointer flex items-center justify-center gap-2 ${teamSide === 'away'
											? `${awayColor.goalBg} ${awayColor.goalBorder} ${awayColor.goalText} shadow-md`
											: 'border-white/[0.12] bg-white/[0.02] text-[#94a3b8] hover:bg-white/[0.05]'
											}`}
									>
										<span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: awayColor.hex }} />
										<span className="truncate">{awayTeam?.name || 'Time Visitante'}</span>
										<span className="text-[10px] opacity-75">({awayColor.label})</span>
									</button>
								</>
							);
						})()}
					</div>
				</div>

				{/* 2. Autor do Gol */}
				<div className="flex flex-col gap-2">
					<div className="flex items-center justify-between">
						<span className="text-xs font-semibold text-[#94a3b8] uppercase">Autor do Gol:</span>
						<label className="flex items-center gap-1.5 text-xs text-rose-300 cursor-pointer">
							<input
								type="checkbox"
								checked={isOwnGoal}
								onChange={(e) => setIsOwnGoal(e.target.checked)}
								className="rounded border-white/20"
							/>
							<span>Gol contra (GC)</span>
						</label>
					</div>

					<div className="flex flex-wrap gap-1.5 max-h-[140px] overflow-y-auto pr-1">
						{activeRoster.map((p) => {
							const isSelected = playerId === p.id_player;
							return (
								<button
									key={`scorer-${p.id_player}`}
									type="button"
									onClick={() => setPlayerId(isSelected ? null : p.id_player)}
									className={`min-h-[34px] px-3 rounded-lg border text-xs transition-colors cursor-pointer ${isSelected
										? 'bg-emerald-600 border-emerald-600 text-white font-bold'
										: 'border-white/[0.12] bg-white/[0.03] text-[#e6edf7] hover:bg-white/[0.06]'
										}`}
								>
									{p.apelido || p.nome}
								</button>
							);
						})}

						{/* Jogador de fora selecionado */}
						{playerId && !activeRoster.some((p) => p.id_player === playerId) && (
							<button
								type="button"
								className="min-h-[34px] px-3 rounded-lg border bg-emerald-600 border-emerald-600 text-white font-bold text-xs inline-flex items-center gap-1 cursor-pointer"
							>
								<span>
									{allPlayers.find((p) => p.id_player === playerId)?.apelido ||
										allPlayers.find((p) => p.id_player === playerId)?.nome}
								</span>
								<span className="text-[10px] px-1 py-0.2 bg-white/20 rounded">
									Emprestado
								</span>
							</button>
						)}

						<button
							type="button"
							onClick={() => setShowOtherScorers((prev) => !prev)}
							className="min-h-[34px] px-2.5 rounded-lg border border-dashed border-white/[0.18] text-xs text-[#94a3b8] hover:text-white cursor-pointer"
						>
							{showOtherScorers ? 'Ocultar outros ⌃' : 'Outros jogadores ⌄'}
						</button>
					</div>

					{showOtherScorers && (
						<div className="mt-1 pt-2 border-t border-white/[0.08] flex flex-wrap gap-1.5 max-h-[110px] overflow-y-auto">
							{otherPlayers.map((p) => {
								const isSelected = playerId === p.id_player;
								const tName = playerTeamMap.get(p.id_player)?.name;
								return (
									<button
										key={`other-scorer-${p.id_player}`}
										type="button"
										onClick={() => {
											setPlayerId(isSelected ? null : p.id_player);
										}}
										className={`min-h-[30px] px-2.5 rounded-md border text-xs transition-colors cursor-pointer flex items-center gap-1 ${isSelected
											? 'bg-emerald-600 border-emerald-600 text-white font-bold'
											: 'border-white/[0.08] bg-white/[0.015] text-[#94a3b8] hover:bg-white/[0.04]'
											}`}
									>
										<span>{p.apelido || p.nome}</span>
										{tName && (
											<span className="text-[9px] px-1 bg-white/[0.08] rounded text-[#64748b]">
												{tName}
											</span>
										)}
									</button>
								);
							})}
						</div>
					)}
				</div>

				{/* 3. Assistência / Ouro */}
				<div className="flex flex-col gap-2 pt-2 border-t border-white/[0.08]">
					<span className="text-xs font-semibold text-[#94a3b8] uppercase">
						Assistência ou Ouro:
					</span>

					<div className="grid grid-cols-3 gap-2">
						<button
							type="button"
							onClick={() => {
								setAssistMode('none');
								setAssistPlayerId(null);
							}}
							className={`min-h-[36px] px-2 rounded-lg border text-xs font-semibold transition-colors cursor-pointer ${assistMode === 'none'
								? 'bg-white/[0.14] border-white/30 text-white'
								: 'border-white/[0.08] bg-white/[0.02] text-[#94a3b8] hover:bg-white/[0.05]'
								}`}
						>
							Sem assistência
						</button>
						<button
							type="button"
							onClick={() => {
								setAssistMode('assistencia');
								setAssistPlayerId(null);
							}}
							className={`min-h-[36px] px-2 rounded-lg border text-xs font-semibold transition-colors cursor-pointer flex items-center justify-center gap-1.5 ${assistMode === 'assistencia'
								? 'bg-blue-600/30 border-blue-500/70 text-[#bfdbfe]'
								: 'border-white/[0.08] bg-white/[0.02] text-[#94a3b8] hover:bg-white/[0.05]'
								}`}
						>
							<span className="w-2 h-2 rounded-full bg-[#60a5fa]" />
							<span>Assistência</span>
						</button>
						<button
							type="button"
							onClick={() => {
								setAssistMode('ouro');
								setAssistPlayerId(null);
							}}
							className={`min-h-[36px] px-2 rounded-lg border text-xs font-semibold transition-colors cursor-pointer flex items-center justify-center gap-1.5 ${assistMode === 'ouro'
								? 'bg-blue-600/30 border-blue-500/70 text-[#bfdbfe]'
								: 'border-white/[0.08] bg-white/[0.02] text-[#94a3b8] hover:bg-white/[0.05]'
								}`}
						>
							<span className="w-2 h-2.5 rounded-[2px] bg-[#3b82f6]" />
							<span>Ouro (falha)</span>
						</button>
					</div>

					{/* Lista de jogadores de assistência (companheiros) */}
					{assistMode === 'assistencia' && (
						<div className="flex flex-col gap-1.5 mt-1">
							<div className="text-[11px] text-[#94a3b8]">
								Selecione o companheiro que deu o passe:
							</div>
							<div className="flex flex-wrap gap-1.5 max-h-[120px] overflow-y-auto">
								{activeRoster
									.filter((p) => p.id_player !== playerId)
									.map((p) => {
										const isSelected = assistPlayerId === p.id_player;
										return (
											<button
												key={`ass-${p.id_player}`}
												type="button"
												onClick={() =>
													setAssistPlayerId(isSelected ? null : p.id_player)
												}
												className={`min-h-[32px] px-2.5 rounded-lg border text-xs transition-colors cursor-pointer ${isSelected
													? 'bg-blue-500/30 border-blue-500/80 text-[#bfdbfe] font-bold'
													: 'border-white/[0.10] bg-white/[0.02] text-[#e6edf7] hover:bg-white/[0.05]'
													}`}
											>
												{p.apelido || p.nome}
											</button>
										);
									})}

								<button
									type="button"
									onClick={() => setShowOtherAssists((prev) => !prev)}
									className="min-h-[32px] px-2 rounded-lg border border-dashed border-white/[0.18] text-xs text-[#94a3b8]"
								>
									{showOtherAssists ? 'Ocultar outros ⌃' : 'Outros jogadores ⌄'}
								</button>
							</div>

							{showOtherAssists && (
								<div className="mt-1 pt-1.5 border-t border-white/[0.08] flex flex-wrap gap-1.5 max-h-[100px] overflow-y-auto">
									{otherPlayers
										.filter((p) => p.id_player !== playerId)
										.map((p) => {
											const isSelected = assistPlayerId === p.id_player;
											return (
												<button
													key={`other-ass-${p.id_player}`}
													type="button"
													onClick={() =>
														setAssistPlayerId(isSelected ? null : p.id_player)
													}
													className={`min-h-[28px] px-2 rounded border text-[11px] transition-colors cursor-pointer ${isSelected
														? 'bg-blue-500/30 border-blue-500/80 text-[#bfdbfe] font-bold'
														: 'border-white/[0.08] bg-white/[0.015] text-[#94a3b8]'
														}`}
												>
													{p.apelido || p.nome}
												</button>
											);
										})}
								</div>
							)}
						</div>
					)}

					{/* Lista de jogadores de ouro (adversários) */}
					{assistMode === 'ouro' && (
						<div className="flex flex-col gap-1.5 mt-1">
							<div className="text-[11px] text-[#94a3b8]">
								Selecione o adversário que entregou o gol (falha):
							</div>
							<div className="flex flex-wrap gap-1.5 max-h-[120px] overflow-y-auto">
								{opponentRoster
									.filter((p) => p.id_player !== playerId)
									.map((p) => {
										const isSelected = assistPlayerId === p.id_player;
										return (
											<button
												key={`ouro-${p.id_player}`}
												type="button"
												onClick={() =>
													setAssistPlayerId(isSelected ? null : p.id_player)
												}
												className={`min-h-[32px] px-2.5 rounded-lg border text-xs transition-colors cursor-pointer flex items-center gap-1.5 ${isSelected
													? 'bg-blue-500/30 border-blue-500/80 text-[#bfdbfe] font-bold'
													: 'border-white/[0.10] bg-white/[0.02] text-[#e6edf7] hover:bg-white/[0.05]'
													}`}
											>
												<span className="w-1.5 h-2 bg-[#3b82f6] rounded-[1px]" />
												<span>{p.apelido || p.nome}</span>
											</button>
										);
									})}

								<button
									type="button"
									onClick={() => setShowOtherAssists((prev) => !prev)}
									className="min-h-[32px] px-2 rounded-lg border border-dashed border-white/[0.18] text-xs text-[#94a3b8]"
								>
									{showOtherAssists ? 'Ocultar outros ⌃' : 'Outros jogadores ⌄'}
								</button>
							</div>

							{showOtherAssists && (
								<div className="mt-1 pt-1.5 border-t border-white/[0.08] flex flex-wrap gap-1.5 max-h-[100px] overflow-y-auto">
									{otherPlayers
										.filter((p) => p.id_player !== playerId)
										.map((p) => {
											const isSelected = assistPlayerId === p.id_player;
											return (
												<button
													key={`other-ouro-${p.id_player}`}
													type="button"
													onClick={() =>
														setAssistPlayerId(isSelected ? null : p.id_player)
													}
													className={`min-h-[28px] px-2 rounded border text-[11px] transition-colors cursor-pointer ${isSelected
														? 'bg-blue-500/30 border-blue-500/80 text-[#bfdbfe] font-bold'
														: 'border-white/[0.08] bg-white/[0.015] text-[#94a3b8]'
														}`}
												>
													{p.apelido || p.nome}
												</button>
											);
										})}
								</div>
							)}
						</div>
					)}
				</div>

				{/* Botões do Modal */}
				<div className="flex items-center justify-end gap-2 pt-3 border-t border-white/[0.08]">
					<button
						type="button"
						onClick={onClose}
						className="px-4 py-2 rounded-[10px] border border-white/[0.14] text-xs text-[#94a3b8] hover:text-white cursor-pointer"
					>
						Cancelar
					</button>

					<button
						type="button"
						disabled={!playerId}
						onClick={() => {
							onSave({
								...goal,
								teamSide,
								playerId,
								isOwnGoal,
								assistMode,
								assistPlayerId: assistMode !== 'none' ? assistPlayerId : null,
							});
						}}
						className="px-5 py-2 rounded-[10px] bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 text-xs font-bold text-white cursor-pointer transition-colors"
					>
						Salvar Gol
					</button>
				</div>
			</div>
		</div>
	);
}
