'use client';

import { RankingTable, type RankingEntry } from '@/components/RankingTable';
import { StatsCard } from '@/components/StatsCard';
import { useAuth } from '@/context/AuthContext';
import { fetchAPI } from '@/lib/api';
import { useQueries } from '@tanstack/react-query';

export default function DashboardPage() {
	const { user } = useAuth();

	const [rankingsQuery, playersQuery, matchesQuery] = useQueries({
		queries: [
			{ queryKey: ['rankings'], queryFn: () => fetchAPI('/rankings/') },
			{ queryKey: ['players'], queryFn: () => fetchAPI('/players/') },
			{ queryKey: ['matches'], queryFn: () => fetchAPI('/matches/') },
		],
	});

	const isLoading =
		rankingsQuery.isLoading ||
		playersQuery.isLoading ||
		matchesQuery.isLoading;
	const isError =
		rankingsQuery.isError || playersQuery.isError || matchesQuery.isError;

	if (isLoading)
		return (
			<div style={{ color: 'var(--text-muted)' }}>
				Carregando dashboard...
			</div>
		);
	if (isError)
		return (
			<div style={{ color: 'var(--text-muted)' }}>
				Erro ao carregar dados.
			</div>
		);

	const rankings: RankingEntry[] = rankingsQuery.data ?? [];
	const players: unknown[] = playersQuery.data ?? [];
	const matches: unknown[] = matchesQuery.data ?? [];

	return (
		<div className="flex flex-col gap-8 animate-slide-down">
			<div>
				<h1 className="text-3xl text-main">Olá, {user?.username} 👋</h1>
				<p className="text-lg text-main">
					Aqui está o resumo do desempenho no Baygon.
				</p>
			</div>

			<div className="grid grid-cols-[repeat(auto-fit,minmax(240px,1fr))] gap-6">
				<StatsCard title="Jogadores Ativos" value={players.length} />
				<StatsCard title="Partidas Realizadas" value={matches.length} />
			</div>

			<div className="bg-surface border border-border rounded-xl p-6">
				<div className="mb-6">
					<h2 className="text-xl">🔥 Top Ranking Global</h2>
				</div>
				<RankingTable data={rankings} />
			</div>
		</div>
	);
}
