'use client';

import { Button } from '@/components/Button';
import { Loading } from '@/components/Loading';
import { fetchAPI } from '@/lib/api';
import { Match, Round, Team } from '@/types/types';
import { useQueries } from '@tanstack/react-query';
import Link from 'next/link';

export default function RoundDetail({ params }: { params: { id: string } }) {
	const [roundQuery, teamsQuery, matchesQuery] = useQueries({
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
		],
	});

	if (roundQuery.isLoading || teamsQuery.isLoading || matchesQuery.isLoading)
		return <Loading />;
	if (!roundQuery.data)
		return <div className="text-muted p-4">Rodada não encontrada.</div>;

	const round: Round = roundQuery.data;
	const teams: Team[] = teamsQuery.data ?? [];
	const matches: Match[] = matchesQuery.data ?? [];

	return (
		<div className="flex flex-col gap-6 animate-slide-down">
			<div className="flex items-center justify-between flex-wrap gap-4">
				<div>
					<h1 className="text-3xl text-main">
						Rodada {round.round_number}
					</h1>
					<p className="text-sm text-muted mt-1">
						{new Date(round.date).toLocaleDateString('pt-BR', {
							weekday: 'long',
							day: '2-digit',
							month: 'long',
							year: 'numeric',
						})}
					</p>
				</div>
				<div className="flex gap-3">
					<Button
						onClick={() => alert('Adicionar Time')}
						className="w-auto"
					>
						+ Time
					</Button>
					<Button
						onClick={() => alert('Nova Partida')}
						className="w-auto"
					>
						+ Partida
					</Button>
				</div>
			</div>

			<div className="flex gap-5 flex-wrap items-start">
				{/* Times */}
				<div className="flex-1 min-w-64">
					<h3 className="text-base font-semibold mb-3">
						Times Participantes ({teams.length})
					</h3>
					<div className="bg-surface border border-border rounded-xl divide-y divide-border">
						{teams.length === 0 ? (
							<p className="text-sm text-muted p-4">
								Nenhum time registrado.
							</p>
						) : (
							teams.map((t) => (
								<Link
									key={t.id_team}
									href={`/teams/${t.id_team}`}
									className="flex items-center justify-between px-4 py-3 hover:bg-white/5 transition-colors text-sm text-main"
								>
									{t.name}
									<span className="text-xs text-primary">
										→
									</span>
								</Link>
							))
						)}
					</div>
				</div>

				{/* Partidas */}
				<div className="flex-2 min-w-80">
					<h3 className="text-base font-semibold mb-3">
						Partidas ({matches.length})
					</h3>
					<div className="flex flex-col gap-3">
						{matches.length === 0 ? (
							<p className="text-sm text-muted">
								Nenhuma partida criada.
							</p>
						) : (
							matches.map((m) => (
								<Link
									key={m.id_match}
									href={`/matches/${m.id_match}`}
									className="bg-surface border border-border rounded-xl p-4 flex items-center justify-between hover:border-primary transition-colors"
								>
									<span className="text-sm font-medium text-main">
										T{m.home_team_id} vs T{m.away_team_id}
									</span>
									<span className="text-lg font-bold text-primary">
										{m.home_score} x {m.away_score}
									</span>
								</Link>
							))
						)}
					</div>
				</div>
			</div>
		</div>
	);
}
