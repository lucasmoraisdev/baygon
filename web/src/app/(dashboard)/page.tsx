'use client';

import { Button } from '@/components/Button';
import { Select } from '@/components/Select';
import { Loading } from '@/components/Loading';
import { StatsCard } from '@/components/StatsCard';
import { useAuth } from '@/context/AuthContext';
import { fetchAPI } from '@/lib/api';
import { Match, Round, Season } from '@/types/types';
import { useMutation, useQueries, useQuery, useQueryClient } from '@tanstack/react-query';
import {
	AlertCircle,
	ArrowDown,
	Bell,
	Calendar,
	Check,
	CheckCircle2,
	Clock,
	Download,
	ExternalLink,
	Flame,
	Search,
	Swords,
	Trophy,
	Users,
	XCircle,
} from 'lucide-react';
import Link from 'next/link';
import { useMemo, useState } from 'react';

interface AssociationRankingRow {
	player_id: number;
	boleiro: string;
	ranking_geral: number;
	artilharia: number;
	assistencias: number;
	babas_conquistados: number;
	babas_perdidos: number;
	empates: number;
	pontos_colaboracao: number;
	premio_defesa: number;
	premio_drible: number;
	premio_gol: number;
	premio_inacreditavel: number;
	presenca_baba: number;
	total_gols_contra: number;
	bola_cheia: number;
	bola_murcha: number;
	clean_sheets: number;
	pizza: number;
	ouros: number;
	pontos_copas: number;
	selecao_mes: number;
	roleta: number;
	ultimo_baba: string;
	ultima_vitoria: string;
	posicao: string;
}

interface AssociationRankingResponse {
	season_id: number | null;
	season_number: number | null;
	rows: AssociationRankingRow[];
}

interface PlayerItem {
	id_player: number;
	nome: string;
	apelido?: string | null;
	is_guest?: boolean;
	is_associate?: boolean;
	user_id?: number | null;
}

type SortKey = keyof AssociationRankingRow;

const NUMERIC_COLUMNS: Array<{ key: SortKey; label: string }> = [
	{ key: 'ranking_geral', label: 'Ranking Geral' },
	{ key: 'artilharia', label: 'Artilharia' },
	{ key: 'assistencias', label: 'Assistências' },
	{ key: 'babas_conquistados', label: 'Babas Conquistados' },
	{ key: 'babas_perdidos', label: 'Babas Perdidos' },
	{ key: 'empates', label: 'Empates' },
	{ key: 'pontos_colaboracao', label: 'Pontos de Colaboração' },
	{ key: 'premio_defesa', label: 'Prêmio Defesa' },
	{ key: 'premio_drible', label: 'Prêmio Drible' },
	{ key: 'premio_gol', label: 'Prêmio Gol' },
	{ key: 'premio_inacreditavel', label: 'Prêmio Inacreditável' },
	{ key: 'presenca_baba', label: 'Presença no Baba' },
	{ key: 'total_gols_contra', label: 'Total de Gols Contra' },
	{ key: 'bola_cheia', label: 'Bola Cheia' },
	{ key: 'bola_murcha', label: 'Bola Murcha' },
	{ key: 'clean_sheets', label: 'Clean Sheets' },
	{ key: 'pizza', label: 'Pizza' },
	{ key: 'ouros', label: 'Ouros' },
	{ key: 'pontos_copas', label: 'Pontos Copas' },
	{ key: 'selecao_mes', label: 'Seleção do Mês' },
	{ key: 'roleta', label: 'Roleta' },
];

