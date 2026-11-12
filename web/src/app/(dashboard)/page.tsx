'use client';

import { Button } from '@/components/Button';
import { Input } from '@/components/Input';
import { Loading } from '@/components/Loading';
import { Select } from '@/components/Select';
import { StatsCard } from '@/components/StatsCard';
import { useAuth } from '@/context/AuthContext';
import { fetchAPI } from '@/lib/api';
import { Season } from '@/types/types';
import { useQueries, useQuery } from '@tanstack/react-query';
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

	const [seasonsQuery, playersQuery, matchesQuery] = useQueries({
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
	const players: unknown[] = playersQuery.data ?? [];
	const matches: unknown[] = matchesQuery.data ?? [];
	const rankingData = rankingQuery.data;

	const effectiveSeasonId =
		selectedSeasonId ||
		(rankingData?.season_id ? String(rankingData.season_id) : '');

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
		matchesQuery.isLoading
	) {
		return <Loading />;
	}
	if (rankingQuery.isError || playersQuery.isError || matchesQuery.isError) {
		return (
			<div className="text-muted items-center">
				Erro ao carregar dados.
			</div>
		);
	}

	return (
		<div className="flex flex-col gap-6 animate-slide-down">
			<div>
				<h1 className="text-3xl text-main">Olá, {user?.username} 👋</h1>
				<p className="text-sm text-muted mt-1">
					Ranking Oficial da Associação Baygon e resumo do campeonato.
				</p>
			</div>

			<div className="grid grid-cols-[repeat(auto-fit,minmax(220px,1fr))] gap-4">
				<StatsCard title="Jogadores Ativos" value={players.length} />
				<StatsCard title="Partidas Realizadas" value={matches.length} />
				<StatsCard
					title="Temporada Exibida"
					value={
						rankingData?.season_number
							? `${rankingData.season_number}ª Temporada`
							: '—'
					}
				/>
			</div>

			<div className="bg-surface border border-border rounded-xl p-5 flex flex-col gap-4">
				<div className="flex items-center justify-between flex-wrap gap-3">
					<div>
						<h2 className="text-xl font-semibold text-main">
							🏆 Ranking Associação Baygon
							{rankingData?.season_number
								? ` — ${rankingData.season_number}ª Temporada`
								: ''}
						</h2>
						<p className="text-xs text-muted">
							Clique em qualquer coluna para ordenar
						</p>
					</div>

					<div className="flex flex-wrap items-center gap-2">
						<div className="w-48">
							<Input
								placeholder="Buscar boleiro/posição..."
								value={search}
								onChange={(e) => setSearch(e.target.value)}
							/>
						</div>
						{seasons.length > 0 && (
							<div className="w-44">
								<Select
									value={effectiveSeasonId}
									onChange={(e) =>
										setSelectedSeasonId(e.target.value)
									}
								>
									{seasons.map((s) => (
										<option
											key={s.id_season}
											value={String(s.id_season)}
										>
											{s.number}ª Temporada
											{s.is_active ? ' (Ativa)' : ''}
										</option>
									))}
								</Select>
							</div>
						)}
						{effectiveSeasonId && (
							<Button
								variant="ghost"
								onClick={handleExportCsv}
								className="w-auto"
							>
								📥 Exportar CSV
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
										Nenhum dado encontrado para esta temporada.
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
