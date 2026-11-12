'use client';

import { Button } from '@/components/Button';
import { FormField } from '@/components/FormField';
import { Loading } from '@/components/Loading';
import { Select } from '@/components/Select';
import { fetchAPI } from '@/lib/api';
import { useMutation, useQueries, useQueryClient } from '@tanstack/react-query';
import { Trash2 } from 'lucide-react';
import Link from 'next/link';
import { useMemo, useState } from 'react';

interface TeamPlayer {
	id_player: number;
	nome: string;
	apelido?: string | null;
}

interface TeamDetail {
	id_team: number;
	name: string;
	round_id: number;
	players?: TeamPlayer[];
}

interface MatchEventItem {
	id_event: number;
	id_match_event?: number;
	match_id: number;
	player_id: number;
	event_type: string;
	play_id?: number | null;
}

const EVENT_LABELS: Record<string, string> = {
	gol: '⚽ Gol',
	assistencia: '🎯 Assistência',
	gol_contra: '🚫 Gol Contra',
	cartao_amarelo: '🟨 Cartão Amarelo',
	cartao_vermelho: '🟥 Cartão Vermelho',
	ouro: '🟦 Ouro',
};

export default function LiveMatch({ params }: { params: { id: string } }) {
	const queryClient = useQueryClient();

	const [homeScorerId, setHomeScorerId] = useState<string>('');
	const [homeAssistId, setHomeAssistId] = useState<string>('');
	const [awayScorerId, setAwayScorerId] = useState<string>('');
	const [awayAssistId, setAwayAssistId] = useState<string>('');

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

	const [homeTeamQuery, awayTeamQuery] = useQueries({
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
		],
	});

	const allPlayers: TeamPlayer[] = playersQuery.data ?? [];
	const homeTeam: TeamDetail | undefined = homeTeamQuery.data;
	const awayTeam: TeamDetail | undefined = awayTeamQuery.data;
	const events: MatchEventItem[] = eventsQuery.data ?? [];

	const playerMap = useMemo(() => {
		const map = new Map<number, TeamPlayer>();
		for (const p of allPlayers) map.set(p.id_player, p);
		for (const p of homeTeam?.players ?? []) map.set(p.id_player, p);
		for (const p of awayTeam?.players ?? []) map.set(p.id_player, p);
		return map;
	}, [allPlayers, homeTeam, awayTeam]);

	const homePlayerIds = useMemo(
		() => new Set((homeTeam?.players ?? []).map((p) => p.id_player)),
		[homeTeam],
	);
	const awayPlayerIds = useMemo(
		() => new Set((awayTeam?.players ?? []).map((p) => p.id_player)),
		[awayTeam],
	);

	const nextPlayId = useMemo(() => {
		const ids = events.map((e) => e.play_id ?? 0);
		return (ids.length ? Math.max(...ids) : 0) + 1;
	}, [events]);

	const invalidateMatch = () => {
		queryClient.invalidateQueries({ queryKey: ['match', params.id] });
		queryClient.invalidateQueries({
			queryKey: ['events', 'match', params.id],
		});
	};

	const eventMutation = useMutation({
		mutationFn: async ({
			type,
			teamSide,
			playerId,
			assistPlayerId,
		}: {
			type: 'gol' | 'gol_contra' | 'cartao_amarelo' | 'cartao_vermelho' | 'ouro';
			teamSide: 'home' | 'away';
			playerId: number;
			assistPlayerId?: number;
		}) => {
			const playId = type === 'gol' ? nextPlayId : undefined;
			await fetchAPI('/events/', {
				method: 'POST',
				body: JSON.stringify({
					match_id: parseInt(params.id, 10),
					event_type: type,
					player_id: playerId,
					play_id: playId ?? null,
				}),
			});

			if (type === 'gol' && assistPlayerId && assistPlayerId !== playerId) {
				await fetchAPI('/events/', {
					method: 'POST',
					body: JSON.stringify({
						match_id: parseInt(params.id, 10),
						event_type: 'assistencia',
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
		onSuccess: () => {
			invalidateMatch();
			setHomeScorerId('');
			setHomeAssistId('');
			setAwayScorerId('');
			setAwayAssistId('');
		},
		onError: (err: Error) => {
			alert(`Erro ao registrar evento: ${err.message}`);
		},
	});

	const deleteEventMutation = useMutation({
		mutationFn: async (evt: MatchEventItem) => {
			const eventId = evt.id_event ?? evt.id_match_event;
			await fetchAPI(`/events/${eventId}`, { method: 'DELETE' });

			// Ajustar placar se for gol ou gol contra
			if (evt.event_type === 'gol' || evt.event_type === 'gol_contra') {
				const currentHome = match.home_score ?? match.score_home ?? 0;
				const currentAway = match.away_score ?? match.score_away ?? 0;
				const isHomePlayer = homePlayerIds.has(evt.player_id);
				const isAwayPlayer = awayPlayerIds.has(evt.player_id);

				let decrementHome = false;
				if (evt.event_type === 'gol' && isHomePlayer) {
					decrementHome = true;
				} else if (evt.event_type === 'gol_contra' && isAwayPlayer) {
					decrementHome = true;
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
		onSuccess: invalidateMatch,
		onError: (err: Error) => {
			alert(`Erro ao remover evento: ${err.message}`);
		},
	});

	if (matchQuery.isLoading && !match) return <Loading />;
	if (!match)
		return <div className="text-muted p-4">Partida não encontrada.</div>;

	const homeScore = match.home_score ?? match.score_home ?? 0;
	const awayScore = match.away_score ?? match.score_away ?? 0;

	const renderTeamPanel = ({
		side,
		team,
		teamId,
		score,
		scorerId,
		setScorerId,
		assistId,
		setAssistId,
	}: {
		side: 'home' | 'away';
		team?: TeamDetail;
		teamId: number;
		score: number;
		scorerId: string;
		setScorerId: (v: string) => void;
		assistId: string;
		setAssistId: (v: string) => void;
	}) => {
		const roster = team?.players && team.players.length > 0 ? team.players : allPlayers;
		const parsedScorer = parseInt(scorerId, 10);
		const parsedAssist = assistId ? parseInt(assistId, 10) : undefined;

		return (
			<div className="flex-1 flex flex-col items-center gap-4 min-w-64">
				<h2 className="text-lg font-semibold text-main">
					{team?.name ?? `Time #${teamId}`}
				</h2>
				<div className="text-6xl font-bold text-primary">{score}</div>

				<div className="w-full flex flex-col gap-2">
					<FormField label="Jogador">
						<Select
							value={scorerId}
							onChange={(e) => setScorerId(e.target.value)}
						>
							<option value="">Selecione o jogador...</option>
							{roster.map((p) => (
								<option key={p.id_player} value={p.id_player}>
									{p.apelido || p.nome}
								</option>
							))}
							{team?.players && team.players.length > 0 && (
								<optgroup label="Outros jogadores (Extra)">
									{allPlayers
										.filter(
											(p) =>
												!team.players?.some(
													(tp) =>
														tp.id_player ===
														p.id_player,
												),
										)
										.map((p) => (
											<option
												key={p.id_player}
												value={p.id_player}
											>
												{p.apelido || p.nome}
											</option>
										))}
								</optgroup>
							)}
						</Select>
					</FormField>

					<FormField label="Assistência (opcional, para Gol)">
						<Select
							value={assistId}
							onChange={(e) => setAssistId(e.target.value)}
						>
							<option value="">Sem assistência</option>
							{roster
								.filter((p) => p.id_player !== parsedScorer)
								.map((p) => (
									<option
										key={p.id_player}
										value={p.id_player}
									>
										{p.apelido || p.nome}
									</option>
								))}
						</Select>
					</FormField>
				</div>

				<div className="flex flex-col gap-2 w-full">
					<Button
						onClick={() =>
							eventMutation.mutate({
								type: 'gol',
								teamSide: side,
								playerId: parsedScorer,
								assistPlayerId: parsedAssist,
							})
						}
						disabled={!scorerId || eventMutation.isPending}
						className="bg-green-600 hover:bg-green-700 border-0"
					>
						⚽ Registrar Gol
					</Button>

					<div className="grid grid-cols-2 gap-2">
						<Button
							variant="ghost"
							size="sm"
							onClick={() =>
								eventMutation.mutate({
									type: 'cartao_amarelo',
									teamSide: side,
									playerId: parsedScorer,
								})
							}
							disabled={!scorerId || eventMutation.isPending}
							className="border-yellow-500/50 text-yellow-400 hover:bg-yellow-500/10"
						>
							🟨 Amarelo
						</Button>
						<Button
							variant="danger"
							size="sm"
							onClick={() =>
								eventMutation.mutate({
									type: 'cartao_vermelho',
									teamSide: side,
									playerId: parsedScorer,
								})
							}
							disabled={!scorerId || eventMutation.isPending}
						>
							🟥 Vermelho
						</Button>
					</div>

					<div className="grid grid-cols-2 gap-2">
						<Button
							variant="ghost"
							size="sm"
							onClick={() =>
								eventMutation.mutate({
									type: 'ouro',
									teamSide: side,
									playerId: parsedScorer,
								})
							}
							disabled={!scorerId || eventMutation.isPending}
							className="border-blue-500/50 text-blue-400 hover:bg-blue-500/10"
						>
							🟦 Ouro
						</Button>
						<Button
							variant="ghost"
							size="sm"
							onClick={() =>
								eventMutation.mutate({
									type: 'gol_contra',
									teamSide: side,
									playerId: parsedScorer,
								})
							}
							disabled={!scorerId || eventMutation.isPending}
						>
							🚫 Gol Contra
						</Button>
					</div>
				</div>
			</div>
		);
	};

	return (
		<div className="flex flex-col gap-6 animate-slide-down">
			<div className="flex items-center justify-between flex-wrap gap-3">
				<div>
					<h1 className="text-3xl text-main">Cobertura ao Vivo</h1>
					<Link
						href={`/rounds/${match.round_id}`}
						className="text-xs text-primary hover:underline"
					>
						← Voltar para Rodada #{match.round_id}
					</Link>
				</div>
				<div className="flex items-center gap-2">
					<span className="w-2.5 h-2.5 rounded-full bg-green-400 animate-pulse" />
					<span className="text-sm text-muted font-semibold">
						Partida #{match.id_match ?? match.id}
					</span>
				</div>
			</div>

			<div className="bg-surface border border-border rounded-xl p-6 md:p-8 flex flex-col md:flex-row items-stretch gap-8">
				{renderTeamPanel({
					side: 'home',
					team: homeTeam,
					teamId: match.home_team_id,
					score: homeScore,
					scorerId: homeScorerId,
					setScorerId: setHomeScorerId,
					assistId: homeAssistId,
					setAssistId: setHomeAssistId,
				})}

				<div className="text-2xl font-bold text-muted self-center">
					VS
				</div>

				{renderTeamPanel({
					side: 'away',
					team: awayTeam,
					teamId: match.away_team_id,
					score: awayScore,
					scorerId: awayScorerId,
					setScorerId: setAwayScorerId,
					assistId: awayAssistId,
					setAssistId: setAwayAssistId,
				})}
			</div>

			<div className="bg-surface border border-border rounded-xl p-6">
				<h3 className="text-base font-semibold mb-4 text-main">
					Timeline da Partida ({events.length})
				</h3>
				{events.length === 0 ? (
					<p className="text-sm text-muted">
						Nenhum evento registrado ainda.
					</p>
				) : (
					<div className="flex flex-col divide-y divide-border">
						{events.map((evt, idx) => {
							const p = playerMap.get(evt.player_id);
							const playerLabel = p
								? p.apelido || p.nome
								: `Jogador #${evt.player_id}`;
							return (
								<div
									key={evt.id_event ?? evt.id_match_event ?? idx}
									className="flex items-center justify-between py-2.5 gap-3"
								>
									<div className="flex items-center gap-3">
										<span className="text-sm font-medium text-main">
											{EVENT_LABELS[evt.event_type] ??
												evt.event_type}
										</span>
										<span className="text-xs text-muted">
											{playerLabel}
											{evt.play_id
												? ` · Lance #${evt.play_id}`
												: ''}
										</span>
									</div>
									<button
										type="button"
										onClick={() =>
											deleteEventMutation.mutate(evt)
										}
										disabled={deleteEventMutation.isPending}
										className="p-1.5 text-red-400 hover:bg-red-500/10 rounded cursor-pointer"
										title="Remover evento"
									>
										<Trash2 className="w-4 h-4" />
									</button>
								</div>
							);
						})}
					</div>
				)}
			</div>
		</div>
	);
}
