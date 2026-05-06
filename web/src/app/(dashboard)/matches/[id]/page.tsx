'use client';

import { Button } from '@/components/Button';
import { Loading } from '@/components/Loading';
import { fetchAPI } from '@/lib/api';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

export default function LiveMatch({ params }: { params: { id: string } }) {
	const queryClient = useQueryClient();

	const matchQuery = useQuery({
		queryKey: ['match', params.id],
		queryFn: () => fetchAPI(`/matches/${params.id}`),
		refetchInterval: 5000,
	});

	const eventsQuery = useQuery({
		queryKey: ['events', 'match', params.id],
		queryFn: () => fetchAPI(`/events/match/${params.id}`),
		refetchInterval: 5000,
	});

	const eventMutation = useMutation({
		mutationFn: async ({
			type,
			teamId,
		}: {
			type: string;
			teamId: number;
		}) => {
			const playerId = Math.floor(Math.random() * 10) + 1;
			await fetchAPI('/events/', {
				method: 'POST',
				body: JSON.stringify({
					match_id: parseInt(params.id),
					event_type: type,
					player_id: playerId,
				}),
			});
			if (type === 'GOL') {
				const match = matchQuery.data;
				const updates =
					teamId === match.home_team_id
						? { home_score: match.home_score + 1 }
						: { away_score: match.away_score + 1 };
				await fetchAPI(`/matches/${params.id}`, {
					method: 'PUT',
					body: JSON.stringify(updates),
				});
			}
		},
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ['match', params.id] });
			queryClient.invalidateQueries({
				queryKey: ['events', 'match', params.id],
			});
		},
	});

	if (matchQuery.isLoading && !matchQuery.data) return <Loading />;
	if (!matchQuery.data)
		return <div className="text-muted p-4">Partida não encontrada.</div>;

	const match = matchQuery.data;
	const events: any[] = eventsQuery.data ?? [];

	const TeamPanel = ({
		teamId,
		score,
	}: {
		teamId: number;
		score: number;
	}) => (
		<div className="flex-1 flex flex-col items-center gap-4">
			<h2 className="text-lg font-semibold text-main">Time {teamId}</h2>
			<div className="text-6xl font-bold text-primary">{score}</div>
			<div className="flex flex-col gap-2 w-full">
				<Button
					onClick={() =>
						eventMutation.mutate({ type: 'GOL', teamId })
					}
					disabled={eventMutation.isPending}
					className="bg-green-600 hover:bg-green-700 border-0"
				>
					⚽ Gol
				</Button>
				<Button
					variant="ghost"
					onClick={() =>
						eventMutation.mutate({ type: 'CARTAO_AMARELO', teamId })
					}
					disabled={eventMutation.isPending}
					className="border-yellow-500/50 text-yellow-400 hover:bg-yellow-500/10"
				>
					🟨 Amarelo
				</Button>
				<Button
					variant="danger"
					onClick={() =>
						eventMutation.mutate({
							type: 'CARTAO_VERMELHO',
							teamId,
						})
					}
					disabled={eventMutation.isPending}
				>
					🟥 Vermelho
				</Button>
			</div>
		</div>
	);

	return (
		<div className="flex flex-col gap-6 animate-slide-down">
			<div className="flex items-center justify-between">
				<h1 className="text-3xl text-main">Cobertura ao Vivo</h1>
				<div className="flex items-center gap-2">
					<span className="w-2.5 h-2.5 rounded-full bg-green-400 animate-pulse" />
					<span className="text-sm text-muted font-semibold">
						Em andamento
					</span>
				</div>
			</div>
			<div className="bg-surface border border-border rounded-xl p-8 flex items-start gap-8">
				<TeamPanel
					teamId={match.home_team_id}
					score={match.home_score}
				/>
				<div className="text-2xl font-bold text-muted self-center">
					VS
				</div>
				<TeamPanel
					teamId={match.away_team_id}
					score={match.away_score}
				/>
			</div>

			<div className="bg-surface border border-border rounded-xl p-6">
				<h3 className="text-base font-semibold mb-4">
					Timeline da Partida ({events.length})
				</h3>
				{events.length === 0 ? (
					<p className="text-sm text-muted">
						Nenhum evento registrado ainda.
					</p>
				) : (
					<div className="flex flex-col divide-y divide-border">
						{events.map((evt, idx) => (
							<div
								key={evt.id_match_event ?? idx}
								className="flex items-center justify-between py-2"
							>
								<span className="text-sm font-medium text-main">
									{evt.event_type}
								</span>
								<span className="text-xs text-muted">
									Jogador #{evt.player_id}
								</span>
							</div>
						))}
					</div>
				)}
			</div>
		</div>
	);
}
