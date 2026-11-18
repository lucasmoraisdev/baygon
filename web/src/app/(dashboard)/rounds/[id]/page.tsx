'use client';

import { Button } from '@/components/Button';
import { DatePicker } from '@/components/DatePicker';
import { FormField } from '@/components/FormField';
import { Input } from '@/components/Input';
import { Loading } from '@/components/Loading';
import { Modal } from '@/components/Modal';
import { Select } from '@/components/Select';
import { TeamColorTag } from '@/components/TeamColorTag';
import RoundVotingTab from '@/components/RoundVoting/RoundVotingTab';
import { TEAM_COLORS } from '@/lib/teamColors';
import { useAuth } from '@/context/AuthContext';
import { fetchAPI } from '@/lib/api';
import { Player, PlayerScore, Round, RoundRouletteWinner, Team } from '@/types/types';
import { useMutation, useQueries, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Award, CheckCircle2, ClipboardList, ExternalLink, Gift, Medal, Sparkles, Trophy, Users, Zap } from 'lucide-react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useMemo, useRef, useState } from 'react';

export default function RoundDetail({ params }: { params: { id: string } }) {
	const router = useRouter();
	const searchParams = useSearchParams();
	const queryClient = useQueryClient();
	const { user } = useAuth();
	const isAdmin = Boolean(user?.is_admin || user?.role === 'admin');

	const [isMenuOpen, setIsMenuOpen] = useState(false);
	const menuRef = useRef<HTMLDivElement>(null);

	useEffect(() => {
		const handleClickOutside = (e: MouseEvent) => {
			if (
				menuRef.current &&
				!menuRef.current.contains(e.target as Node)
			) {
				setIsMenuOpen(false);
			}
		};
		if (isMenuOpen) {
			document.addEventListener('mousedown', handleClickOutside);
		}
		return () =>
			document.removeEventListener('mousedown', handleClickOutside);
	}, [isMenuOpen]);

	const [isTeamModalOpen, setIsTeamModalOpen] = useState(false);
	const [isMatchModalOpen, setIsMatchModalOpen] = useState(false);
	const [isEditRoundOpen, setIsEditRoundOpen] = useState(false);
	const [editRoundDate, setEditRoundDate] = useState('');
	const [editRoundLocation, setEditRoundLocation] = useState('');
	const [editRoundReferee, setEditRoundReferee] = useState('');
	const [editRoundNumber, setEditRoundNumber] = useState('1');

	const [teamName, setTeamName] = useState('');
	const [teamColor, setTeamColor] = useState('blue');
	const [selectedPlayerIds, setSelectedPlayerIds] = useState<Set<number>>(
		new Set(),
	);
	const [playerSearch, setPlayerSearch] = useState('');

	const [homeTeamId, setHomeTeamId] = useState('');
	const [awayTeamId, setAwayTeamId] = useState('');

	const [isDrawModalOpen, setIsDrawModalOpen] = useState(false);
	const [drawMode, setDrawMode] = useState<'draw' | 'manual'>('draw');
	const [numTeams, setNumTeams] = useState(4);
	const [drawSelectedIds, setDrawSelectedIds] = useState<Set<number>>(
		new Set(),
	);
	const [poteOverrides, setPoteOverrides] = useState<
		Record<number, number | null>
	>({});
	const [drawSearch, setDrawSearch] = useState('');
	const [draftTeams, setDraftTeams] = useState<
		Array<{ name: string; playerIds: number[] }>
	>([]);
	const [overwriteExisting, setOverwriteExisting] = useState(false);

	const [isAttendanceModalOpen, setIsAttendanceModalOpen] = useState(false);
	const [attendanceDraft, setAttendanceDraft] = useState<
		Record<number, 'confirmed' | 'waiting' | 'declined' | ''>
	>({});
	const [attendanceSearch, setAttendanceSearch] = useState('');
	const [activeTab, setActiveTab] = useState<'pontuacao' | 'detalhes' | 'votacao'>('pontuacao');

	useEffect(() => {
		const tab = searchParams.get('tab');
		if (tab === 'voting' || tab === 'votacao') {
			setActiveTab('votacao');
		}
	}, [searchParams]);

	const [
		roundQuery,
		teamsQuery,
		matchesQuery,
		playersQuery,
		attendanceQuery,
		awardsQuery,
		scoresQuery,
		rouletteWinnersQuery,
		ourosQuery,
	] = useQueries({
		queries: [
			{
				queryKey: ['round', params.id],
				queryFn: () => fetchAPI(`/rounds/${params.id}`),
			},
			{
				queryKey: ['teams', 'round', params.id],
				queryFn: () =>
					fetchAPI(`/teams/round/${params.id}`).catch(() => []),
			},
			{
				queryKey: ['matches', 'round', params.id],
				queryFn: () =>
					fetchAPI(`/matches/round/${params.id}`).catch(() => []),
			},
			{
				queryKey: ['players'],
				queryFn: () => fetchAPI('/players/').catch(() => []),
			},
			{
				queryKey: ['attendance', 'round', params.id],
				queryFn: () =>
					fetchAPI(`/attendance/round/${params.id}`).catch(() => ({
						round_id: parseInt(params.id, 10),
						confirmed_count: 0,
						declined_count: 0,
						waiting_count: 0,
						items: [],
					})),
			},
			{
				queryKey: ['awards', 'round', params.id],
				queryFn: () =>
					fetchAPI(`/awards/round/${params.id}`).catch(() => []),
			},
			{
				queryKey: ['rankings', 'round', params.id],
				queryFn: () =>
					fetchAPI(`/rankings/round/${params.id}`).catch(() => []),
			},
			{
				queryKey: ['round-roulette', params.id],
				queryFn: () =>
					fetchAPI(`/roulette-prizes/round/${params.id}`).catch(() => []),
			},
			{
				queryKey: ['round-ouros', params.id],
				queryFn: () =>
					fetchAPI(`/events/round/${params.id}/ouros`).catch(() => []),
			},
		],
	});

	const teams: Team[] = teamsQuery.data ?? [];
	const matches: any[] = matchesQuery.data ?? [];
	const allPlayers: Player[] = playersQuery.data ?? [];
	const awards: any[] = awardsQuery.data ?? [];
	const scores: any[] = scoresQuery.data ?? [];
	const rouletteWinners: RoundRouletteWinner[] = rouletteWinnersQuery.data ?? [];
	const roundOuros: Array<{ player_id: number; count: number }> = ourosQuery.data ?? [];
	const attendance: {
		confirmed_count: number;
		declined_count: number;
		waiting_count: number;
		items: Array<{
			id_attendance: number;
			player_id: number;
			status: 'confirmed' | 'waiting' | 'declined';
			note?: string | null;
			player?: {
				id_player: number;
				nome: string;
				apelido?: string | null;
				potes?: number | null;
				is_guest?: boolean;
			} | null;
		}>;
	} = attendanceQuery.data ?? {
		confirmed_count: 0,
		declined_count: 0,
		waiting_count: 0,
		items: [],
	};

	const teamMap = useMemo(() => {
		const m = new Map<number, string>();
		for (const t of teams) m.set(t.id_team, t.name);
		return m;
	}, [teams]);

	const teamObjMap = useMemo(() => {
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

	const playerMap = useMemo(() => {
		const m = new Map<number, Player>();
		allPlayers.forEach((p) => m.set(p.id_player, p));
		return m;
	}, [allPlayers]);

	const teamStandings = useMemo(() => {
		interface Standing {
			team: Team;
			matchesPlayed: number;
			wins: number;
			draws: number;
			losses: number;
			goalsFor: number;
			goalsAgainst: number;
			goalDifference: number;
			points: number;
		}

		const statsMap = new Map<number, Standing>();
		teams.forEach((t) => {
			statsMap.set(t.id_team, {
				team: t,
				matchesPlayed: 0,
				wins: 0,
				draws: 0,
				losses: 0,
				goalsFor: 0,
				goalsAgainst: 0,
				goalDifference: 0,
				points: 0,
			});
		});

		matches.forEach((m) => {
			if (!m.is_finished) return;
			const hId = m.home_team_id;
			const aId = m.away_team_id;
			const hScore = Number(m.home_score ?? m.score_home ?? 0);
			const aScore = Number(m.away_score ?? m.score_away ?? 0);

			const hStats = statsMap.get(hId);
			const aStats = statsMap.get(aId);

			if (hStats) {
				hStats.matchesPlayed += 1;
				hStats.goalsFor += hScore;
				hStats.goalsAgainst += aScore;
				hStats.goalDifference = hStats.goalsFor - hStats.goalsAgainst;
				if (hScore > aScore) {
					hStats.wins += 1;
					hStats.points += 3;
				} else if (hScore === aScore) {
					hStats.draws += 1;
					hStats.points += 1;
				} else {
					hStats.losses += 1;
				}
			}

			if (aStats) {
				aStats.matchesPlayed += 1;
				aStats.goalsFor += aScore;
				aStats.goalsAgainst += hScore;
				aStats.goalDifference = aStats.goalsFor - aStats.goalsAgainst;
				if (aScore > hScore) {
					aStats.wins += 1;
					aStats.points += 3;
				} else if (hScore === aScore) {
					aStats.draws += 1;
					aStats.points += 1;
				} else {
					aStats.losses += 1;
				}
			}
		});

		const standings: Standing[] = [];
		statsMap.forEach((s) => standings.push(s));

		return standings.sort((a, b) => {
			if (b.points !== a.points) return b.points - a.points;
			if (b.wins !== a.wins) return b.wins - a.wins;
			if (b.goalDifference !== a.goalDifference) return b.goalDifference - a.goalDifference;
			return b.goalsFor - a.goalsFor;
		});
	}, [teams, matches]);

	const playerLeaderboard = useMemo(() => {
		if (!scores || scores.length === 0) return [];

		interface LeaderboardRow {
			player_id: number;
			name: string;
			nickname?: string | null;
			teamName?: string;
			teamColor?: string | null;
			pointsTeam: number;
			pointsIndividual: number;
			pointsCollaboration: number;
			pointsExtraWon: number;
			pointsExtraDrawn: number;
			pointsExtraLost: number;
			totalPoints: number;
		}

		const list: LeaderboardRow[] = scores.map((s: PlayerScore) => {
			const p = playerMap.get(s.player_id);
			const assignedTeam = playerTeamInRoundMap.get(s.player_id);
			const teamObj = assignedTeam ? teamObjMap.get(assignedTeam.id_team) : undefined;

			return {
				player_id: s.player_id,
				name: p?.nome || `Jogador #${s.player_id}`,
				nickname: p?.apelido,
				teamName: assignedTeam?.name || teamObj?.name,
				teamColor: teamObj?.color,
				pointsTeam: Number(s.points_team ?? 0),
				pointsIndividual: Number(s.points_individual ?? 0),
				pointsCollaboration: Number(s.points_collaboration ?? 0),
				pointsExtraWon: Number(s.extra_matches_won ?? 0),
				pointsExtraDrawn: Number(s.extra_matches_drawn ?? 0),
				pointsExtraLost: Number(s.extra_matches_lost ?? 0),
				totalPoints: Number(s.total_points ?? 0),
			};
		});

		return list.sort((a, b) => b.totalPoints - a.totalPoints);
	}, [scores, playerMap, playerTeamInRoundMap, teamObjMap]);

	const filteredPlayers = useMemo(() => {
		const q = playerSearch.toLowerCase().trim();
		const base = !q
			? allPlayers
			: allPlayers.filter(
				(p) =>
					p.nome.toLowerCase().includes(q) ||
					p.apelido?.toLowerCase().includes(q),
			);
		return [...base].sort((a, b) => {
			const aAssigned = playerTeamInRoundMap.has(a.id_player) ? 1 : 0;
			const bAssigned = playerTeamInRoundMap.has(b.id_player) ? 1 : 0;
			if (aAssigned !== bAssigned) return aAssigned - bAssigned;
			return (a.apelido || a.nome).localeCompare(
				b.apelido || b.nome,
				'pt-BR',
			);
		});
	}, [allPlayers, playerSearch, playerTeamInRoundMap]);

	const createTeamMutation = useMutation({
		mutationFn: (body: object) =>
			fetchAPI('/teams/', {
				method: 'POST',
				body: JSON.stringify(body),
			}),
		onSuccess: () => {
			queryClient.invalidateQueries({
				queryKey: ['teams', 'round', params.id],
			});
			queryClient.invalidateQueries({ queryKey: ['teams'] });
			setIsTeamModalOpen(false);
			setTeamName('');
			setTeamColor('blue');
			setSelectedPlayerIds(new Set());
			setPlayerSearch('');
		},
		onError: (err: Error) => alert(`Erro ao criar time: ${err.message}`),
	});

	const createMatchMutation = useMutation({
		mutationFn: (body: object) =>
			fetchAPI('/matches/', {
				method: 'POST',
				body: JSON.stringify(body),
			}),
		onSuccess: (created: any) => {
			queryClient.invalidateQueries({
				queryKey: ['matches', 'round', params.id],
			});
			queryClient.invalidateQueries({ queryKey: ['matches'] });
			setIsMatchModalOpen(false);
			setHomeTeamId('');
			setAwayTeamId('');

			const newMatchId = created?.id_match ?? created?.id;
			if (newMatchId) {
				router.push(`/matches/${newMatchId}`);
			}
		},
		onError: (err: Error) =>
			alert(`Erro ao criar partida: ${err.message}`),
	});

	const calculateScoresMutation = useMutation({
		mutationFn: () =>
			fetchAPI(`/rules/round/${params.id}/calculate-scores`, {
				method: 'POST',
			}),
		onSuccess: (res: { players_scored: number }) => {
			queryClient.invalidateQueries({ queryKey: ['rankings'] });
			queryClient.invalidateQueries({ queryKey: ['rankings', 'round', params.id] });
			queryClient.invalidateQueries({ queryKey: ['awards', 'round', params.id] });
			queryClient.invalidateQueries({ queryKey: ['round-roulette', params.id] });
			queryClient.invalidateQueries({ queryKey: ['round-ouros', params.id] });
			alert(
				`Pontuações calculadas para ${res.players_scored} jogador(es) com sucesso!`,
			);
		},
		onError: (err: Error) =>
			alert(`Erro ao calcular pontuações: ${err.message}`),
	});

	const drawPreviewMutation = useMutation({
		mutationFn: (body: {
			player_ids: number[];
			num_teams: number;
			pote_overrides: Record<number, number | null>;
		}) =>
			fetchAPI('/teams/draw-preview', {
				method: 'POST',
				body: JSON.stringify(body),
			}),
		onSuccess: (res: {
			teams: Array<{
				slot: number;
				name: string;
				players: Array<{ id_player: number }>;
			}>;
		}) => {
			setDraftTeams(
				res.teams.map((t) => ({
					name: t.name,
					playerIds: t.players.map((p) => p.id_player),
				})),
			);
		},
		onError: (err: Error) =>
			alert(`Erro ao sortear times: ${err.message}`),
	});

	const saveBatchTeamsMutation = useMutation({
		mutationFn: (body: {
			overwrite_existing: boolean;
			teams: Array<{ name: string; player_ids: number[] }>;
		}) =>
			fetchAPI(`/teams/round/${params.id}/batch`, {
				method: 'POST',
				body: JSON.stringify(body),
			}),
		onSuccess: () => {
			queryClient.invalidateQueries({
				queryKey: ['teams', 'round', params.id],
			});
			queryClient.invalidateQueries({ queryKey: ['teams'] });
			setIsDrawModalOpen(false);
		},
		onError: (err: Error) =>
			alert(`Erro ao salvar times: ${err.message}`),
	});

	const filteredDrawPlayers = useMemo(() => {
		const q = drawSearch.toLowerCase().trim();
		if (!q) return allPlayers;
		return allPlayers.filter(
			(p) =>
				p.nome.toLowerCase().includes(q) ||
				p.apelido?.toLowerCase().includes(q),
		);
	}, [allPlayers, drawSearch]);

	const assignedPlayerIds = useMemo(() => {
		const s = new Set<number>();
		for (const t of draftTeams) {
			for (const pid of t.playerIds) s.add(pid);
		}
		return s;
	}, [draftTeams]);

	const unassignedPlayers = useMemo(() => {
		if (drawMode === 'manual') {
			return allPlayers.filter((p) => !assignedPlayerIds.has(p.id_player));
		}
		return allPlayers.filter(
			(p) =>
				drawSelectedIds.has(p.id_player) &&
				!assignedPlayerIds.has(p.id_player),
		);
	}, [allPlayers, assignedPlayerIds, drawMode, drawSelectedIds]);

	const myAttendanceMutation = useMutation({
		mutationFn: (status: 'confirmed' | 'waiting' | 'declined') =>
			fetchAPI(`/attendance/round/${params.id}/me`, {
				method: 'POST',
				body: JSON.stringify({ status }),
			}),
		onSuccess: () => {
			queryClient.invalidateQueries({
				queryKey: ['attendance', 'round', params.id],
			});
		},
		onError: (err: Error) =>
			alert(`Erro ao atualizar presença: ${err.message}`),
	});

	const adminAttendanceMutation = useMutation({
		mutationFn: (
			items: Array<{
				player_id: number;
				status: 'confirmed' | 'waiting' | 'declined';
			}>,
		) =>
			fetchAPI(`/attendance/round/${params.id}/batch`, {
				method: 'POST',
				body: JSON.stringify({ items }),
			}),
		onSuccess: () => {
			queryClient.invalidateQueries({
				queryKey: ['attendance', 'round', params.id],
			});
			setIsAttendanceModalOpen(false);
		},
		onError: (err: Error) =>
			alert(`Erro ao salvar lista de presença: ${err.message}`),
	});

	const removeAttendanceMutation = useMutation({
		mutationFn: (playerId: number) =>
			fetchAPI(`/attendance/round/${params.id}/player/${playerId}`, {
				method: 'DELETE',
			}),
		onSuccess: () => {
			queryClient.invalidateQueries({
				queryKey: ['attendance', 'round', params.id],
			});
		},
	});

	const openAttendanceModal = () => {
		const draft: Record<number, 'confirmed' | 'waiting' | 'declined' | ''> =
			{};
		for (const item of attendance.items) {
			draft[item.player_id] = item.status;
		}
		setAttendanceDraft(draft);
		setAttendanceSearch('');
		setIsAttendanceModalOpen(true);
	};

	const openDrawModal = () => {
		setDrawMode('draw');
		setDrawSearch('');
		setOverwriteExisting(teams.length > 0);
		if (teams.length > 0) {
			setNumTeams(Math.max(2, Math.min(6, teams.length)));
			setDraftTeams(
				teams.map((t) => ({
					name: t.name,
					playerIds: (t.players ?? []).map((p) => p.id_player),
				})),
			);
			const initialIds = new Set<number>();
			for (const t of teams) {
				for (const p of t.players ?? []) initialIds.add(p.id_player);
			}
			setDrawSelectedIds(initialIds);
		} else {
			setNumTeams(4);
			setDraftTeams([]);
			const confirmedIds = new Set<number>(
				attendance.items
					.filter((item) => item.status === 'confirmed')
					.map((item) => item.player_id),
			);
			setDrawSelectedIds(confirmedIds);
		}
		setPoteOverrides({});
		setIsDrawModalOpen(true);
	};

	const initManualTeams = (count: number) => {
		setDraftTeams(
			Array.from({ length: count }, (_, idx) => ({
				name: `Time ${idx + 1}`,
				playerIds: [],
			})),
		);
	};

	const handleRunDraw = () => {
		if (drawSelectedIds.size < numTeams) {
			alert(`Selecione pelo menos ${numTeams} jogadores para sortear.`);
			return;
		}
		drawPreviewMutation.mutate({
			player_ids: Array.from(drawSelectedIds),
			num_teams: numTeams,
			pote_overrides: poteOverrides,
		});
	};

	const movePlayerToTeam = (playerId: number, targetIndex: number) => {
		setDraftTeams((prev) =>
			prev.map((team, idx) => {
				const filtered = team.playerIds.filter((id) => id !== playerId);
				if (idx === targetIndex) {
					return { ...team, playerIds: [...filtered, playerId] };
				}
				return { ...team, playerIds: filtered };
			}),
		);
	};

	const removePlayerFromDraft = (playerId: number) => {
		setDraftTeams((prev) =>
			prev.map((team) => ({
				...team,
				playerIds: team.playerIds.filter((id) => id !== playerId),
			})),
		);
	};

	const togglePlayer = (id: number) => {
		if (playerTeamInRoundMap.has(id)) return;
		setSelectedPlayerIds((prev) => {
			const next = new Set(prev);
			next.has(id) ? next.delete(id) : next.add(id);
			return next;
		});
	};

	const handleCreateTeam = (e: React.FormEvent) => {
		e.preventDefault();
		createTeamMutation.mutate({
			name: teamName.trim(),
			color: teamColor || undefined,
			round_id: parseInt(params.id, 10),
			player_ids: Array.from(selectedPlayerIds),
		});
	};

	const handleCreateMatch = (e: React.FormEvent) => {
		e.preventDefault();
		if (homeTeamId === awayTeamId) {
			alert('Selecione dois times diferentes.');
			return;
		}
		createMatchMutation.mutate({
			round_id: parseInt(params.id, 10),
			home_team_id: parseInt(homeTeamId, 10),
			away_team_id: parseInt(awayTeamId, 10),
			score_home: 0,
			score_away: 0,
		});
	};

	const updateRoundMutation = useMutation({
		mutationFn: (body: object) =>
			fetchAPI(`/rounds/${params.id}`, {
				method: 'PUT',
				body: JSON.stringify(body),
			}),
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ['round', params.id] });
			queryClient.invalidateQueries({ queryKey: ['rounds'] });
			setIsEditRoundOpen(false);
		},
		onError: (err: Error) =>
			alert(`Erro ao atualizar rodada: ${err.message}`),
	});

	const deleteRoundMutation = useMutation({
		mutationFn: (seasonId: number) =>
			fetchAPI(`/rounds/${params.id}`, { method: 'DELETE' }).then(
				() => seasonId,
			),
		onSuccess: (seasonId: number) => {
			queryClient.invalidateQueries({ queryKey: ['rounds'] });
			router.push(seasonId ? `/seasons/${seasonId}` : '/seasons');
		},
		onError: (err: Error) =>
			alert(`Erro ao excluir rodada: ${err.message}`),
	});

	if (roundQuery.isLoading || teamsQuery.isLoading || matchesQuery.isLoading)
		return <Loading />;
	if (!roundQuery.data)
		return <div className="text-muted p-4">Rodada não encontrada.</div>;

	const round: Round = roundQuery.data;

	const formattedRoundDate = (() => {
		if (!round.date) return 'Data não definida';
		const str = new Date(round.date).toLocaleDateString('pt-BR', {
			weekday: 'short',
			day: '2-digit',
			month: 'short',
			year: 'numeric',
		});
		return str.charAt(0).toUpperCase() + str.slice(1).replace(/\./g, '');
	})();

	const hasTeams = teams.length > 0;
	const hasMatches = matches.length > 0;
	const isFinished =
		hasMatches && matches.every((m) => Boolean(m.is_finished));
	const isConcluida = isFinished || Boolean(scores && scores.length > 0);

	const pizzaAward = awards.find(
		(a) => a.event_type === 'pizza' || a.event_type === 'time_vencedor_rodada',
	);
	const bolaCheia = awards.find((a) => a.event_type === 'bola_cheia');
	const bolaMurcha = awards.find((a) => a.event_type === 'bola_murcha');
	const golRodada = awards.find((a) => a.event_type === 'gol_rodada');
	const defesaRodada = awards.find((a) => a.event_type === 'defesa_rodada');
	const dribleRodada = awards.find((a) => a.event_type === 'drible_rodada');
	const inacreditavel = awards.find((a) => a.event_type === 'inacreditavel');
	const goleiro = awards.find((a) => a.event_type === 'goleiro_menos_vazado');
	const roleta1 = rouletteWinners.find((r) => r.roulette_number === 1);
	const roleta2 = rouletteWinners.find((r) => r.roulette_number === 2);
	const ourosWinners = roundOuros.filter((o) => o.count > 0);

	const statusBadge = (() => {
		if (isConcluida) {
			return {
				label: 'Concluída',
				className: 'bg-emerald-500/15 text-[#4ade80]',
			};
		}
		if (hasMatches) {
			return {
				label: 'Partidas em andamento',
				className: 'bg-emerald-500/15 text-[#4ade80]',
			};
		}
		if (hasTeams) {
			return {
				label: 'Times definidos',
				className: 'bg-blue-500/15 text-[#60a5fa]',
			};
		}
		return {
			label: 'Aguardando presença',
			className: 'bg-yellow-400/15 text-[#facc15]',
		};
	})();

	const noResponseCount = Math.max(
		0,
		allPlayers.length - attendance.items.length,
	);
	const maxVacancies = 20;
	const capacityPct = Math.min(
		100,
		(attendance.confirmed_count / maxVacancies) * 100,
	);

	const openEditRoundModal = () => {
		setEditRoundNumber(String(round.round_number));
		setEditRoundDate(
			round.date ? new Date(round.date).toISOString().slice(0, 10) : '',
		);
		setEditRoundLocation(round.location ?? '');
		setEditRoundReferee(round.referee ?? '');
		setIsMenuOpen(false);
		setIsEditRoundOpen(true);
	};

	const handleDeleteRound = () => {
		setIsMenuOpen(false);
		if (
			window.confirm(
				`Tem certeza que deseja excluir a Rodada ${round.round_number}?`,
			)
		) {
			deleteRoundMutation.mutate(round.season_id);
		}
	};

	return (
		<div className="max-w-[1100px] w-full mx-auto flex flex-col gap-5 text-main animate-slide-down">
			{/* Header Row */}
			<div className="flex flex-wrap items-start justify-between gap-4">
				<div>
					<button
						type="button"
						onClick={() =>
							router.push(
								round.season_id
									? `/seasons/${round.season_id}`
									: '/seasons',
							)
						}
						className="text-[13px] text-muted hover:text-main transition-colors mb-1.5 inline-flex items-center gap-1.5 cursor-pointer"
					>
						<ArrowLeft size={16} /> Rodadas
					</button>
					<div className="flex items-center gap-3 flex-wrap">
						<h1 className="m-0 text-[28px] font-bold tracking-[-0.01em] text-main">
							Rodada {round.round_number}
						</h1>
						<span
							className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold ${statusBadge.className}`}
						>
							● {statusBadge.label}
						</span>
					</div>
					<p className="text-muted mt-1.5 text-sm">
						{formattedRoundDate} · {round.location} · Juiz:{' '}
						{round.referee}
					</p>
				</div>

				{isAdmin && (
					<div className="flex items-center gap-2">
						<button
							type="button"
							onClick={openEditRoundModal}
							className="inline-flex items-center justify-center gap-2 min-h-[40px] px-4 rounded-[10px] border border-border bg-surface hover:bg-nav-hover text-main font-medium text-sm transition-colors cursor-pointer"
						>
							Editar rodada
						</button>

						<div className="relative" ref={menuRef}>
							<button
								type="button"
								onClick={() => setIsMenuOpen((prev) => !prev)}
								title="Mais opções"
								aria-label="Mais opções"
								className="inline-flex items-center justify-center min-h-[40px] w-10 p-0 rounded-[10px] border border-border bg-surface hover:bg-nav-hover text-main text-lg transition-colors cursor-pointer"
							>
								⋯
							</button>

							{isMenuOpen && (
								<div className="absolute right-0 mt-2 w-56 rounded-xl bg-surface border border-border shadow-xl py-1.5 z-30">
									<button
										type="button"
										onClick={() => {
											setIsMenuOpen(false);
											openDrawModal();
										}}
										className="w-full px-4 py-2 text-left text-sm text-main hover:bg-nav-hover flex items-center gap-2.5 transition-colors cursor-pointer"
									>
										<span>🎲</span> Sortear / Montar times
									</button>
									<button
										type="button"
										disabled={
											matches.length === 0 ||
											calculateScoresMutation.isPending
										}
										onClick={() => {
											setIsMenuOpen(false);
											calculateScoresMutation.mutate();
										}}
										className="w-full px-4 py-2 text-left text-sm text-main hover:bg-nav-hover disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-2.5 transition-colors cursor-pointer"
									>
										<span>⚡</span> Calcular pontuações
									</button>
									<div className="my-1 border-t border-border" />
									<button
										type="button"
										disabled={deleteRoundMutation.isPending}
										onClick={handleDeleteRound}
										className="w-full px-4 py-2 text-left text-sm text-[#f87171] hover:bg-red-500/10 flex items-center gap-2.5 transition-colors cursor-pointer"
									>
										<span>🗑️</span>{' '}
										{deleteRoundMutation.isPending
											? 'Excluindo...'
											: 'Excluir rodada'}
									</button>
								</div>
							)}
						</div>
					</div>
				)}
			</div>

			{/* Banner de Resultados no Topo (substituindo a barra de 4 etapas) */}
			{isConcluida && (
				<div className="bg-gradient-to-r from-emerald-500/10 via-blue-500/10 to-purple-500/10 border border-emerald-500/30 rounded-2xl p-4 sm:p-5 flex flex-wrap items-center justify-between gap-4">
					<div className="flex items-center gap-3.5">
						<div className="w-11 h-11 rounded-xl bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-emerald-500 shrink-0">
							<CheckCircle2 size={24} />
						</div>
						<div>
							<h2 className="text-lg font-bold text-main flex items-center gap-2">
								Resultados da Rodada
								<span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-600 dark:text-emerald-300 border border-emerald-500/30">
									Rodada Concluída
								</span>
							</h2>
							<p className="text-xs text-muted mt-0.5">
								Premiações oficiais, classificação final dos times e pontuações individuais dos jogadores.
							</p>
						</div>
					</div>

					<div className="flex items-center gap-2 flex-wrap">
						{isAdmin && (
							<button
								type="button"
								disabled={calculateScoresMutation.isPending}
								onClick={() => calculateScoresMutation.mutate()}
								className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-primary hover:bg-primary-hover text-white text-xs font-semibold transition-colors shadow-sm cursor-pointer disabled:opacity-50"
							>
								<Zap size={14} />
								{calculateScoresMutation.isPending ? 'Calculando...' : 'Recalcular Pontuações'}
							</button>
						)}
						<Link
							href={`/awards?round=${round.id_round}`}
							className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-surface hover:bg-nav-hover border border-border text-xs font-medium text-main transition-colors"
						>
							<Award size={14} />
							Gerenciar Prêmios
						</Link>
					</div>
				</div>
			)}

			{/* Navegação por Abas: Pontuação e Detalhes */}
			<div className="flex items-center gap-2 border-b border-border pb-1">
				<button
					type="button"
					onClick={() => setActiveTab('pontuacao')}
					className={`inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold transition-all cursor-pointer ${
						activeTab === 'pontuacao'
							? 'bg-primary text-white shadow-md shadow-primary/20'
							: 'text-muted hover:text-main hover:bg-nav-hover'
					}`}
				>
					<Trophy size={16} />
					<span>Pontuação</span>
					{isConcluida && (
						<span className="w-2 h-2 rounded-full bg-emerald-500" />
					)}
				</button>

				<button
					type="button"
					onClick={() => setActiveTab('detalhes')}
					className={`inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold transition-all cursor-pointer ${
						activeTab === 'detalhes'
							? 'bg-primary text-white shadow-md shadow-primary/20'
							: 'text-muted hover:text-main hover:bg-nav-hover'
					}`}
				>
					<ClipboardList size={16} />
					<span>Detalhes</span>
					<span className="text-xs font-normal opacity-70">
						({attendance.confirmed_count} pres. · {teams.length} times · {matches.length} jogos)
					</span>
				</button>

				<button
					type="button"
					onClick={() => setActiveTab('votacao')}
					className={`inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold transition-all cursor-pointer ${
						activeTab === 'votacao'
							? 'bg-primary text-white shadow-md shadow-primary/20'
							: 'text-muted hover:text-main hover:bg-nav-hover'
					}`}
				>
					<Sparkles size={16} />
					<span>Votação dos Destaques</span>
				</button>
			</div>

			{/* Conteúdo da Aba 2: Detalhes */}
			{activeTab === 'detalhes' && (
				<>
					{/* Lista de Presença */}
					<div className="bg-surface border border-border rounded-[16px] p-6 flex flex-col gap-[18px]">
				<div className="flex flex-wrap items-center justify-between gap-3">
					<h2 className="m-0 text-lg font-semibold text-main">
						Lista de presença
					</h2>
					<div className="flex flex-wrap items-center gap-2">
						<button
							type="button"
							disabled={myAttendanceMutation.isPending}
							onClick={() =>
								myAttendanceMutation.mutate('confirmed')
							}
							className="inline-flex items-center justify-center gap-1.5 min-h-[36px] px-3 rounded-[10px] border border-emerald-500/35 bg-emerald-500/10 hover:bg-emerald-500/20 text-[#4ade80] text-xs font-semibold transition-colors cursor-pointer"
						>
							✓ Vou jogar
						</button>
						<button
							type="button"
							disabled={myAttendanceMutation.isPending}
							onClick={() =>
								myAttendanceMutation.mutate('waiting')
							}
							className="inline-flex items-center justify-center gap-1.5 min-h-[36px] px-3 rounded-[10px] border border-yellow-400/35 bg-yellow-400/10 hover:bg-yellow-400/20 text-[#facc15] text-xs font-semibold transition-colors cursor-pointer"
						>
							⏳ Espera
						</button>
						<button
							type="button"
							disabled={myAttendanceMutation.isPending}
							onClick={() =>
								myAttendanceMutation.mutate('declined')
							}
							className="inline-flex items-center justify-center gap-1.5 min-h-[36px] px-3 rounded-[10px] border border-red-500/35 bg-red-500/10 hover:bg-red-500/20 text-[#f87171] text-xs font-semibold transition-colors cursor-pointer"
						>
							✕ Não vou
						</button>
						{isAdmin && (
							<button
								type="button"
								onClick={openAttendanceModal}
								className="inline-flex items-center justify-center gap-2 min-h-[40px] px-4 rounded-[10px] bg-[#2563eb] hover:bg-blue-500 text-white font-semibold text-sm transition-colors cursor-pointer"
							>
								Gerenciar lista
							</button>
						)}
					</div>
				</div>

				{/* 4 Stat Tiles */}
				<div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
					<div className="bg-background border border-border rounded-xl p-4">
						<div className="text-[26px] font-bold text-[#4ade80] leading-tight">
							{attendance.confirmed_count}
						</div>
						<div className="text-xs text-muted mt-1">
							Confirmados
						</div>
					</div>
					<div className="bg-background border border-border rounded-xl p-4">
						<div className="text-[26px] font-bold text-[#facc15] leading-tight">
							{attendance.waiting_count}
						</div>
						<div className="text-xs text-muted mt-1">
							Lista de espera
						</div>
					</div>
					<div className="bg-background border border-border rounded-xl p-4">
						<div className="text-[26px] font-bold text-main leading-tight">
							{attendance.declined_count}
						</div>
						<div className="text-xs text-muted mt-1">
							Não vão
						</div>
					</div>
					<div className="bg-background border border-border rounded-xl p-4">
						<div className="text-[26px] font-bold text-main leading-tight">
							{noResponseCount}
						</div>
						<div className="text-xs text-muted mt-1">
							Sem resposta
						</div>
					</div>
				</div>

				{/* Capacity Progress Bar */}
				<div>
					<div className="flex justify-between text-[13px] text-muted">
						<span>Confirmados</span>
						<span>
							{attendance.confirmed_count} de {maxVacancies} vagas
						</span>
					</div>
					<div className="h-2 rounded bg-border mt-2 overflow-hidden">
						<div
							className="h-full bg-emerald-500 transition-all duration-300"
							style={{ width: `${capacityPct}%` }}
						/>
					</div>
				</div>

				{attendance.items.length > 0 && (
					<div className="flex flex-wrap gap-2 pt-1 border-t border-border">
						{attendance.items.map((item) => {
							const label =
								item.player?.apelido ||
								item.player?.nome ||
								`#${item.player_id}`;
							const badgeStyle =
								item.status === 'confirmed'
									? 'bg-emerald-500/15 border-emerald-500/30 text-emerald-600 dark:text-[#4ade80]'
									: item.status === 'waiting'
										? 'bg-yellow-400/15 border-yellow-400/30 text-amber-600 dark:text-[#facc15]'
										: 'bg-surface border-border text-muted line-through';
							return (
								<div
									key={item.id_attendance}
									className={`flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full border ${badgeStyle}`}
								>
									<span>{label}</span>
									{item.player?.potes ? (
										<span className="opacity-75">
											P{item.player.potes}
										</span>
									) : null}
									{isAdmin && (
										<button
											type="button"
											onClick={() =>
												removeAttendanceMutation.mutate(
													item.player_id,
												)
											}
											className="ml-1 opacity-70 hover:opacity-100 cursor-pointer"
											title="Remover da lista"
										>
											×
										</button>
									)}
								</div>
							);
						})}
					</div>
				)}
			</div>

			{/* 2-Column Grid: Times & Partidas */}
			<div className="grid grid-cols-1 lg:grid-cols-2 gap-5 items-start">
				{/* Times */}
				<div className="bg-surface border border-border rounded-[16px] p-6 flex flex-col gap-[18px]">
					<div className="flex flex-wrap items-center justify-between gap-2">
						<h2 className="m-0 text-lg font-semibold text-main">
							Times{' '}
							<span className="text-muted font-normal">
								({teams.length})
							</span>
						</h2>
						{isAdmin && (
							<div className="flex items-center gap-2">
								{teams.length > 0 && (
									<button
										type="button"
										onClick={openDrawModal}
										className="inline-flex items-center justify-center gap-2 min-h-[40px] px-3.5 rounded-[10px] border border-border bg-surface hover:bg-nav-hover text-main font-medium text-sm transition-colors cursor-pointer"
									>
										Sortear times
									</button>
								)}
								<button
									type="button"
									onClick={() => {
										setTeamName('');
										setSelectedPlayerIds(new Set());
										setPlayerSearch('');
										setIsTeamModalOpen(true);
									}}
									className="inline-flex items-center justify-center gap-2 min-h-[40px] px-4 rounded-[10px] border border-border bg-surface hover:bg-nav-hover text-main font-medium text-sm transition-colors cursor-pointer"
								>
									+ Time
								</button>
							</div>
						)}
					</div>

					{teams.length === 0 ? (
						<div className="border border-dashed border-border rounded-xl py-7 px-5 text-center text-muted flex flex-col gap-3 items-center">
							<div className="text-sm">
								Nenhum time ainda. Sorteie automaticamente a
								partir dos confirmados ou crie manualmente.
							</div>
							{isAdmin && (
								<>
									<button
										type="button"
										disabled={
											attendance.confirmed_count === 0 &&
											allPlayers.length === 0
										}
										onClick={openDrawModal}
										className="inline-flex items-center justify-center gap-2 min-h-[40px] px-4 rounded-[10px] border border-border bg-surface hover:bg-nav-hover disabled:opacity-45 disabled:cursor-not-allowed text-main font-medium text-sm transition-colors cursor-pointer"
									>
										Sortear times
									</button>
									<small className="text-xs text-muted">
										Disponível quando houver confirmados.
									</small>
								</>
							)}
						</div>
					) : (
						<div className="border border-border rounded-xl divide-y divide-border overflow-hidden">
							{teams.map((t) => (
								<Link
									key={t.id_team}
									href={`/teams/${t.id_team}`}
									className="flex items-center justify-between gap-3 px-4 py-3.5 bg-surface hover:bg-nav-hover transition-colors text-sm text-main"
								>
									<div className="flex flex-col gap-1 min-w-0">
										<div className="flex items-center gap-2">
											<span className="font-semibold">
												{t.name}
											</span>
											<TeamColorTag color={t.color} />
										</div>
										{t.players && t.players.length > 0 && (
											<span className="text-xs text-muted truncate">
												{t.players
													.map(
														(p) =>
															p.apelido || p.nome,
													)
													.join(', ')}
											</span>
										)}
									</div>
									<span className="text-xs text-[#60a5fa] shrink-0">
										Editar / Ver →
									</span>
								</Link>
							))}
						</div>
					)}
				</div>

				{/* Partidas */}
				<div className="bg-surface border border-border rounded-[16px] p-6 flex flex-col gap-[18px]">
					<div className="flex flex-wrap items-center justify-between gap-2">
						<h2 className="m-0 text-lg font-semibold text-main">
							Partidas{' '}
							<span className="text-muted font-normal">
								({matches.length})
							</span>
						</h2>
						{isAdmin && (
							<div className="flex items-center gap-2">
								<Link
									href={`/rounds/${params.id}/mass`}
									className="inline-flex items-center justify-center gap-2 min-h-[40px] px-4 rounded-[10px] border border-blue-600/30 dark:border-blue-500/40 bg-blue-50 hover:bg-blue-100 text-blue-700 dark:bg-blue-500/15 dark:hover:bg-blue-500/25 dark:text-blue-300 text-sm font-semibold transition-colors cursor-pointer shadow-sm"
								>
									<Zap size={15} className="text-blue-600 dark:text-blue-400" />
									<span>⚡ Cadastro em Massa</span>
								</Link>
								<button
									type="button"
									disabled={
										matches.length === 0 ||
										calculateScoresMutation.isPending
									}
									onClick={() =>
										calculateScoresMutation.mutate()
									}
									className="inline-flex items-center justify-center gap-2 min-h-[40px] px-4 rounded-[10px] border border-border bg-surface hover:bg-nav-hover disabled:opacity-45 disabled:cursor-not-allowed text-main font-medium text-sm transition-colors cursor-pointer"
								>
									{calculateScoresMutation.isPending
										? 'Calculando...'
										: 'Calcular pontuações'}
								</button>
								<button
									type="button"
									disabled={teams.length < 2}
									onClick={() => setIsMatchModalOpen(true)}
									className="inline-flex items-center justify-center gap-2 min-h-[40px] px-4 rounded-[10px] bg-primary hover:bg-primary-hover disabled:opacity-45 disabled:cursor-not-allowed text-white font-semibold text-sm transition-colors cursor-pointer"
								>
									+ Partida
								</button>
							</div>
						)}
					</div>

					{matches.length === 0 ? (
						<div className="border border-dashed border-border rounded-xl py-7 px-5 text-center text-muted flex flex-col gap-3 items-center">
							<div className="text-sm">
								Nenhuma partida criada. Crie os times primeiro
								para poder lançar partidas.
							</div>
						</div>
					) : (
						<div className="flex flex-col gap-2.5">
							{matches.map((m) => {
								const matchId = m.id_match ?? m.id;
								const hScore =
									m.home_score ?? m.score_home ?? 0;
								const aScore =
									m.away_score ?? m.score_away ?? 0;
								const homeTeam = teamObjMap.get(m.home_team_id);
								const awayTeam = teamObjMap.get(m.away_team_id);
								return (
									<Link
										key={matchId}
										href={`/matches/${matchId}`}
										className="bg-background border border-border rounded-xl p-4 flex items-center justify-between hover:border-primary/50 hover:bg-nav-hover/50 transition-colors"
									>
										<span className="text-sm font-medium text-main flex items-center gap-1.5 flex-wrap">
											<span>{homeTeam?.name ?? `Time #${m.home_team_id}`}</span>
											{homeTeam && <TeamColorTag showLabel={false} color={homeTeam.color} />}
											<span className="text-muted px-1">vs</span>
											<span>{awayTeam?.name ?? `Time #${m.away_team_id}`}</span>
											{awayTeam && <TeamColorTag showLabel={false} color={awayTeam.color} />}
										</span>
										<span className="flex items-center gap-2.5">
											<span
												className={`text-[11px] font-semibold px-2 py-0.5 rounded-full uppercase tracking-wider border ${m.is_finished
													? 'bg-surface text-muted border-border'
													: 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30'
													}`}
											>
												{m.is_finished ? 'Encerrada' : 'Em andamento'}
											</span>
											<span className="text-base font-bold text-primary bg-surface border border-border px-3 py-1 rounded-lg">
												{hScore} x {aScore}
											</span>
										</span>
									</Link>
								);
							})}
						</div>
					)}
				</div>
			</div>
		</>
	)}

	{/* Conteúdo da Aba 1: Pontuação */}
	{activeTab === 'pontuacao' && (
		<div className="flex flex-col gap-6">
			{/* 1. Vencedores das Premiações */}
					<div className="bg-surface border border-border rounded-2xl p-6 flex flex-col gap-5">
						<div className="flex items-center justify-between gap-3 flex-wrap">
							<div className="flex items-center gap-2.5">
								<div className="w-8 h-8 rounded-lg bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-500">
									<Trophy size={18} />
								</div>
								<div>
									<h3 className="text-base font-semibold text-main">
										Premiações da Rodada
									</h3>
									<p className="text-xs text-muted">
										Vencedores de destaques, time campeão e contemplados nos sorteios da roleta
									</p>
								</div>
							</div>
						</div>

						{/* Grid de Cards de Premiação */}
						<div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
							{/* Card Campeão da Rodada (Pizza) */}
							<div className="bg-gradient-to-br from-amber-500/10 via-amber-500/[0.03] to-transparent border border-amber-500/30 rounded-xl p-4 flex flex-col gap-2.5 relative overflow-hidden">
								<div className="flex items-center justify-between">
									<span className="text-xl">🍕</span>
									<span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-600 dark:text-amber-300 border border-amber-500/30">
										Campeão
									</span>
								</div>
								<div>
									<h4 className="text-xs font-semibold text-muted uppercase tracking-wider">
										Campeão da Rodada (Pizza)
									</h4>
									<div className="flex items-center gap-2 mt-1">
										<p className="text-base font-bold text-main">
											{pizzaAward?.teams?.length
												? pizzaAward.teams.map((t: any) => t.name).join(', ')
												: teamStandings[0]?.team.name || 'A definir'}
										</p>
										{(() => {
											const championTeam = pizzaAward?.teams?.length
												? teamObjMap.get(pizzaAward.teams[0].id_team)
												: teamStandings[0]?.team;
											return championTeam ? (
												<TeamColorTag color={championTeam.color} showLabel={false} />
											) : null;
										})()}
									</div>
								</div>
								<p className="text-[11px] text-amber-300/80 mt-auto">
									Levou a melhor na rodada e garantiu a pizza!
								</p>
							</div>

							{/* Card Bola Cheia */}
							<div className="bg-surface border border-border rounded-xl p-4 flex flex-col gap-2.5">
								<div className="flex items-center justify-between">
									<span className="text-xl">🌟</span>
									<span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-yellow-500/15 text-yellow-600 dark:text-yellow-300 border border-yellow-500/30">
										Destaque
									</span>
								</div>
								<div>
									<h4 className="text-xs font-semibold text-muted uppercase tracking-wider">
										Bola Cheia (MVP)
									</h4>
									<p className="text-base font-bold text-main mt-1">
										{bolaCheia?.players?.length
											? bolaCheia.players.map((p: any) => p.apelido || p.nome).join(', ')
											: 'Não definido'}
									</p>
								</div>
								<p className="text-[11px] text-muted mt-auto">
									Melhor atuação geral da rodada.
								</p>
							</div>

							{/* Card Bola Murcha */}
							<div className="bg-surface border border-border rounded-xl p-4 flex flex-col gap-2.5">
								<div className="flex items-center justify-between">
									<span className="text-xl">💩</span>
									<span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-stone-500/15 text-stone-600 dark:text-stone-300 border border-stone-500/30">
										Zoeira
									</span>
								</div>
								<div>
									<h4 className="text-xs font-semibold text-muted uppercase tracking-wider">
										Bola Murcha
									</h4>
									<p className="text-base font-bold text-main mt-1">
										{bolaMurcha?.players?.length
											? bolaMurcha.players.map((p: any) => p.apelido || p.nome).join(', ')
											: 'Não definido'}
									</p>
								</div>
								<p className="text-[11px] text-muted mt-auto">
									Pior em campo / destaque negativo.
								</p>
							</div>

							{/* Card Gol da Rodada */}
							<div className="bg-surface border border-border rounded-xl p-4 flex flex-col gap-2.5">
								<div className="flex items-center justify-between">
									<span className="text-xl">⚽</span>
									<span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-blue-500/15 text-blue-600 dark:text-blue-300 border border-blue-500/30">
										Pintura
									</span>
								</div>
								<div>
									<h4 className="text-xs font-semibold text-muted uppercase tracking-wider">
										Gol da Rodada
									</h4>
									<p className="text-base font-bold text-main mt-1">
										{golRodada?.players?.length
											? golRodada.players.map((p: any) => p.apelido || p.nome).join(', ')
											: 'Não definido'}
									</p>
								</div>
								<p className="text-[11px] text-muted mt-auto">
									O gol mais bonito do dia.
								</p>
							</div>

							{/* Card Defesa da Rodada */}
							<div className="bg-surface border border-border rounded-xl p-4 flex flex-col gap-2.5">
								<div className="flex items-center justify-between">
									<span className="text-xl">🧤</span>
									<span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-cyan-500/15 text-cyan-600 dark:text-cyan-300 border border-cyan-500/30">
										Milagre
									</span>
								</div>
								<div>
									<h4 className="text-xs font-semibold text-muted uppercase tracking-wider">
										Defesa da Rodada
									</h4>
									<p className="text-base font-bold text-main mt-1">
										{defesaRodada?.players?.length
											? defesaRodada.players.map((p: any) => p.apelido || p.nome).join(', ')
											: 'Não definido'}
									</p>
								</div>
								<p className="text-[11px] text-muted mt-auto">
									A defesa mais espetacular da rodada.
								</p>
							</div>

							{/* Card Drible da Rodada */}
							<div className="bg-surface border border-border rounded-xl p-4 flex flex-col gap-2.5">
								<div className="flex items-center justify-between">
									<span className="text-xl">🌀</span>
									<span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-purple-500/15 text-purple-600 dark:text-purple-300 border border-purple-500/30">
										Habilidade
									</span>
								</div>
								<div>
									<h4 className="text-xs font-semibold text-muted uppercase tracking-wider">
										Drible da Rodada
									</h4>
									<p className="text-base font-bold text-main mt-1">
										{dribleRodada?.players?.length
											? dribleRodada.players.map((p: any) => p.apelido || p.nome).join(', ')
											: 'Não definido'}
									</p>
								</div>
								<p className="text-[11px] text-muted mt-auto">
									O drible mais desconcertante.
								</p>
							</div>

							{/* Card Inacreditável */}
							<div className="bg-surface border border-border rounded-xl p-4 flex flex-col gap-2.5">
								<div className="flex items-center justify-between">
									<span className="text-xl">😱</span>
									<span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-rose-500/15 text-rose-600 dark:text-rose-300 border border-rose-500/30">
										Inacreditável
									</span>
								</div>
								<div>
									<h4 className="text-xs font-semibold text-muted uppercase tracking-wider">
										Inacreditável
									</h4>
									<p className="text-base font-bold text-main mt-1">
										{inacreditavel?.players?.length
											? inacreditavel.players.map((p: any) => p.apelido || p.nome).join(', ')
											: 'Não definido'}
									</p>
								</div>
								<p className="text-[11px] text-muted mt-auto">
									O gol mais fácil perdido do dia.
								</p>
							</div>

							{/* Card Goleiro Menos Vazado */}
							<div className="bg-surface border border-border rounded-xl p-4 flex flex-col gap-2.5">
								<div className="flex items-center justify-between">
									<span className="text-xl">🥅</span>
									<span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-indigo-500/15 text-indigo-600 dark:text-indigo-300 border border-indigo-500/30">
										Paredão
									</span>
								</div>
								<div>
									<h4 className="text-xs font-semibold text-muted uppercase tracking-wider">
										Goleiro Menos Vazado
									</h4>
									<p className="text-base font-bold text-main mt-1">
										{goleiro?.players?.length
											? goleiro.players.map((p: any) => p.apelido || p.nome).join(', ')
											: 'Não definido'}
									</p>
								</div>
								<p className="text-[11px] text-muted mt-auto">
									Goleiro mais consistente e com menos gols sofridos.
								</p>
							</div>

							{/* Card Roleta 1 */}
							<div className="bg-surface border border-emerald-500/25 rounded-xl p-4 flex flex-col gap-2.5 relative">
								<div className="flex items-center justify-between">
									<span className="text-xl">🎰</span>
									<span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-600 dark:text-emerald-300 border border-emerald-500/30">
										Roleta 1
									</span>
								</div>
								<div>
									<h4 className="text-xs font-semibold text-muted uppercase tracking-wider">
										Contemplado Roleta 1
									</h4>
									<p className="text-base font-bold text-main mt-1">
										{roleta1?.player_name ||
											(roleta1?.player_id
												? (playerMap.get(roleta1.player_id)?.apelido || playerMap.get(roleta1.player_id)?.nome)
												: 'Não definido')}
									</p>
								</div>
								<div className="mt-auto pt-1">
									{roleta1?.prize_name ? (
										<span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-600 dark:text-emerald-300 bg-emerald-500/10 border border-emerald-500/25 px-2 py-0.5 rounded-md">
											<Gift size={12} /> {roleta1.prize_name}
										</span>
									) : (
										<span className="text-[11px] text-muted">
											Prêmio a registrar
										</span>
									)}
								</div>
							</div>

							{/* Card Roleta 2 */}
							<div className="bg-surface border border-teal-500/25 rounded-xl p-4 flex flex-col gap-2.5 relative">
								<div className="flex items-center justify-between">
									<span className="text-xl">🎰</span>
									<span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-teal-500/15 text-teal-600 dark:text-teal-300 border border-teal-500/30">
										Roleta 2
									</span>
								</div>
								<div>
									<h4 className="text-xs font-semibold text-muted uppercase tracking-wider">
										Contemplado Roleta 2
									</h4>
									<p className="text-base font-bold text-main mt-1">
										{roleta2?.player_name ||
											(roleta2?.player_id
												? (playerMap.get(roleta2.player_id)?.apelido || playerMap.get(roleta2.player_id)?.nome)
												: 'Não definido')}
									</p>
								</div>
								<div className="mt-auto pt-1">
									{roleta2?.prize_name ? (
										<span className="inline-flex items-center gap-1 text-[11px] font-semibold text-teal-600 dark:text-teal-300 bg-teal-500/10 border border-teal-500/25 px-2 py-0.5 rounded-md">
											<Gift size={12} /> {roleta2.prize_name}
										</span>
									) : (
										<span className="text-[11px] text-muted">
											Prêmio a registrar
										</span>
									)}
								</div>
							</div>
						</div>

						{/* Ouros da Rodada */}
						{ourosWinners.length > 0 && (
							<div className="bg-amber-500/[0.04] border border-amber-500/20 rounded-xl p-3.5 flex flex-wrap items-center justify-between gap-3">
								<div className="flex items-center gap-2">
									<span className="text-lg">🥇</span>
									<span className="text-xs font-semibold text-amber-600 dark:text-amber-300">
										Ouros da Rodada:
									</span>
								</div>
								<div className="flex flex-wrap gap-2">
									{ourosWinners.map((o) => {
										const pl = playerMap.get(o.player_id);
										return (
											<span
												key={`ouro-tag-${o.player_id}`}
												className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-amber-500/15 border border-amber-500/30 text-xs text-amber-700 dark:text-amber-200 font-medium"
											>
												<span>{pl?.apelido || pl?.nome || `Jogador #${o.player_id}`}</span>
												<span className="bg-amber-400 text-black text-[10px] font-bold px-1.5 py-0.2 rounded-full">
													{o.count}x
												</span>
											</span>
										);
									})}
								</div>
							</div>
						)}
					</div>

					{/* 2. Classificação dos Times na Rodada */}
					<div className="bg-surface border border-border rounded-2xl p-6 flex flex-col gap-5">
						<div className="flex items-center justify-between gap-3 flex-wrap">
							<div className="flex items-center gap-2.5">
								<div className="w-8 h-8 rounded-lg bg-blue-500/15 border border-blue-500/30 flex items-center justify-center text-primary">
									<Medal size={18} />
								</div>
								<div>
									<h3 className="text-base font-semibold text-main">
										Classificação dos Times
									</h3>
									<p className="text-xs text-muted">
										Desempenho final dos times na rodada (vitórias, empates, gols e saldo)
									</p>
								</div>
							</div>
						</div>

						{teamStandings.length === 0 ? (
							<div className="border border-dashed border-border rounded-xl py-6 px-4 text-center text-muted text-xs">
								Nenhum time ou partida computada nesta rodada.
							</div>
						) : (
							<div className="overflow-x-auto">
								<table className="w-full text-left border-collapse text-xs">
									<thead>
										<tr className="border-b border-border text-muted uppercase tracking-wider text-[11px]">
											<th className="py-2.5 px-3">#</th>
											<th className="py-2.5 px-3">Time</th>
											<th className="py-2.5 px-3 text-center font-bold text-main">PTS</th>
											<th className="py-2.5 px-3 text-center">J</th>
											<th className="py-2.5 px-3 text-center">V</th>
											<th className="py-2.5 px-3 text-center">E</th>
											<th className="py-2.5 px-3 text-center">D</th>
											<th className="py-2.5 px-3 text-center">GP</th>
											<th className="py-2.5 px-3 text-center">GC</th>
											<th className="py-2.5 px-3 text-center">SG</th>
										</tr>
									</thead>
									<tbody className="divide-y divide-border/50">
										{teamStandings.map((st, idx) => {
											const isChampion = idx === 0 && st.points > 0;
											return (
												<tr
													key={`standing-team-${st.team.id_team}`}
													className={`transition-colors hover:bg-nav-hover/40 ${
														isChampion ? 'bg-amber-500/[0.06] font-semibold' : ''
													}`}
												>
													<td className="py-3 px-3">
														<span
															className={`inline-flex items-center justify-center w-6 h-6 rounded-full text-xs font-bold ${
																idx === 0
																	? 'bg-amber-400 text-black'
																	: idx === 1
																	? 'bg-slate-200 text-slate-800 dark:bg-zinc-300 dark:text-black'
																	: idx === 2
																	? 'bg-amber-700/60 text-amber-100'
																	: 'text-muted'
															}`}
														>
															{idx + 1}
														</span>
													</td>
													<td className="py-3 px-3">
														<div className="flex items-center gap-2">
															<span className="text-main font-medium">
																{st.team.name}
															</span>
															<TeamColorTag color={st.team.color} showLabel={false} />
															{isChampion && (
																<span className="inline-flex items-center gap-1 text-[10px] bg-amber-400/20 text-amber-600 dark:text-amber-300 border border-amber-400/30 px-2 py-0.5 rounded-full font-bold">
																	🍕 Campeão
																</span>
															)}
														</div>
													</td>
													<td className="py-3 px-3 text-center font-bold text-sm text-primary">
														{st.points}
													</td>
													<td className="py-3 px-3 text-center text-muted">{st.matchesPlayed}</td>
													<td className="py-3 px-3 text-center text-emerald-500 font-medium">{st.wins}</td>
													<td className="py-3 px-3 text-center text-amber-500 font-medium">{st.draws}</td>
													<td className="py-3 px-3 text-center text-red-500 font-medium">{st.losses}</td>
													<td className="py-3 px-3 text-center text-main">{st.goalsFor}</td>
													<td className="py-3 px-3 text-center text-muted">{st.goalsAgainst}</td>
													<td className="py-3 px-3 text-center font-semibold text-main">
														{st.goalDifference > 0 ? `+${st.goalDifference}` : st.goalDifference}
													</td>
												</tr>
											);
										})}
									</tbody>
								</table>
							</div>
						)}
					</div>

					{/* 3. Pontuações dos Jogadores na Rodada */}
					<div className="bg-surface border border-border rounded-2xl p-6 flex flex-col gap-5">
						<div className="flex items-center justify-between gap-3 flex-wrap">
							<div className="flex items-center gap-2.5">
								<div className="w-8 h-8 rounded-lg bg-purple-500/15 border border-purple-500/30 flex items-center justify-center text-purple-400">
									<Users size={18} />
								</div>
								<div>
									<h3 className="text-base font-semibold text-main">
										Pontuação dos Jogadores
									</h3>
									<p className="text-xs text-muted">
										Pontuação individual consolidada de cada atleta nesta rodada
									</p>
								</div>
							</div>
						</div>

						{playerLeaderboard.length === 0 ? (
							<div className="border border-dashed border-border rounded-xl py-6 px-4 text-center text-muted flex flex-col items-center gap-3">
								<p className="text-xs">As pontuações ainda não foram processadas para esta rodada.</p>
								{isAdmin && (
									<button
										type="button"
										disabled={calculateScoresMutation.isPending}
										onClick={() => calculateScoresMutation.mutate()}
										className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-primary hover:bg-primary-hover text-white text-xs font-semibold transition-colors cursor-pointer disabled:opacity-50"
									>
										<Zap size={14} />
										{calculateScoresMutation.isPending ? 'Calculando...' : 'Calcular Agora'}
									</button>
								)}
							</div>
						) : (
							<div className="overflow-x-auto">
								<table className="w-full text-left border-collapse text-xs">
									<thead>
										<tr className="border-b border-border text-muted uppercase tracking-wider text-[11px]">
											<th className="py-2.5 px-3">#</th>
											<th className="py-2.5 px-3">Jogador</th>
											<th className="py-2.5 px-3">Time</th>
											<th className="py-2.5 px-3 text-center">Pts Time</th>
											<th className="py-2.5 px-3 text-center">Pts Indiv.</th>
											<th className="py-2.5 px-3 text-center">Pts Colab.</th>
											<th className="py-2.5 px-3 text-center font-bold text-main">Total</th>
										</tr>
									</thead>
									<tbody className="divide-y divide-border/50">
										{playerLeaderboard.map((row, idx) => {
											return (
												<tr
													key={`leaderboard-${row.player_id}`}
													className={`transition-colors hover:bg-nav-hover/40 ${
														idx === 0
															? 'bg-amber-500/[0.05]'
															: idx === 1
															? 'bg-muted/10'
															: idx === 2
															? 'bg-amber-700/[0.04]'
															: ''
													}`}
												>
													<td className="py-2.5 px-3">
														<span
															className={`inline-flex items-center justify-center w-6 h-6 rounded-full text-xs font-bold ${
																idx === 0
																	? 'bg-amber-400 text-black shadow-sm'
																	: idx === 1
																	? 'bg-slate-200 text-slate-800 dark:bg-zinc-300 dark:text-black'
																	: idx === 2
																	? 'bg-amber-700/70 text-amber-100'
																	: 'text-muted'
															}`}
														>
															{idx + 1}
														</span>
													</td>
													<td className="py-2.5 px-3">
														<div className="flex flex-col">
															<span className="font-semibold text-main">
																{row.nickname || row.name}
															</span>
															{row.nickname && row.nickname !== row.name && (
																<span className="text-[11px] text-muted">
																	{row.name}
																</span>
															)}
														</div>
													</td>
													<td className="py-2.5 px-3">
														{row.teamName ? (
															<div className="inline-flex items-center gap-1.5">
																<span className="text-main">{row.teamName}</span>
																<TeamColorTag color={row.teamColor} showLabel={false} />
															</div>
														) : (
															<span className="text-muted italic">Avulso / Extra</span>
														)}
													</td>
													<td className="py-2.5 px-3 text-center text-main">
														{row.pointsTeam}
													</td>
													<td className="py-2.5 px-3 text-center text-primary font-medium">
														{row.pointsIndividual > 0 ? `+${row.pointsIndividual}` : row.pointsIndividual}
													</td>
													<td className="py-2.5 px-3 text-center text-emerald-500 font-medium">
														{row.pointsCollaboration > 0 ? `+${row.pointsCollaboration}` : row.pointsCollaboration}
													</td>
													<td className="py-2.5 px-3 text-center font-bold text-sm text-primary">
														{row.totalPoints}
													</td>
												</tr>
											);
										})}
									</tbody>
								</table>
							</div>
						)}
					</div>
				</div>
			)}

			{/* Conteúdo da Aba 3: Votação dos Destaques */}
			{activeTab === 'votacao' && (
				<RoundVotingTab
					roundId={parseInt(params.id, 10)}
					players={allPlayers}
					confirmedPlayerIds={(attendance?.items || [])
						.filter((i) => i.status === 'confirmed')
						.map((i) => i.player_id)}
					awards={awards}
					roundTeams={teams}
					rouletteWinners={rouletteWinners}
				/>
			)}


			{/* Modal Adicionar Time */}
			<Modal
				isOpen={isTeamModalOpen}
				onClose={() => setIsTeamModalOpen(false)}
				title="Novo Time na Rodada"
			>
				<form
					onSubmit={handleCreateTeam}
					className="flex flex-col gap-3"
				>
					<FormField label="Nome do Time">
						<Input
							value={teamName}
							onChange={(e) => setTeamName(e.target.value)}
							placeholder="Ex: Time 1 (DIEGO)"
							required
						/>
					</FormField>

					<FormField label="Cor do Colete / Camisa">
						<div className="flex flex-wrap gap-2 pt-1">
							{TEAM_COLORS.map((c) => {
								const isSelected = teamColor === c.id;
								return (
									<button
										key={`color-pick-${c.id}`}
										type="button"
										onClick={() => setTeamColor(c.id)}
										className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-semibold transition-all cursor-pointer ${isSelected
											? `${c.badgeBg} ${c.badgeBorder} ${c.badgeText} ring-2 ring-blue-500/50 shadow-sm`
											: 'border-border bg-surface text-muted hover:bg-nav-hover'
											}`}
									>
										<span
											className="w-2.5 h-2.5 rounded-full shrink-0"
											style={{ backgroundColor: c.hex }}
										/>
										<span>{c.label}</span>
									</button>
								);
							})}
						</div>
					</FormField>

					<FormField
						label={`Jogadores (${selectedPlayerIds.size} selecionados)`}
					>
						<Input
							value={playerSearch}
							onChange={(e) => setPlayerSearch(e.target.value)}
							placeholder="Filtrar jogador..."
							className="mb-2"
						/>
						{playerTeamInRoundMap.size > 0 && (
							<p className="text-[11px] text-muted mb-2">
								Jogadores já escalados em outro time desta
								rodada exibem a tag do time e ficam bloqueados.
								Para incluí-los aqui, remova-os primeiro do time
								atual.
							</p>
						)}
						<div className="max-h-56 overflow-y-auto border border-border rounded-md divide-y divide-border/50">
							{filteredPlayers.map((p) => {
								const assignedTeam = playerTeamInRoundMap.get(
									p.id_player,
								);
								const isAssigned = Boolean(assignedTeam);
								const isChecked =
									!isAssigned &&
									selectedPlayerIds.has(p.id_player);
								return (
									<label
										key={p.id_player}
										className={`flex items-center justify-between gap-2 px-3 py-2 text-sm ${isAssigned
											? 'opacity-60 cursor-not-allowed bg-nav-hover/20 text-muted'
											: 'text-main hover:bg-nav-hover cursor-pointer'
											}`}
									>
										<div className="flex items-center gap-2 min-w-0">
											<input
												type="checkbox"
												disabled={isAssigned}
												checked={isChecked}
												onChange={() =>
													togglePlayer(p.id_player)
												}
												className={
													isAssigned
														? 'cursor-not-allowed opacity-50'
														: 'cursor-pointer'
												}
											/>
											<span className="truncate">
												{p.apelido || p.nome}
											</span>
										</div>
										{assignedTeam ? (
											<span
												className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-amber-500/15 text-amber-600 dark:text-[#facc15] border border-amber-500/30 shrink-0"
												title={`Escalado em ${assignedTeam.name}. Remova-o de lá para selecionar aqui.`}
											>
												{assignedTeam.name}
											</span>
										) : p.potes ? (
											<span className="text-xs text-muted shrink-0">
												Pote {p.potes}
											</span>
										) : null}
									</label>
								);
							})}
						</div>
					</FormField>

					<div className="flex gap-3 mt-2">
						<Button
							type="submit"
							disabled={createTeamMutation.isPending}
						>
							{createTeamMutation.isPending
								? 'Criando...'
								: 'Criar Time'}
						</Button>
						<Button
							type="button"
							variant="ghost"
							onClick={() => setIsTeamModalOpen(false)}
						>
							Cancelar
						</Button>
					</div>
				</form>
			</Modal>

			{/* Modal Nova Partida */}
			<Modal
				isOpen={isMatchModalOpen}
				onClose={() => setIsMatchModalOpen(false)}
				title="Nova Partida"
			>
				<form
					onSubmit={handleCreateMatch}
					className="flex flex-col gap-3"
				>
					<FormField label="Time da Casa">
						<Select
							value={homeTeamId}
							onChange={(e) => setHomeTeamId(e.target.value)}
							required
						>
							<option value="">Selecione...</option>
							{teams.map((t) => (
								<option key={t.id_team} value={t.id_team}>
									{t.name}
								</option>
							))}
						</Select>
					</FormField>
					<FormField label="Time Visitante">
						<Select
							value={awayTeamId}
							onChange={(e) => setAwayTeamId(e.target.value)}
							required
						>
							<option value="">Selecione...</option>
							{teams.map((t) => (
								<option key={t.id_team} value={t.id_team}>
									{t.name}
								</option>
							))}
						</Select>
					</FormField>
					<div className="flex gap-3 mt-2">
						<Button
							type="submit"
							disabled={createMatchMutation.isPending}
						>
							{createMatchMutation.isPending
								? 'Criando...'
								: 'Criar Partida'}
						</Button>
						<Button
							type="button"
							variant="ghost"
							onClick={() => setIsMatchModalOpen(false)}
						>
							Cancelar
						</Button>
					</div>
				</form>
			</Modal>

			{/* Modal: Sortear / Montar Times */}
			<Modal
				isOpen={isDrawModalOpen}
				onClose={() => setIsDrawModalOpen(false)}
				title="Sortear ou Montar Times da Rodada"
			>
				<div className="flex flex-col gap-4 max-h-[75vh] overflow-y-auto pr-1">
					{/* Modo */}
					<div className="flex gap-2">
						<button
							type="button"
							onClick={() => setDrawMode('draw')}
							className={`flex-1 py-2 px-3 rounded-lg text-xs font-medium border transition-colors ${drawMode === 'draw'
								? 'bg-primary/15 border-primary text-primary'
								: 'border-border text-muted hover:text-main'
								}`}
						>
							🎲 Sorteio por Potes (Sugestão)
						</button>
						<button
							type="button"
							onClick={() => {
								setDrawMode('manual');
								if (draftTeams.length === 0) {
									initManualTeams(numTeams);
								}
							}}
							className={`flex-1 py-2 px-3 rounded-lg text-xs font-medium border transition-colors ${drawMode === 'manual'
								? 'bg-primary/15 border-primary text-primary'
								: 'border-border text-muted hover:text-main'
								}`}
						>
							✍️ Informar Times Já Prontos
						</button>
					</div>

					{/* Configuração de quantidade de times */}
					<div className="flex items-end gap-3 flex-wrap">
						<div className="w-32">
							<FormField label="Qtd. de Times">
								<Select
									value={String(numTeams)}
									onChange={(e) => {
										const next = parseInt(e.target.value, 10);
										setNumTeams(next);
										if (drawMode === 'manual') {
											setDraftTeams((prev) => {
												if (prev.length === next) return prev;
												if (prev.length < next) {
													return [
														...prev,
														...Array.from(
															{ length: next - prev.length },
															(_, idx) => ({
																name: `Time ${prev.length + idx + 1}`,
																playerIds: [],
															}),
														),
													];
												}
												return prev.slice(0, next);
											});
										}
									}}
								>
									{[2, 3, 4, 5, 6].map((n) => (
										<option key={n} value={n}>
											{n} times
										</option>
									))}
								</Select>
							</FormField>
						</div>

						{drawMode === 'draw' && (
							<Button
								type="button"
								onClick={handleRunDraw}
								disabled={drawPreviewMutation.isPending}
								className="w-auto"
							>
								{drawPreviewMutation.isPending
									? 'Sorteando...'
									: draftTeams.length > 0
										? '🔄 Re-sortear'
										: '🎲 Sortear Times'}
							</Button>
						)}
					</div>

					{/* Seleção de jogadores + ajuste opcional de pote (modo Sorteio) */}
					{drawMode === 'draw' && (
						<div className="flex flex-col gap-2 border border-border rounded-xl p-3 bg-white/[0.02]">
							<div className="flex items-center justify-between gap-2 flex-wrap">
								<span className="text-xs font-medium text-main">
									Jogadores presentes ({drawSelectedIds.size}) — pote é apenas sugestão
								</span>
								<div className="flex gap-2">
									<button
										type="button"
										onClick={() =>
											setDrawSelectedIds(
												new Set(allPlayers.map((p) => p.id_player)),
											)
										}
										className="text-xs text-primary hover:underline"
									>
										Selecionar todos
									</button>
									<button
										type="button"
										onClick={() => setDrawSelectedIds(new Set())}
										className="text-xs text-muted hover:underline"
									>
										Limpar
									</button>
								</div>
							</div>
							<Input
								placeholder="Buscar jogador..."
								value={drawSearch}
								onChange={(e) => setDrawSearch(e.target.value)}
							/>
							<div className="max-h-44 overflow-y-auto divide-y divide-border border border-border rounded-lg">
								{filteredDrawPlayers.map((p) => {
									const checked = drawSelectedIds.has(p.id_player);
									const effectivePot =
										p.id_player in poteOverrides
											? poteOverrides[p.id_player]
											: p.potes ?? null;
									return (
										<div
											key={p.id_player}
											className="flex items-center justify-between gap-2 px-3 py-1.5 text-xs"
										>
											<label className="flex items-center gap-2 cursor-pointer flex-1 min-w-0">
												<input
													type="checkbox"
													checked={checked}
													onChange={() =>
														setDrawSelectedIds((prev) => {
															const next = new Set(prev);
															next.has(p.id_player)
																? next.delete(p.id_player)
																: next.add(p.id_player);
															return next;
														})
													}
												/>
												<span className="text-main truncate">
													{p.apelido || p.nome}
												</span>
											</label>
											{checked && (
												<select
													value={effectivePot ?? ''}
													onChange={(e) => {
														const val = e.target.value
															? parseInt(e.target.value, 10)
															: null;
														setPoteOverrides((prev) => ({
															...prev,
															[p.id_player]: val,
														}));
													}}
													className="bg-surface border border-border rounded px-1.5 py-0.5 text-xs text-main"
												>
													<option value="">Sem pote</option>
													{[1, 2, 3, 4, 5].map((pot) => (
														<option key={pot} value={pot}>
															Pote {pot}
														</option>
													))}
												</select>
											)}
										</div>
									);
								})}
							</div>
						</div>
					)}

					{/* Editor de Times (comum aos dois modos) */}
					{draftTeams.length > 0 && (
						<div className="flex flex-col gap-3">
							<span className="text-xs font-medium text-muted">
								Ajuste livremente os nomes e jogadores antes de confirmar:
							</span>
							<div className="grid grid-cols-1 md:grid-cols-2 gap-3">
								{draftTeams.map((team, tIdx) => (
									<div
										key={tIdx}
										className="border border-border rounded-xl p-3 bg-surface flex flex-col gap-2"
									>
										<Input
											value={team.name}
											onChange={(e) =>
												setDraftTeams((prev) =>
													prev.map((item, i) =>
														i === tIdx
															? { ...item, name: e.target.value }
															: item,
													),
												)
											}
											placeholder={`Time ${tIdx + 1}`}
										/>
										<div className="flex flex-col gap-1.5 min-h-[48px]">
											{team.playerIds.length === 0 ? (
												<span className="text-xs text-muted italic">
													Nenhum jogador neste time
												</span>
											) : (
												team.playerIds.map((pid) => {
													const p = playerMap.get(pid);
													if (!p) return null;
													const pot =
														pid in poteOverrides
															? poteOverrides[pid]
															: p.potes;
													return (
														<div
															key={pid}
															className="flex items-center justify-between gap-1 text-xs bg-white/5 rounded px-2 py-1"
														>
															<span className="truncate text-main">
																{p.apelido || p.nome}
																{pot ? (
																	<span className="text-muted ml-1">
																		(P{pot})
																	</span>
																) : null}
															</span>
															<div className="flex items-center gap-1 shrink-0">
																<select
																	aria-label="Mover para outro time"
																	value={String(tIdx)}
																	onChange={(e) =>
																		movePlayerToTeam(
																			pid,
																			parseInt(e.target.value, 10),
																		)
																	}
																	className="bg-surface border border-border rounded px-1 py-0.5 text-[11px] text-muted"
																>
																	{draftTeams.map((dest, dIdx) => (
																		<option key={dIdx} value={dIdx}>
																			{dest.name || `Time ${dIdx + 1}`}
																		</option>
																	))}
																</select>
																<button
																	type="button"
																	onClick={() => removePlayerFromDraft(pid)}
																	className="text-muted hover:text-red-400 px-1"
																	title="Remover do time"
																>
																	×
																</button>
															</div>
														</div>
													);
												})
											)}
										</div>
									</div>
								))}
							</div>
						</div>
					)}

					{/* Jogadores disponíveis para adicionar manualmente */}
					{draftTeams.length > 0 && unassignedPlayers.length > 0 && (
						<div className="border border-border rounded-xl p-3 flex flex-col gap-2">
							<span className="text-xs font-medium text-main">
								Disponíveis para alocar ({unassignedPlayers.length})
							</span>
							<div className="max-h-36 overflow-y-auto flex flex-wrap gap-1.5">
								{unassignedPlayers.map((p) => (
									<div
										key={p.id_player}
										className="flex items-center gap-1 text-xs border border-border rounded-lg px-2 py-1 bg-surface"
									>
										<span className="text-main">
											{p.apelido || p.nome}
										</span>
										<select
											value=""
											onChange={(e) => {
												if (e.target.value !== '') {
													movePlayerToTeam(
														p.id_player,
														parseInt(e.target.value, 10),
													);
												}
											}}
											className="bg-transparent border border-border rounded px-1 py-0.5 text-[11px] text-primary"
										>
											<option value="">+ Time</option>
											{draftTeams.map((t, idx) => (
												<option key={idx} value={idx}>
													{t.name || `Time ${idx + 1}`}
												</option>
											))}
										</select>
									</div>
								))}
							</div>
						</div>
					)}

					{teams.length > 0 && (
						<label className="flex items-center gap-2 text-xs text-muted cursor-pointer">
							<input
								type="checkbox"
								checked={overwriteExisting}
								onChange={(e) => setOverwriteExisting(e.target.checked)}
							/>
							Substituir os {teams.length} time(s) já cadastrados nesta rodada
						</label>
					)}

					<div className="flex gap-3 pt-1">
						<Button
							type="button"
							disabled={
								draftTeams.length === 0 || saveBatchTeamsMutation.isPending
							}
							onClick={() =>
								saveBatchTeamsMutation.mutate({
									overwrite_existing: overwriteExisting,
									teams: draftTeams.map((t, idx) => ({
										name: t.name.trim() || `Time ${idx + 1}`,
										player_ids: t.playerIds,
									})),
								})
							}
						>
							{saveBatchTeamsMutation.isPending
								? 'Salvando...'
								: 'Confirmar Times na Rodada'}
						</Button>
						<Button
							type="button"
							variant="ghost"
							onClick={() => setIsDrawModalOpen(false)}
						>
							Cancelar
						</Button>
					</div>
				</div>
			</Modal>

			{/* Modal: Editar Rodada */}
			<Modal
				isOpen={isEditRoundOpen}
				onClose={() => setIsEditRoundOpen(false)}
				title={`Editar Rodada ${round.round_number}`}
			>
				<form
					onSubmit={(e) => {
						e.preventDefault();
						updateRoundMutation.mutate({
							round_number: parseInt(editRoundNumber, 10) || round.round_number,
							date: editRoundDate
								? new Date(`${editRoundDate}T12:00:00`).toISOString()
								: undefined,
							location: editRoundLocation.trim(),
							referee: editRoundReferee.trim(),
						});
					}}
					className="flex flex-col gap-3"
				>
					<FormField label="Número da Rodada">
						<Input
							type="number"
							min={1}
							value={editRoundNumber}
							onChange={(e) => setEditRoundNumber(e.target.value)}
							required
						/>
					</FormField>
					<FormField label="Data">
						<DatePicker
							value={editRoundDate}
							onChange={(e) => setEditRoundDate(e.target.value)}
							required
						/>
					</FormField>
					<FormField label="Local">
						<Input
							value={editRoundLocation}
							onChange={(e) => setEditRoundLocation(e.target.value)}
							required
						/>
					</FormField>
					<FormField label="Juiz">
						<Input
							value={editRoundReferee}
							onChange={(e) => setEditRoundReferee(e.target.value)}
							required
						/>
					</FormField>
					<div className="flex gap-3 mt-2">
						<Button
							type="submit"
							disabled={updateRoundMutation.isPending}
						>
							{updateRoundMutation.isPending
								? 'Salvando...'
								: 'Salvar Alterações'}
						</Button>
						<Button
							type="button"
							variant="ghost"
							onClick={() => setIsEditRoundOpen(false)}
						>
							Cancelar
						</Button>
					</div>
				</form>
			</Modal>

			{/* Modal: Gerenciar Lista de Presença (Admin) */}
			<Modal
				isOpen={isAttendanceModalOpen}
				onClose={() => setIsAttendanceModalOpen(false)}
				title="Gerenciar Lista de Presença"
			>
				<div className="flex flex-col gap-3">
					<Input
						placeholder="Buscar jogador..."
						value={attendanceSearch}
						onChange={(e) => setAttendanceSearch(e.target.value)}
					/>
					<div className="max-h-72 overflow-y-auto border border-border rounded-lg divide-y divide-border">
						{allPlayers
							.filter((p) => {
								const q = attendanceSearch.toLowerCase().trim();
								if (!q) return true;
								return (
									p.nome.toLowerCase().includes(q) ||
									(p.apelido ?? '').toLowerCase().includes(q)
								);
							})
							.map((p) => {
								const current =
									attendanceDraft[p.id_player] ?? '';
								return (
									<div
										key={p.id_player}
										className="flex items-center justify-between gap-2 px-3 py-2 text-xs"
									>
										<span className="text-main truncate">
											{p.apelido || p.nome}
										</span>
										<select
											value={current}
											onChange={(e) =>
												setAttendanceDraft((prev) => ({
													...prev,
													[p.id_player]: e.target
														.value as
														| 'confirmed'
														| 'waiting'
														| 'declined'
														| '',
												}))
											}
											className="bg-surface border border-border rounded px-2 py-1 text-xs text-main"
										>
											<option value="">Sem resposta</option>
											<option value="confirmed">
												Confirmado
											</option>
											<option value="waiting">
												Lista de espera
											</option>
											<option value="declined">
												Não vai
											</option>
										</select>
									</div>
								);
							})}
					</div>
					<div className="flex gap-3 mt-1">
						<Button
							type="button"
							disabled={adminAttendanceMutation.isPending}
							onClick={() => {
								const items = Object.entries(attendanceDraft)
									.filter(([, st]) => st !== '')
									.map(([pid, st]) => ({
										player_id: parseInt(pid, 10),
										status: st as
											| 'confirmed'
											| 'waiting'
											| 'declined',
									}));
								if (items.length === 0) {
									alert(
										'Marque ao menos um jogador antes de salvar.',
									);
									return;
								}
								adminAttendanceMutation.mutate(items);
							}}
						>
							{adminAttendanceMutation.isPending
								? 'Salvando...'
								: 'Salvar Lista'}
						</Button>
						<Button
							type="button"
							variant="ghost"
							onClick={() => setIsAttendanceModalOpen(false)}
						>
							Cancelar
						</Button>
					</div>
				</div>
			</Modal>
		</div>
	);
}
