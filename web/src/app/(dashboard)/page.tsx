'use client';

import { Button } from '@/components/Button';
import { Loading } from '@/components/Loading';
import { StatsCard } from '@/components/StatsCard';
import { useAuth } from '@/context/AuthContext';
import { fetchAPI } from '@/lib/api';
import { Match, Round, Season } from '@/types/types';
import { useQueries, useQuery } from '@tanstack/react-query';
import {
	Calendar,
	Download,
	ExternalLink,
	Flame,
	Search,
	Swords,
	Trophy,
	Users,
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
						Visão administrativa e Ranking Oficial da Associação
						Baygon.
					</p>
				</div>

				{/* Filtro Externo de Temporada */}
				{seasons.length > 0 && (
					<div className="flex items-center gap-2.5 self-start sm:self-auto flex-wrap">
						<div className="flex items-center gap-2 bg-background/80 border border-border rounded-lg px-3 py-1.5">
							<Calendar className="w-4 h-4 text-primary shrink-0" />
							<span className="text-xs font-semibold text-muted uppercase tracking-wider whitespace-nowrap">
								Temporada:
							</span>
							<select
								value={effectiveSeasonId}
								onChange={(e) =>
									setSelectedSeasonId(e.target.value)
								}
								className="bg-transparent text-sm font-semibold text-main focus:outline-none cursor-pointer pr-2 min-w-[165px]"
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
							</select>
						</div>

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
								filteredAndSortedRows.map((row, idx) => (
									<tr
										key={row.player_id}
										className="hover:bg-white/[0.03] transition-colors"
									>
										<td className="py-2 px-3 text-muted font-medium">
											{idx + 1}º
										</td>
										<td className="py-2 px-3 font-semibold text-main sticky left-0 bg-surface">
											<Link
												href={`/players/${row.player_id}`}
												className="hover:text-primary hover:underline"
											>
												{row.boleiro}
											</Link>
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
								))
							)}
						</tbody>
					</table>
				</div>
			</div>
		</div>
	);
}
