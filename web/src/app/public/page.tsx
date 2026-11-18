'use client';

import React, { useState, useMemo } from 'react';
import { useQueries, useQuery } from '@tanstack/react-query';
import { fetchAPI } from '@/lib/api';
import { SeasonSelector, Season } from '@/components/SeasonSelector';
import { Loading } from '@/components/Loading';
import {
	Trophy,
	Medal,
	Search,
	Download,
	Sparkles,
	Flame,
	Goal,
	ShieldCheck,
	ArrowUpDown,
	ArrowUp,
	ArrowDown,
	Users,
	Swords,
	Star,
} from 'lucide-react';

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

type TabCategory = 'geral' | 'artilharia' | 'assistencias' | 'defesa' | 'premios';

export default function PublicRankingPage() {
	const [selectedSeasonOverride, setSelectedSeasonOverride] = useState<string>('');
	const [search, setSearch] = useState('');
	const [activeTab, setActiveTab] = useState<TabCategory>('geral');
	const [sortKey, setSortKey] = useState<keyof AssociationRankingRow>('ranking_geral');
	const [sortDir, setSortDir] = useState<'desc' | 'asc'>('desc');

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

	// Busca de Ranking da temporada selecionada
	const rankingQuery = useQuery<AssociationRankingResponse>({
		queryKey: ['public-ranking', selectedSeason],
		queryFn: () =>
			fetchAPI(
				selectedSeason
					? `/rankings/association?season_id=${selectedSeason}`
					: '/rankings/association',
			),
		enabled: Boolean(selectedSeason) || seasonsQuery.isSuccess,
	});

	// Busca de partidas para estatísticas resumidas
	const matchesQuery = useQuery<any[]>({
		queryKey: ['public-matches-summary', selectedSeason],
		queryFn: () =>
			fetchAPI(
				selectedSeason
					? `/matches/season/${selectedSeason}`
					: '/matches/',
			).catch(() => []),
		enabled: Boolean(selectedSeason),
	});

	const rows = rankingQuery.data?.rows ?? [];
	const matches = matchesQuery.data ?? [];

	// Resumo estatístico
	const stats = useMemo(() => {
		const totalMatches = matches.length;
		const totalGoals = matches.reduce(
			(acc, m) => acc + (Number(m.home_score || 0) + Number(m.away_score || 0)),
			0,
		);
		const avgGoals = totalMatches > 0 ? (totalGoals / totalMatches).toFixed(1) : '0.0';
		const totalPlayers = rows.length;

		return {
			totalMatches,
			totalGoals,
			avgGoals,
			totalPlayers,
		};
	}, [matches, rows]);

	// Atualizar sort key quando mudar a aba
	const handleTabChange = (tab: TabCategory) => {
		setActiveTab(tab);
		if (tab === 'artilharia') {
			setSortKey('artilharia');
			setSortDir('desc');
		} else if (tab === 'assistencias') {
			setSortKey('assistencias');
			setSortDir('desc');
		} else if (tab === 'defesa') {
			setSortKey('clean_sheets');
			setSortDir('desc');
		} else if (tab === 'premios') {
			setSortKey('bola_cheia');
			setSortDir('desc');
		} else {
			setSortKey('ranking_geral');
			setSortDir('desc');
		}
	};

	// Ordenação
	const handleSort = (key: keyof AssociationRankingRow) => {
		if (sortKey === key) {
			setSortDir((prev) => (prev === 'desc' ? 'asc' : 'desc'));
		} else {
			setSortKey(key);
			setSortDir('desc');
		}
	};

	// Linhas filtradas e ordenadas
	const filteredRows = useMemo(() => {
		let list = [...rows];
		if (search.trim()) {
			const term = search.toLowerCase();
			list = list.filter(
				(r) =>
					r.boleiro.toLowerCase().includes(term) ||
					(r.posicao && r.posicao.toLowerCase().includes(term)),
			);
		}

		list.sort((a, b) => {
			const valA = a[sortKey];
			const valB = b[sortKey];

			if (typeof valA === 'number' && typeof valB === 'number') {
				return sortDir === 'desc' ? valB - valA : valA - valB;
			}
			return sortDir === 'desc'
				? String(valB).localeCompare(String(valA))
				: String(valA).localeCompare(String(valB));
		});

		return list;
	}, [rows, search, sortKey, sortDir]);

	// Top 3 do ranking geral
	const top3 = useMemo(() => {
		const sorted = [...rows].sort((a, b) => b.ranking_geral - a.ranking_geral);
		return sorted.slice(0, 3);
	}, [rows]);

	// Exportação CSV
	const handleExportCsv = async () => {
		if (!selectedSeason) return;
		try {
			const res = await fetch(
				`${process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:8001/api/v1'}/rankings/season/${selectedSeason}/export-csv`,
			);
			if (!res.ok) throw new Error('Erro ao baixar CSV');
			const blob = await res.blob();
			const url = window.URL.createObjectURL(blob);
			const a = document.createElement('a');
			a.href = url;
			a.download = `ranking_baygon_temporada_${selectedSeason}.csv`;
			document.body.appendChild(a);
			a.click();
			a.remove();
		} catch (err) {
			console.error('Falha ao exportar CSV', err);
		}
	};

	return (
		<div className="space-y-6">
			{/* Top Bar com Título e Seletor de Temporada */}
			<div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-border">
				<div>
					<div className="flex items-center gap-2">
						<span className="p-2 rounded-xl bg-amber-500/10 text-amber-500 border border-amber-500/20">
							<Trophy size={22} />
						</span>
						<div>
							<h1 className="text-xl sm:text-2xl font-bold text-main tracking-tight">
								Classificação Geral & Ranking
							</h1>
							<p className="text-xs sm:text-sm text-muted">
								Acompanhe os líderes, artilheiros e estatísticas de cada boleiro
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

			{/* Cartões de Métricas Rápidas */}
			<div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
				<div className="bg-surface border border-border rounded-xl p-4 flex items-center gap-3.5 shadow-xs">
					<div className="w-10 h-10 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0">
						<Users size={20} />
					</div>
					<div>
						<span className="text-xs text-muted block">Boleiros Pontuando</span>
						<span className="text-lg sm:text-xl font-bold text-main">
							{stats.totalPlayers}
						</span>
					</div>
				</div>

				<div className="bg-surface border border-border rounded-xl p-4 flex items-center gap-3.5 shadow-xs">
					<div className="w-10 h-10 rounded-lg bg-blue-500/10 text-blue-500 flex items-center justify-center shrink-0">
						<Swords size={20} />
					</div>
					<div>
						<span className="text-xs text-muted block">Total de Partidas</span>
						<span className="text-lg sm:text-xl font-bold text-main">
							{stats.totalMatches}
						</span>
					</div>
				</div>

				<div className="bg-surface border border-border rounded-xl p-4 flex items-center gap-3.5 shadow-xs">
					<div className="w-10 h-10 rounded-lg bg-emerald-500/10 text-emerald-500 flex items-center justify-center shrink-0">
						<Goal size={20} />
					</div>
					<div>
						<span className="text-xs text-muted block">Gols Marcados</span>
						<span className="text-lg sm:text-xl font-bold text-main">
							{stats.totalGoals}
						</span>
					</div>
				</div>

				<div className="bg-surface border border-border rounded-xl p-4 flex items-center gap-3.5 shadow-xs">
					<div className="w-10 h-10 rounded-lg bg-amber-500/10 text-amber-500 flex items-center justify-center shrink-0">
						<Flame size={20} />
					</div>
					<div>
						<span className="text-xs text-muted block">Média de Gols/Jogo</span>
						<span className="text-lg sm:text-xl font-bold text-main">
							{stats.avgGoals}
						</span>
					</div>
				</div>
			</div>

			{/* Pódio dos Top 3 */}
			{top3.length >= 3 && !search && (
				<div className="bg-gradient-to-b from-surface to-background border border-border rounded-2xl p-5 sm:p-6 shadow-sm">
					<div className="flex items-center justify-between mb-6">
						<div className="flex items-center gap-2">
							<Sparkles size={18} className="text-amber-500" />
							<h2 className="text-sm sm:text-base font-bold text-main uppercase tracking-wider">
								Pódio da Temporada
							</h2>
						</div>
						<span className="text-xs text-muted">Líderes em pontos corridos</span>
					</div>

					<div className="grid grid-cols-1 md:grid-cols-3 gap-6 md:gap-4 items-end max-w-4xl mx-auto pt-6 md:pt-4">
						{/* 2º Lugar - Prata */}
						<div className="order-2 md:order-1 bg-surface border border-slate-300 dark:border-slate-700/60 rounded-xl p-4 text-center relative shadow-xs hover:border-slate-400 transition-all mt-4 md:mt-0">
							<div className="w-10 h-10 rounded-full bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-200 font-black text-sm flex items-center justify-center mx-auto -mt-8 border-2 border-background shadow-xs">
								2º
							</div>
							<div className="mt-2">
								<span className="text-xs font-semibold text-slate-500 uppercase tracking-wider block">
									🥈 Prata
								</span>
								<h3 className="text-base font-bold text-main mt-0.5 truncate" title={top3[1].boleiro}>
									{top3[1].boleiro}
								</h3>
								<span className="text-xs text-muted block">{top3[1].posicao || 'Boleiro'}</span>
								<div className="mt-3 pt-3 border-t border-border flex items-center justify-center gap-3 text-xs">
									<div>
										<span className="text-muted block text-[10px]">Pontos</span>
										<strong className="text-base text-main font-bold">
											{top3[1].ranking_geral}
										</strong>
									</div>
									<div className="w-px h-6 bg-border" />
									<div>
										<span className="text-muted block text-[10px]">Gols</span>
										<strong className="text-base text-main font-bold">
											{top3[1].artilharia}
										</strong>
									</div>
								</div>
							</div>
						</div>

						{/* 1º Lugar - Ouro */}
						<div className="order-1 md:order-2 bg-gradient-to-b from-amber-500/10 to-surface border-2 border-amber-500/40 rounded-xl p-5 text-center relative shadow-md transform md:-translate-y-2 mt-4 md:mt-0">
							<div className="w-12 h-12 rounded-full bg-gradient-to-br from-amber-400 to-amber-600 text-white font-black text-base flex items-center justify-center mx-auto -mt-10 border-4 border-background shadow-md">
								1º
							</div>
							<div className="mt-2">
								<span className="inline-flex items-center gap-1 text-xs font-bold text-amber-500 uppercase tracking-wider">
									🥇 Campeão Atual
								</span>
								<h3 className="text-lg font-extrabold text-main mt-0.5 truncate" title={top3[0].boleiro}>
									{top3[0].boleiro}
								</h3>
								<span className="text-xs text-muted block">{top3[0].posicao || 'Boleiro'}</span>
								<div className="mt-3 pt-3 border-t border-amber-500/20 flex items-center justify-center gap-4 text-xs">
									<div>
										<span className="text-muted block text-[10px] uppercase font-medium">Pontos</span>
										<strong className="text-xl text-amber-500 font-extrabold">
											{top3[0].ranking_geral}
										</strong>
									</div>
									<div className="w-px h-7 bg-amber-500/20" />
									<div>
										<span className="text-muted block text-[10px] uppercase font-medium">Gols</span>
										<strong className="text-xl text-main font-extrabold">
											{top3[0].artilharia}
										</strong>
									</div>
									<div className="w-px h-7 bg-amber-500/20" />
									<div>
										<span className="text-muted block text-[10px] uppercase font-medium">Vitórias</span>
										<strong className="text-xl text-emerald-500 font-extrabold">
											{top3[0].babas_conquistados}
										</strong>
									</div>
								</div>
							</div>
						</div>

						{/* 3º Lugar - Bronze */}
						<div className="order-3 md:order-3 bg-surface border border-amber-800/30 dark:border-amber-700/30 rounded-xl p-4 text-center relative shadow-xs hover:border-amber-700/50 transition-all mt-4 md:mt-0">
							<div className="w-10 h-10 rounded-full bg-amber-800/20 text-amber-700 dark:text-amber-400 font-black text-sm flex items-center justify-center mx-auto -mt-8 border-2 border-background shadow-xs">
								3º
							</div>
							<div className="mt-2">
								<span className="text-xs font-semibold text-amber-700 dark:text-amber-500 uppercase tracking-wider block">
									🥉 Bronze
								</span>
								<h3 className="text-base font-bold text-main mt-0.5 truncate" title={top3[2].boleiro}>
									{top3[2].boleiro}
								</h3>
								<span className="text-xs text-muted block">{top3[2].posicao || 'Boleiro'}</span>
								<div className="mt-3 pt-3 border-t border-border flex items-center justify-center gap-3 text-xs">
									<div>
										<span className="text-muted block text-[10px]">Pontos</span>
										<strong className="text-base text-main font-bold">
											{top3[2].ranking_geral}
										</strong>
									</div>
									<div className="w-px h-6 bg-border" />
									<div>
										<span className="text-muted block text-[10px]">Gols</span>
										<strong className="text-base text-main font-bold">
											{top3[2].artilharia}
										</strong>
									</div>
								</div>
							</div>
						</div>
					</div>
				</div>
			)}

			{/* Painel da Tabela Completa com Abas e Busca */}
			<div className="bg-surface border border-border rounded-xl shadow-xs overflow-hidden">
				{/* Controles da Tabela: Abas e Busca */}
				<div className="p-4 border-b border-border flex flex-col md:flex-row md:items-center justify-between gap-4">
					{/* Abas */}
					<div className="flex items-center gap-1.5 overflow-x-auto pb-1 md:pb-0 scrollbar-none">
						<button
							type="button"
							onClick={() => handleTabChange('geral')}
							className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors cursor-pointer ${
								activeTab === 'geral'
									? 'bg-primary text-white shadow-xs'
									: 'bg-surface-hover text-muted hover:text-main'
							}`}
						>
							🏆 Classificação Geral
						</button>
						<button
							type="button"
							onClick={() => handleTabChange('artilharia')}
							className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors cursor-pointer ${
								activeTab === 'artilharia'
									? 'bg-primary text-white shadow-xs'
									: 'bg-surface-hover text-muted hover:text-main'
							}`}
						>
							⚽ Artilharia
						</button>
						<button
							type="button"
							onClick={() => handleTabChange('assistencias')}
							className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors cursor-pointer ${
								activeTab === 'assistencias'
									? 'bg-primary text-white shadow-xs'
									: 'bg-surface-hover text-muted hover:text-main'
							}`}
						>
							🎯 Garçons (Assistências)
						</button>
						<button
							type="button"
							onClick={() => handleTabChange('defesa')}
							className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors cursor-pointer ${
								activeTab === 'defesa'
									? 'bg-primary text-white shadow-xs'
									: 'bg-surface-hover text-muted hover:text-main'
							}`}
						>
							🧤 Paredões (Clean Sheets)
						</button>
						<button
							type="button"
							onClick={() => handleTabChange('premios')}
							className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors cursor-pointer ${
								activeTab === 'premios'
									? 'bg-primary text-white shadow-xs'
									: 'bg-surface-hover text-muted hover:text-main'
							}`}
						>
							🌟 Destaques & Prêmios
						</button>
					</div>

					{/* Ações da direita: Busca e Exportar CSV */}
					<div className="flex items-center gap-2">
						<div className="relative flex-1 md:w-64">
							<Search
								size={14}
								className="absolute left-3 top-1/2 -translate-y-1/2 text-muted"
							/>
							<input
								type="text"
								value={search}
								onChange={(e) => setSearch(e.target.value)}
								placeholder="Buscar boleiro..."
								className="w-full pl-8 pr-3 py-1.5 text-xs bg-background border border-border rounded-lg text-main placeholder:text-muted focus:outline-none focus:ring-1 focus:ring-primary"
							/>
						</div>

						<button
							type="button"
							onClick={handleExportCsv}
							title="Exportar CSV"
							className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium border border-border rounded-lg bg-surface hover:bg-surface-hover text-muted hover:text-main transition-colors shrink-0 cursor-pointer"
						>
							<Download size={14} />
							<span className="hidden sm:inline">CSV</span>
						</button>
					</div>
				</div>

				{/* Lista / Tabela */}
				{rankingQuery.isLoading ? (
					<div className="py-12">
						<Loading />
					</div>
				) : filteredRows.length === 0 ? (
					<div className="p-8 text-center text-muted text-sm">
						Nenhum boleiro encontrado para esta temporada ou termo de busca.
					</div>
				) : (
					<div className="overflow-x-auto">
						<table className="w-full min-w-[640px] text-left text-xs sm:text-sm">
							<thead className="bg-surface-hover text-muted uppercase text-[11px] font-semibold border-b border-border">
								<tr>
									<th className="py-3 px-3 sm:px-4 w-12 text-center">#</th>
									<th
										className="py-3 px-3 sm:px-4 cursor-pointer hover:text-main"
										onClick={() => handleSort('boleiro')}
									>
										<div className="flex items-center gap-1">
											<span>Boleiro</span>
											<ArrowUpDown size={12} />
										</div>
									</th>
									<th className="py-3 px-3 sm:px-4 hidden sm:table-cell">Posição</th>

									{activeTab === 'geral' && (
										<>
											<th
												className="py-3 px-3 sm:px-4 text-center cursor-pointer hover:text-main"
												onClick={() => handleSort('ranking_geral')}
											>
												<div className="flex items-center justify-center gap-1">
													<span>PTS</span>
													{sortKey === 'ranking_geral' && (
														sortDir === 'desc' ? <ArrowDown size={12} /> : <ArrowUp size={12} />
													)}
												</div>
											</th>
											<th
												className="py-3 px-3 sm:px-4 text-center cursor-pointer hover:text-main"
												onClick={() => handleSort('presenca_baba')}
											>
												<span>J</span>
											</th>
											<th
												className="py-3 px-3 sm:px-4 text-center cursor-pointer hover:text-main"
												onClick={() => handleSort('babas_conquistados')}
											>
												<span className="text-emerald-500 font-bold">V</span>
											</th>
											<th
												className="py-3 px-3 sm:px-4 text-center cursor-pointer hover:text-main"
												onClick={() => handleSort('empates')}
											>
												<span className="text-slate-400 font-bold">E</span>
											</th>
											<th
												className="py-3 px-3 sm:px-4 text-center cursor-pointer hover:text-main"
												onClick={() => handleSort('babas_perdidos')}
											>
												<span className="text-rose-500 font-bold">D</span>
											</th>
											<th
												className="py-3 px-3 sm:px-4 text-center cursor-pointer hover:text-main"
												onClick={() => handleSort('artilharia')}
											>
												<span>Gols</span>
											</th>
											<th
												className="py-3 px-3 sm:px-4 text-center cursor-pointer hover:text-main"
												onClick={() => handleSort('assistencias')}
											>
												<span>Assists</span>
											</th>
										</>
									)}

									{activeTab === 'artilharia' && (
										<>
											<th
												className="py-3 px-3 sm:px-4 text-center cursor-pointer hover:text-main"
												onClick={() => handleSort('artilharia')}
											>
												<div className="flex items-center justify-center gap-1">
													<span className="text-primary font-bold">⚽ Gols</span>
													{sortKey === 'artilharia' && (
														sortDir === 'desc' ? <ArrowDown size={12} /> : <ArrowUp size={12} />
													)}
												</div>
											</th>
											<th
												className="py-3 px-3 sm:px-4 text-center cursor-pointer hover:text-main"
												onClick={() => handleSort('premio_gol')}
											>
												<span>Gol Rodada</span>
											</th>
											<th
												className="py-3 px-3 sm:px-4 text-center cursor-pointer hover:text-main"
												onClick={() => handleSort('presenca_baba')}
											>
												<span>Jogos</span>
											</th>
										</>
									)}

									{activeTab === 'assistencias' && (
										<>
											<th
												className="py-3 px-3 sm:px-4 text-center cursor-pointer hover:text-main"
												onClick={() => handleSort('assistencias')}
											>
												<div className="flex items-center justify-center gap-1">
													<span className="text-primary font-bold">🎯 Assistências</span>
													{sortKey === 'assistencias' && (
														sortDir === 'desc' ? <ArrowDown size={12} /> : <ArrowUp size={12} />
													)}
												</div>
											</th>
											<th
												className="py-3 px-3 sm:px-4 text-center cursor-pointer hover:text-main"
												onClick={() => handleSort('premio_drible')}
											>
												<span>Drible Rodada</span>
											</th>
											<th
												className="py-3 px-3 sm:px-4 text-center cursor-pointer hover:text-main"
												onClick={() => handleSort('presenca_baba')}
											>
												<span>Jogos</span>
											</th>
										</>
									)}

									{activeTab === 'defesa' && (
										<>
											<th
												className="py-3 px-3 sm:px-4 text-center cursor-pointer hover:text-main"
												onClick={() => handleSort('clean_sheets')}
											>
												<div className="flex items-center justify-center gap-1">
													<span className="text-primary font-bold">🧤 Clean Sheets</span>
													{sortKey === 'clean_sheets' && (
														sortDir === 'desc' ? <ArrowDown size={12} /> : <ArrowUp size={12} />
													)}
												</div>
											</th>
											<th
												className="py-3 px-3 sm:px-4 text-center cursor-pointer hover:text-main"
												onClick={() => handleSort('premio_defesa')}
											>
												<span>Defesa Rodada</span>
											</th>
											<th
												className="py-3 px-3 sm:px-4 text-center cursor-pointer hover:text-main"
												onClick={() => handleSort('presenca_baba')}
											>
												<span>Jogos</span>
											</th>
										</>
									)}

									{activeTab === 'premios' && (
										<>
											<th
												className="py-3 px-3 sm:px-4 text-center cursor-pointer hover:text-main"
												onClick={() => handleSort('bola_cheia')}
											>
												<div className="flex items-center justify-center gap-1">
													<span>🌟 Bola Cheia</span>
													{sortKey === 'bola_cheia' && (
														sortDir === 'desc' ? <ArrowDown size={12} /> : <ArrowUp size={12} />
													)}
												</div>
											</th>
											<th
												className="py-3 px-3 sm:px-4 text-center cursor-pointer hover:text-main"
												onClick={() => handleSort('bola_murcha')}
											>
												<span>💩 Bola Murcha</span>
											</th>
											<th
												className="py-3 px-3 sm:px-4 text-center cursor-pointer hover:text-main"
												onClick={() => handleSort('roleta')}
											>
												<span>🎰 Roleta</span>
											</th>
											<th
												className="py-3 px-3 sm:px-4 text-center cursor-pointer hover:text-main"
												onClick={() => handleSort('pizza')}
											>
												<span>🍕 Pizza</span>
											</th>
										</>
									)}
								</tr>
							</thead>
							<tbody className="divide-y divide-border">
								{filteredRows.map((r, idx) => {
									const isLeader = idx === 0 && !search;
									const isTop3 = idx < 3 && !search;

									return (
										<tr
											key={r.player_id}
											className={`hover:bg-surface-hover/70 transition-colors ${
												isLeader ? 'bg-primary/5 font-medium' : ''
											}`}
										>
											<td className="py-3 px-3 sm:px-4 text-center font-bold">
												{idx === 0 ? (
													<span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-amber-500/20 text-amber-500 text-xs">
														1
													</span>
												) : idx === 1 ? (
													<span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-slate-300 dark:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs">
														2
													</span>
												) : idx === 2 ? (
													<span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-amber-800/20 text-amber-700 dark:text-amber-400 text-xs">
														3
													</span>
												) : (
													<span className="text-muted text-xs">{idx + 1}</span>
												)}
											</td>

											<td className="py-3 px-3 sm:px-4">
												<div className="flex items-center gap-2">
													<span className="font-semibold text-main">
														{r.boleiro}
													</span>
													{isLeader && (
														<span className="text-[10px] bg-amber-500/20 text-amber-600 dark:text-amber-400 font-bold px-1.5 py-0.2 rounded">
															LÍDER
														</span>
													)}
												</div>
											</td>

											<td className="py-3 px-3 sm:px-4 hidden sm:table-cell text-muted text-xs">
												{r.posicao || '—'}
											</td>

											{activeTab === 'geral' && (
												<>
													<td className="py-3 px-3 sm:px-4 text-center font-bold text-main">
														<span className="px-2 py-0.5 rounded-md bg-primary/10 text-primary font-bold">
															{r.ranking_geral}
														</span>
													</td>
													<td className="py-3 px-3 sm:px-4 text-center text-muted">
														{r.presenca_baba}
													</td>
													<td className="py-3 px-3 sm:px-4 text-center text-emerald-600 dark:text-emerald-400 font-semibold">
														{r.babas_conquistados}
													</td>
													<td className="py-3 px-3 sm:px-4 text-center text-muted">
														{r.empates}
													</td>
													<td className="py-3 px-3 sm:px-4 text-center text-rose-500">
														{r.babas_perdidos}
													</td>
													<td className="py-3 px-3 sm:px-4 text-center font-semibold text-main">
														{r.artilharia}
													</td>
													<td className="py-3 px-3 sm:px-4 text-center text-muted">
														{r.assistencias}
													</td>
												</>
											)}

											{activeTab === 'artilharia' && (
												<>
													<td className="py-3 px-3 sm:px-4 text-center font-bold text-main">
														<span className="text-base font-extrabold text-primary">
															{r.artilharia}
														</span>
													</td>
													<td className="py-3 px-3 sm:px-4 text-center text-muted">
														{r.premio_gol}
													</td>
													<td className="py-3 px-3 sm:px-4 text-center text-muted">
														{r.presenca_baba}
													</td>
												</>
											)}

											{activeTab === 'assistencias' && (
												<>
													<td className="py-3 px-3 sm:px-4 text-center font-bold text-main">
														<span className="text-base font-extrabold text-primary">
															{r.assistencias}
														</span>
													</td>
													<td className="py-3 px-3 sm:px-4 text-center text-muted">
														{r.premio_drible}
													</td>
													<td className="py-3 px-3 sm:px-4 text-center text-muted">
														{r.presenca_baba}
													</td>
												</>
											)}

											{activeTab === 'defesa' && (
												<>
													<td className="py-3 px-3 sm:px-4 text-center font-bold text-main">
														<span className="text-base font-extrabold text-emerald-600 dark:text-emerald-400">
															{r.clean_sheets}
														</span>
													</td>
													<td className="py-3 px-3 sm:px-4 text-center text-muted">
														{r.premio_defesa}
													</td>
													<td className="py-3 px-3 sm:px-4 text-center text-muted">
														{r.presenca_baba}
													</td>
												</>
											)}

											{activeTab === 'premios' && (
												<>
													<td className="py-3 px-3 sm:px-4 text-center font-bold text-amber-500">
														{r.bola_cheia}
													</td>
													<td className="py-3 px-3 sm:px-4 text-center text-slate-500">
														{r.bola_murcha}
													</td>
													<td className="py-3 px-3 sm:px-4 text-center text-purple-500 font-semibold">
														{r.roleta}
													</td>
													<td className="py-3 px-3 sm:px-4 text-center text-orange-500 font-semibold">
														{r.pizza}
													</td>
												</>
											)}
										</tr>
									);
								})}
							</tbody>
						</table>
					</div>
				)}
			</div>
		</div>
	);
}