export default function DashboardPage() {
	const { user } = useAuth();
	const queryClient = useQueryClient();
	const isNonAdmin = Boolean(user && !user.is_admin);
	const [attendanceFeedback, setAttendanceFeedback] = useState<string | null>(null);
	const [selectedSeasonId, setSelectedSeasonId] = useState<string>('');
	const [search, setSearch] = useState('');
	const [sortKey, setSortKey] = useState<SortKey>('ranking_geral');
	const [sortDir, setSortDir] = useState<'desc' | 'asc'>('desc');

	const [seasonsQuery, playersQuery, allMatchesQuery] = useQueries({
		queries: [
			{
				queryKey: ['seasons'],
				queryFn: () => fetchAPI('/seasons/').catch(() => []),
			},
			{ queryKey: ['players'], queryFn: () => fetchAPI('/players/') },
			{ queryKey: ['matches'], queryFn: () => fetchAPI('/matches/') },
		],
	});

	const rankingQuery = useQuery<AssociationRankingResponse>({
		queryKey: ['association-ranking', selectedSeasonId || 'current'],
		queryFn: () =>
			fetchAPI(
				selectedSeasonId
					? `/rankings/season/${selectedSeasonId}/association`
					: '/rankings/association',
			),
	});

	const seasons: Season[] = seasonsQuery.data ?? [];
	const players: PlayerItem[] = playersQuery.data ?? [];
	const allMatches: Match[] = allMatchesQuery.data ?? [];
	const rankingData = rankingQuery.data;

	const effectiveSeasonId =
		selectedSeasonId ||
		(rankingData?.season_id ? String(rankingData.season_id) : '');

	const [seasonRoundsQuery, seasonMatchesQuery] = useQueries({
		queries: [
			{
				queryKey: ['rounds', 'season', effectiveSeasonId],
				queryFn: () =>
					fetchAPI(`/rounds/season/${effectiveSeasonId}`).catch(
						() => [],
					),
				enabled: Boolean(effectiveSeasonId),
			},
			{
				queryKey: ['matches', 'season', effectiveSeasonId],
				queryFn: () =>
					fetchAPI(`/matches/season/${effectiveSeasonId}`).catch(
						() => [],
					),
				enabled: Boolean(effectiveSeasonId),
			},
		],
	});

	const seasonRounds: Round[] = seasonRoundsQuery.data ?? [];
	const seasonMatches: Match[] = effectiveSeasonId
		? (seasonMatchesQuery.data ?? [])
		: allMatches;

	const activeSeason = useMemo(
		() => seasons.find((s) => s.is_active) ?? seasons[0],
		[seasons],
	);

	const activeSeasonRoundsQuery = useQuery<Round[]>({
		queryKey: ['rounds', 'season', activeSeason?.id_season],
		queryFn: () =>
			fetchAPI(`/rounds/season/${activeSeason?.id_season}`).catch(
				() => [],
			),
		enabled: Boolean(activeSeason?.id_season),
	});

	const openRound = useMemo(() => {
		const roundsList = activeSeasonRoundsQuery.data ?? seasonRounds;
		return roundsList.find((r) => !r.end_time) ?? null;
	}, [activeSeasonRoundsQuery.data, seasonRounds]);

	const currentPlayer = useMemo(() => {
		if (!user) return null;
		return (
			players.find((p) => p.user_id === user.id_user) ||
			players.find(
				(p) =>
					p.nome?.toLowerCase() === user.username?.toLowerCase() ||
					(p.apelido &&
						p.apelido.toLowerCase() ===
							user.username?.toLowerCase()),
			) ||
			null
		);
	}, [user, players]);

	const openRoundAttendanceQuery = useQuery({
		queryKey: ['attendance', 'round', openRound?.id_round],
		queryFn: () =>
			fetchAPI(`/attendance/round/${openRound?.id_round}`).catch(() => ({
				round_id: openRound?.id_round,
				confirmed_count: 0,
				declined_count: 0,
				waiting_count: 0,
				items: [],
			})),
		enabled: Boolean(openRound?.id_round),
	});

	const userAttendance = useMemo(() => {
		if (!openRoundAttendanceQuery.data?.items || !currentPlayer) return null;
		return (
			openRoundAttendanceQuery.data.items.find(
				(item: any) => item.player_id === currentPlayer.id_player,
			) ?? null
		);
	}, [openRoundAttendanceQuery.data, currentPlayer]);

	const confirmAttendanceMutation = useMutation({
		mutationFn: async (status: 'confirmed' | 'waiting' | 'declined') => {
			if (!openRound) return;
			return fetchAPI(`/attendance/round/${openRound.id_round}/me`, {
				method: 'POST',
				body: JSON.stringify({
					status,
					player_id: currentPlayer?.id_player,
				}),
			});
		},
		onSuccess: (_, status) => {
			queryClient.invalidateQueries({
				queryKey: ['attendance', 'round', openRound?.id_round],
			});
			if (status === 'confirmed') {
				setAttendanceFeedback('Presença confirmada no baba! ⚽');
			} else if (status === 'waiting') {
				setAttendanceFeedback('Colocado na lista de espera. ⏳');
			} else if (status === 'declined') {
				setAttendanceFeedback('Ausência registrada para esta rodada. ✕');
			}
			setTimeout(() => setAttendanceFeedback(null), 4000);
		},
		onError: (err: any) => {
			alert(`Erro ao registrar presença: ${err?.message || 'Falha na comunicação'}`);
		},
	});

	const myRankingStats = useMemo(() => {
		if (!currentPlayer || !rankingData?.rows) return null;
		const sorted = [...rankingData.rows].sort(
			(a, b) => b.ranking_geral - a.ranking_geral,
		);
		const index = sorted.findIndex(
			(r) => r.player_id === currentPlayer.id_player,
		);
		if (index === -1) return null;
		return {
			position: index + 1,
			totalPlayers: sorted.length,
			row: sorted[index],
		};
	}, [currentPlayer, rankingData?.rows]);

	const scrollToMyRow = () => {
		if (search) setSearch('');
		setTimeout(() => {
			const el = document.getElementById('my-ranking-row');
			if (el) {
				el.scrollIntoView({ behavior: 'smooth', block: 'center' });
			}
		}, 100);
	};

	// Métricas rápidas da Temporada Selecionada (Visão Admin)
	const dashboardMetrics = useMemo(() => {
		const rows = rankingData?.rows ?? [];
		const activeInSeason = rows.filter((r) => r.presenca_baba > 0).length;
		const associatesCount = players.filter((p) => !p.is_guest).length;
		const guestsCount = players.filter((p) => p.is_guest).length;

		const matchesCount = seasonMatches.length;
		const roundsCount = seasonRounds.length;

		const goalsFromMatches = seasonMatches.reduce(
			(acc, m) => acc + (m.home_score ?? 0) + (m.away_score ?? 0),
			0,
		);
		const goalsFromRanking = rows.reduce((acc, r) => acc + r.artilharia, 0);
		const totalGoals =
			goalsFromMatches > 0 ? goalsFromMatches : goalsFromRanking;
		const totalAssists = rows.reduce((acc, r) => acc + r.assistencias, 0);
		const totalCleanSheets = rows.reduce(
			(acc, r) => acc + r.clean_sheets,
			0,
		);

		const avgGoalsPerMatch =
			matchesCount > 0 ? (totalGoals / matchesCount).toFixed(1) : '0.0';

		let lastRoundDate = '—';
		if (seasonRounds.length > 0) {
			const sortedRounds = [...seasonRounds].sort(
				(a, b) =>
					new Date(b.date).getTime() - new Date(a.date).getTime(),
			);
			lastRoundDate = new Date(sortedRounds[0].date).toLocaleDateString(
				'pt-BR',
			);
		}

		const topLeader =
			rows.length > 0
				? [...rows].sort((a, b) => b.ranking_geral - a.ranking_geral)[0]
				: null;
		const topScorer =
			rows.length > 0
				? [...rows].sort((a, b) => b.artilharia - a.artilharia)[0]
				: null;
		const topAssister =
			rows.length > 0
				? [...rows].sort((a, b) => b.assistencias - a.assistencias)[0]
				: null;

		return {
			activeInSeason,
			associatesCount,
			guestsCount,
			matchesCount,
			roundsCount,
			lastRoundDate,
			totalGoals,
			totalAssists,
			totalCleanSheets,
			avgGoalsPerMatch,
			topLeader:
				topLeader && topLeader.ranking_geral > 0 ? topLeader : null,
			topScorer: topScorer && topScorer.artilharia > 0 ? topScorer : null,
			topAssister:
				topAssister && topAssister.assistencias > 0
					? topAssister
					: null,
		};
	}, [rankingData?.rows, players, seasonMatches, seasonRounds]);

	const filteredAndSortedRows = useMemo(() => {
		const rows = rankingData?.rows ?? [];
		const q = search.toLowerCase().trim();
		const filtered = q
			? rows.filter(
					(r) =>
						r.boleiro.toLowerCase().includes(q) ||
						r.posicao.toLowerCase().includes(q),
				)
			: [...rows];

		filtered.sort((a, b) => {
			const av = a[sortKey];
			const bv = b[sortKey];
			if (typeof av === 'number' && typeof bv === 'number') {
				return sortDir === 'desc' ? bv - av : av - bv;
			}
			return sortDir === 'desc'
				? String(bv).localeCompare(String(av))
				: String(av).localeCompare(String(bv));
		});
		return filtered;
	}, [rankingData?.rows, search, sortKey, sortDir]);

	const handleSort = (key: SortKey) => {
		if (sortKey === key) {
			setSortDir((prev) => (prev === 'desc' ? 'asc' : 'desc'));
		} else {
			setSortKey(key);
			setSortDir('desc');
		}
	};

	const handleExportCsv = async () => {
		if (!effectiveSeasonId) return;
		const apiBase =
			process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:8000/api/v1';
		const token =
			typeof window !== 'undefined'
				? localStorage.getItem('access_token')
				: null;
		const resp = await fetch(
			`${apiBase}/rankings/season/${effectiveSeasonId}/export-csv`,
			{
				headers: token ? { Authorization: `Bearer ${token}` } : {},
			},
		);
		if (!resp.ok) {
			alert('Erro ao exportar CSV do ranking.');
			return;
		}
		const blob = await resp.blob();
		const url = URL.createObjectURL(blob);
		const a = document.createElement('a');
		a.href = url;
		a.download = `ranking_associacao_baygon_t${rankingData?.season_number ?? effectiveSeasonId}.csv`;
		document.body.appendChild(a);
		a.click();
		a.remove();
		URL.revokeObjectURL(url);
	};

	if (
		rankingQuery.isLoading ||
		playersQuery.isLoading ||
		allMatchesQuery.isLoading
	) {
		return <Loading />;
	}
	if (
		rankingQuery.isError ||
		playersQuery.isError ||
		allMatchesQuery.isError
	) {
		return (
			<div className="text-muted items-center">
				Erro ao carregar dados.
			</div>
		);
	}

	const currentSeasonObj = seasons.find(
		(s) => String(s.id_season) === String(effectiveSeasonId),
	);

	return (
		<div className="flex flex-col gap-5 animate-slide-down">
			{/* Top Header + Filtro de Temporada Externo */}
			<div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-surface border border-border rounded-xl p-4 sm:px-5">
				<div>
					<div className="flex items-center gap-2.5 flex-wrap">
						<h1 className="text-xl sm:text-2xl font-bold text-main">
							Olá, {user?.username} 👋
						</h1>
						{currentSeasonObj && (
							<span
								className={`text-[11px] font-semibold px-2 py-0.5 rounded-full uppercase tracking-wider ${
									currentSeasonObj.is_active
										? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
										: 'bg-zinc-500/15 text-zinc-400 border border-zinc-500/30'
								}`}
							>
								{currentSeasonObj.is_active
									? 'Temporada Ativa'
									: 'Encerrada'}
							</span>
						)}
					</div>
					<p className="text-xs sm:text-sm text-muted mt-0.5">
						{isNonAdmin
							? 'Acompanhe seu desempenho e o Ranking Oficial da Associação Baygon.'
							: 'Visão administrativa e Ranking Oficial da Associação Baygon.'}
					</p>
				</div>

				{/* Filtro Externo de Temporada */}
				{seasons.length > 0 && (
					<div className="flex items-center gap-2.5 self-start sm:self-auto flex-wrap">
						<Select
							value={effectiveSeasonId}
							onChange={(e) =>
								setSelectedSeasonId(e.target.value)
							}
							containerClassName="w-auto min-w-[190px]"
						>
							{seasons.map((s) => (
								<option
									key={s.id_season}
									value={String(s.id_season)}
									className="bg-[#0f172a] text-main"
								>
									{s.number}ª Temporada
									{s.is_active ? ' (Ativa)' : ''}
								</option>
							))}
						</Select>

						{effectiveSeasonId && (
							<Link
								href={`/seasons/${effectiveSeasonId}`}
								title="Ver detalhes e rodadas da temporada"
								className="h-9 px-3 rounded-lg bg-background/80 border border-border text-xs font-medium text-muted hover:text-main hover:border-primary flex items-center gap-1.5 transition-colors"
							>
								<span>Rodadas</span>
								<ExternalLink className="w-3.5 h-3.5" />
							</Link>
						)}
					</div>
				)}
			</div>

			{/* Notificação de Rodada Aberta + Confirmação de Presença */}
			{openRound && (
				<div className="bg-gradient-to-r from-blue-950/40 via-surface to-slate-900 border border-primary/40 rounded-xl p-4 sm:p-5 shadow-lg relative overflow-hidden animate-slide-down">
					<div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
						<div className="flex items-start gap-3.5">
							<div className="w-10 h-10 sm:w-11 sm:h-11 rounded-xl bg-amber-500/15 border border-amber-500/35 flex items-center justify-center text-amber-400 shrink-0 mt-0.5 shadow-inner">
								<Bell className="w-5 h-5 animate-pulse" />
							</div>
							<div>
								<div className="flex items-center gap-2 flex-wrap">
									<span className="text-[11px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider bg-amber-500/15 text-amber-400 border border-amber-500/30">
										Rodada Aberta
									</span>
									<h2 className="text-base sm:text-lg font-bold text-main">
										{openRound.round_number}ª Rodada Disponível
									</h2>
								</div>

								<div className="flex items-center gap-3 text-xs text-muted mt-1 flex-wrap">
									<span className="flex items-center gap-1">
										<Calendar className="w-3.5 h-3.5 text-primary" />
										{new Date(openRound.date).toLocaleDateString('pt-BR', {
											weekday: 'short',
											day: '2-digit',
											month: '2-digit',
											year: 'numeric',
										})}
									</span>
									{openRound.location && (
										<span>
											• Local: <strong className="text-main">{openRound.location}</strong>
										</span>
									)}
									{openRound.initial_time && (
										<span className="flex items-center gap-1">
											<Clock className="w-3.5 h-3.5 text-primary" />
											{new Date(openRound.initial_time).toLocaleTimeString('pt-BR', {
												hour: '2-digit',
												minute: '2-digit',
											})}
										</span>
									)}
								</div>

								<p className="text-xs sm:text-sm text-main font-medium mt-2">
									Deseja confirmar sua presença nesta rodada?
								</p>
							</div>
						</div>

						{/* Ações de Presença e Status Atual */}
						<div className="flex flex-col sm:flex-row sm:items-center gap-2.5 lg:self-center">
							{userAttendance?.status === 'confirmed' && (
								<span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
									<CheckCircle2 className="w-4 h-4" />
									Presença Confirmada
								</span>
							)}
							{userAttendance?.status === 'waiting' && (
								<span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-yellow-500/15 text-yellow-400 border border-yellow-500/30">
									<Clock className="w-4 h-4" />
									Lista de Espera
								</span>
							)}
							{userAttendance?.status === 'declined' && (
								<span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-red-500/15 text-red-400 border border-red-500/30">
									<XCircle className="w-4 h-4" />
									Ausência Informada
								</span>
							)}

							<div className="flex items-center gap-2 flex-wrap">
								<button
									type="button"
									disabled={confirmAttendanceMutation.isPending}
									onClick={() => confirmAttendanceMutation.mutate('confirmed')}
									className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer ${
										userAttendance?.status === 'confirmed'
											? 'bg-emerald-600 text-white shadow-sm'
											: 'bg-emerald-500/15 text-emerald-400 hover:bg-emerald-500/25 border border-emerald-500/30'
									}`}
								>
									<Check className="w-3.5 h-3.5" />
									<span>{userAttendance?.status === 'confirmed' ? 'Confirmado' : 'Vou Jogar'}</span>
								</button>

								<button
									type="button"
									disabled={confirmAttendanceMutation.isPending}
									onClick={() => confirmAttendanceMutation.mutate('waiting')}
									className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer ${
										userAttendance?.status === 'waiting'
											? 'bg-yellow-600 text-white shadow-sm'
											: 'bg-yellow-500/15 text-yellow-400 hover:bg-yellow-500/25 border border-yellow-500/30'
									}`}
								>
									<Clock className="w-3.5 h-3.5" />
									<span>Espera</span>
								</button>

								<button
									type="button"
									disabled={confirmAttendanceMutation.isPending}
									onClick={() => confirmAttendanceMutation.mutate('declined')}
									className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer ${
										userAttendance?.status === 'declined'
											? 'bg-red-600 text-white shadow-sm'
											: 'bg-red-500/15 text-red-400 hover:bg-red-500/25 border border-red-500/30'
									}`}
								>
									<XCircle className="w-3.5 h-3.5" />
									<span>Não vou</span>
								</button>

								<Link
									href={`/rounds/${openRound.id_round}`}
									className="px-3 py-1.5 rounded-lg bg-background/80 border border-border text-xs font-medium text-muted hover:text-main hover:border-primary flex items-center gap-1 transition-colors"
								>
									<span>Ver Rodada</span>
									<ExternalLink className="w-3 h-3" />
								</Link>
							</div>
						</div>
					</div>

					{/* Feedback e Contadores */}
					<div className="mt-3 pt-3 border-t border-border/60 flex items-center justify-between text-xs text-muted flex-wrap gap-2">
						<div className="flex items-center gap-3">
							<span>
								Confirmados:{' '}
								<strong className="text-emerald-400">
									{openRoundAttendanceQuery.data?.confirmed_count ?? 0}
								</strong>
							</span>
							<span>
								Espera:{' '}
								<strong className="text-yellow-400">
									{openRoundAttendanceQuery.data?.waiting_count ?? 0}
								</strong>
							</span>
						</div>
						{attendanceFeedback && (
							<span className="text-emerald-400 font-semibold animate-fade-in">
								{attendanceFeedback}
							</span>
						)}
					</div>
				</div>
			)}

			{/* Cards Compactos de Visão Rápida (Atualizados conforme a Temporada Selecionada) */}
			<div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
				<StatsCard
					title="Elenco & Participação"
					value={`${dashboardMetrics.activeInSeason} / ${players.length}`}
					subtitle="Boleiros com presença na temporada"
					accentColor="blue"
					icon={<Users className="w-4 h-4" />}
					footer={
						<div className="flex items-center justify-between">
							<span>
								Mensalistas:{' '}
								<strong className="text-main">
									{dashboardMetrics.associatesCount}
								</strong>
							</span>
							<span>
								Convidados:{' '}
								<strong className="text-main">
									{dashboardMetrics.guestsCount}
								</strong>
							</span>
						</div>
					}
				/>

				<StatsCard
					title="Partidas & Rodadas"
					value={dashboardMetrics.matchesCount}
					subtitle={`${dashboardMetrics.roundsCount} ${dashboardMetrics.roundsCount === 1 ? 'rodada disputada' : 'rodadas disputadas'}`}
					accentColor="emerald"
					icon={<Swords className="w-4 h-4" />}
					footer={
						<div className="flex items-center justify-between">
							<span>Último baba:</span>
							<strong className="text-main">
								{dashboardMetrics.lastRoundDate}
							</strong>
						</div>
					}
				/>

				<StatsCard
					title="Balanço de Gols"
					value={dashboardMetrics.totalGoals}
					subtitle={`Média de ${dashboardMetrics.avgGoalsPerMatch} gols por partida`}
					accentColor="amber"
					icon={<Flame className="w-4 h-4" />}
					footer={
						<div className="flex items-center justify-between">
							<span>
								Assist.:{' '}
								<strong className="text-main">
									{dashboardMetrics.totalAssists}
								</strong>
							</span>
							<span>
								Clean Sheets:{' '}
								<strong className="text-main">
									{dashboardMetrics.totalCleanSheets}
								</strong>
							</span>
						</div>
					}
				/>

				<StatsCard
					title="Líderes da Temporada"
					value={
						dashboardMetrics.topLeader
							? dashboardMetrics.topLeader.boleiro
							: 'Sem líder'
					}
					subtitle={
						dashboardMetrics.topLeader
							? `1º Geral · ${dashboardMetrics.topLeader.ranking_geral} pts`
							: 'Aguardando pontuação'
					}
					accentColor="purple"
					icon={<Trophy className="w-4 h-4" />}
					footer={
						<div className="flex items-center justify-between gap-2 truncate">
							<span className="truncate">
								⚽{' '}
								<strong className="text-main">
									{dashboardMetrics.topScorer
										? `${dashboardMetrics.topScorer.boleiro} (${dashboardMetrics.topScorer.artilharia})`
										: '—'}
								</strong>
							</span>
							<span className="truncate">
								👟{' '}
								<strong className="text-main">
									{dashboardMetrics.topAssister
										? `${dashboardMetrics.topAssister.boleiro} (${dashboardMetrics.topAssister.assistencias})`
										: '—'}
								</strong>
							</span>
						</div>
					}
				/>
			</div>

			{/* Card de Destaque da Posição do Usuário no Ranking */}
			{myRankingStats && (
				<div className="bg-gradient-to-r from-blue-950/60 via-surface to-slate-900 border-2 border-primary/40 rounded-xl p-4 sm:p-5 shadow-lg relative overflow-hidden flex flex-col md:flex-row md:items-center justify-between gap-4">
					<div className="flex items-start sm:items-center gap-3.5">
						<div className="w-12 h-12 rounded-xl bg-primary/20 border border-primary/40 flex items-center justify-center text-primary shrink-0 shadow-inner">
							<Trophy className="w-6 h-6 text-yellow-400" />
						</div>
						<div>
							<div className="flex items-center gap-2 flex-wrap">
								<span className="text-xs font-semibold uppercase tracking-wider text-primary">
									Sua Posição no Ranking Oficial
								</span>
								<span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-primary/20 text-blue-300 border border-primary/30">
									{myRankingStats.row.boleiro}
								</span>
							</div>
							<div className="flex items-baseline gap-2 mt-0.5">
								<h3 className="text-2xl sm:text-3xl font-extrabold text-main">
									{myRankingStats.position}º Lugar
								</h3>
								<span className="text-xs text-muted">
									entre {myRankingStats.totalPlayers} boleiros listados
								</span>
							</div>
						</div>
					</div>

					<div className="flex flex-wrap items-center gap-2 sm:gap-3 text-xs">
						<div className="bg-background/80 border border-border rounded-lg px-3 py-2 flex flex-col items-center min-w-[70px]">
							<span className="text-muted text-[11px]">Pontos</span>
							<strong className="text-sm font-bold text-primary">
								{myRankingStats.row.ranking_geral}
							</strong>
						</div>
						<div className="bg-background/80 border border-border rounded-lg px-3 py-2 flex flex-col items-center min-w-[70px]">
							<span className="text-muted text-[11px]">Gols</span>
							<strong className="text-sm font-bold text-main">
								{myRankingStats.row.artilharia}
							</strong>
						</div>
						<div className="bg-background/80 border border-border rounded-lg px-3 py-2 flex flex-col items-center min-w-[70px]">
							<span className="text-muted text-[11px]">Assist.</span>
							<strong className="text-sm font-bold text-main">
								{myRankingStats.row.assistencias}
							</strong>
						</div>
						<div className="bg-background/80 border border-border rounded-lg px-3 py-2 flex flex-col items-center min-w-[70px]">
							<span className="text-muted text-[11px]">Babas</span>
							<strong className="text-sm font-bold text-emerald-400">
								{myRankingStats.row.babas_conquistados}
							</strong>
						</div>
						<div className="bg-background/80 border border-border rounded-lg px-3 py-2 flex flex-col items-center min-w-[70px]">
							<span className="text-muted text-[11px]">Presenças</span>
							<strong className="text-sm font-bold text-main">
								{myRankingStats.row.presenca_baba}
							</strong>
						</div>

						<button
							type="button"
							onClick={scrollToMyRow}
							className="h-10 px-3.5 rounded-lg bg-primary hover:bg-primary-hover text-white text-xs font-semibold flex items-center gap-1.5 transition-colors shadow-sm ml-auto sm:ml-0 cursor-pointer"
						>
							<ArrowDown className="w-3.5 h-3.5" />
							<span>Ver na Tabela</span>
						</button>
					</div>
				</div>
			)}

			{/* Tabela de Ranking */}
			<div className="bg-surface border border-border rounded-xl p-4 sm:p-5 flex flex-col gap-4">
				<div className="flex items-center justify-between flex-wrap gap-3">
					<div>
						<h2 className="text-lg sm:text-xl font-semibold text-main">
							🏆 Ranking Associação Baygon
							{rankingData?.season_number
								? ` — ${rankingData.season_number}ª Temporada`
								: ''}
						</h2>
						<p className="text-xs text-muted">
							Clique em qualquer coluna para ordenar ({filteredAndSortedRows.length}{' '}
							{filteredAndSortedRows.length === 1
								? 'boleiro listado'
								: 'boleiros listados'}
							)
						</p>
					</div>

					<div className="flex flex-wrap items-center gap-2">
						<div className="relative w-56">
							<Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted" />
							<input
								type="text"
								placeholder="Buscar boleiro ou posição..."
								value={search}
								onChange={(e) => setSearch(e.target.value)}
								className="w-full bg-background/80 border border-border rounded-lg pl-8 pr-3 py-1.5 text-xs sm:text-sm text-main placeholder:text-muted focus:outline-none focus:border-primary transition-colors"
							/>
						</div>

						{effectiveSeasonId && (
							<Button
								size="sm"
								variant="ghost"
								onClick={handleExportCsv}
								className="!w-auto flex items-center gap-1.5 text-xs"
							>
								<Download className="w-3.5 h-3.5" />
								<span>Exportar CSV</span>
							</Button>
						)}
					</div>
				</div>

				<div className="overflow-x-auto border border-border rounded-lg">
					<table className="w-full text-xs border-collapse whitespace-nowrap">
						<thead>
							<tr className="bg-white/5 text-muted border-b border-border">
								<th className="py-2.5 px-3 text-left">#</th>
								<th
									onClick={() => handleSort('boleiro')}
									className="py-2.5 px-3 text-left sticky left-0 bg-surface cursor-pointer hover:text-main"
								>
									Boleiros
								</th>
								{NUMERIC_COLUMNS.map((col) => (
									<th
										key={col.key}
										onClick={() => handleSort(col.key)}
										className={`py-2.5 px-3 text-center cursor-pointer hover:text-main ${
											sortKey === col.key
												? 'text-primary font-bold'
												: ''
										}`}
									>
										{col.label}
										{sortKey === col.key
											? sortDir === 'desc'
												? ' ↓'
												: ' ↑'
											: ''}
									</th>
								))}
								<th className="py-2.5 px-3 text-center">
									Último Baba
								</th>
								<th className="py-2.5 px-3 text-center">
									Última Vitória
								</th>
								<th
									onClick={() => handleSort('posicao')}
									className="py-2.5 px-3 text-center cursor-pointer hover:text-main"
								>
									Posição
								</th>
							</tr>
						</thead>
						<tbody className="divide-y divide-border">
							{filteredAndSortedRows.length === 0 ? (
								<tr>
									<td
										colSpan={NUMERIC_COLUMNS.length + 5}
										className="py-6 text-center text-muted"
									>
										Nenhum dado encontrado para esta
										temporada.
									</td>
								</tr>
							) : (
								filteredAndSortedRows.map((row, idx) => {
									const isCurrentUser = Boolean(
										currentPlayer &&
											row.player_id ===
												currentPlayer.id_player,
									);
									return (
										<tr
											key={row.player_id}
											id={
												isCurrentUser
													? 'my-ranking-row'
													: undefined
											}
											className={`transition-colors ${
												isCurrentUser
													? 'bg-primary/20 hover:bg-primary/30 border-y-2 border-primary/60 font-semibold shadow-[inset_0_0_12px_rgba(59,130,246,0.25)]'
													: 'hover:bg-white/[0.03]'
											}`}
										>
											<td
												className={`py-2 px-3 font-medium ${
													isCurrentUser
														? 'text-primary font-bold'
														: 'text-muted'
												}`}
											>
												{idx + 1}º
											</td>
											<td
												className={`py-2 px-3 font-semibold text-main sticky left-0 ${
													isCurrentUser
														? 'bg-primary/20'
														: 'bg-surface'
												}`}
											>
												<div className="flex items-center gap-1.5">
													<Link
														href={`/players/${row.player_id}`}
														className="hover:text-primary hover:underline"
													>
														{row.boleiro}
													</Link>
													{isCurrentUser && (
														<span className="text-[10px] uppercase font-extrabold px-1.5 py-0.5 rounded bg-primary text-white tracking-wider shadow-sm">
															Você
														</span>
													)}
												</div>
											</td>
											{NUMERIC_COLUMNS.map((col) => {
												const val = row[col.key] as number;
												const isMain =
													col.key === 'ranking_geral';
												return (
													<td
														key={col.key}
														className={`py-2 px-3 text-center ${
															isMain
																? 'font-bold text-primary'
																: val > 0
																	? 'text-main'
																	: 'text-muted/60'
														}`}
													>
														{val}
													</td>
												);
											})}
											<td className="py-2 px-3 text-center text-main">
												{row.ultimo_baba}
											</td>
											<td className="py-2 px-3 text-center text-main">
												{row.ultima_vitoria}
											</td>
											<td className="py-2 px-3 text-center text-xs font-medium text-muted">
												{row.posicao}
											</td>
										</tr>
									);
								})
							)}
						</tbody>
					</table>
				</div>
			</div>
		</div>
	);
}
