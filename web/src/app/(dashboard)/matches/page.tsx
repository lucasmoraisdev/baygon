'use client';

import { Button } from '@/components/Button';
import { FormField } from '@/components/FormField';
import { Input } from '@/components/Input';
import { Loading } from '@/components/Loading';
import { Modal } from '@/components/Modal';
import { Select } from '@/components/Select';
import { fetchAPI } from '@/lib/api';
import { DEFAULT_MATCH, DEFAULT_ROUND } from '@/utils/helpers';
import {
	useMutation,
	useQueries,
	useQuery,
	useQueryClient,
} from '@tanstack/react-query';
import Link from 'next/link';
import { useMemo, useState } from 'react';

export default function MatchesPage() {
	const queryClient = useQueryClient();

	const [selectedSeasonOverride, setSelectedSeasonOverride] = useState('');
	const [filters, setFilters] = useState({
		round_id: '',
		team_id: '',
		player_id: '',
	});
	const [isMatchModalOpen, setIsMatchModalOpen] = useState(false);
	const [isRoundModalOpen, setIsRoundModalOpen] = useState(false);
	const [newMatch, setNewMatch] = useState(DEFAULT_MATCH);
	const [newRound, setNewRound] = useState(DEFAULT_ROUND);

	const [seasonsQuery, currentSeasonQuery, teamsQuery, playersQuery] =
		useQueries({
			queries: [
				{ queryKey: ['seasons'], queryFn: () => fetchAPI('/seasons/') },
				{
					queryKey: ['seasons', 'current'],
					queryFn: async () => {
						try {
							return await fetchAPI('/seasons/current');
						} catch {
							return null;
						}
					},
				},
				{
					queryKey: ['teams'],
					queryFn: () => fetchAPI('/teams/').catch(() => []),
				},
				{
					queryKey: ['players'],
					queryFn: () => fetchAPI('/players/').catch(() => []),
				},
			],
		});

	const seasons: any[] = seasonsQuery.data ?? [];
	const allTeams: any[] = teamsQuery.data ?? [];
	const allPlayers: any[] = playersQuery.data ?? [];

	const selectedSeason =
		selectedSeasonOverride ||
		currentSeasonQuery.data?.id_season?.toString() ||
		seasons[0]?.id_season?.toString() ||
		'';

	const matchesQuery = useQuery({
		queryKey: ['matches', 'season', selectedSeason],
		queryFn: () => fetchAPI(`/matches/season/${selectedSeason}`),
		enabled: !!selectedSeason,
	});

	const roundsQuery = useQuery({
		queryKey: ['rounds', 'season', selectedSeason],
		queryFn: () => fetchAPI(`/rounds/season/${selectedSeason}`),
		enabled: !!selectedSeason,
	});

	const teamsForMatchQuery = useQuery({
		queryKey: ['teams', 'round', newMatch.round_id],
		queryFn: () => fetchAPI(`/teams/round/${newMatch.round_id}`),
		enabled: !!newMatch.round_id,
	});

	const matches: any[] = matchesQuery.data ?? [];
	const rounds: any[] = roundsQuery.data ?? [];
	const teamsForMatch: any[] = teamsForMatchQuery.data ?? [];

	const activeRound = useMemo(
		() => rounds.find((r) => !r.end_time),
		[rounds],
	);

	const nextRoundNumber = useMemo(() => {
		if (!rounds.length) return '1';
		return (Math.max(...rounds.map((r) => r.round_number)) + 1).toString();
	}, [rounds]);

	const filteredMatches = useMemo(() => {
		return matches.filter((m) => {
			const byRound = filters.round_id
				? m.round_id.toString() === filters.round_id
				: true;
			const byTeam = filters.team_id
				? m.home_team_id.toString() === filters.team_id ||
					m.away_team_id.toString() === filters.team_id
				: true;
			const byPlayer = filters.player_id
				? m.events?.some(
						(e: any) =>
							e.player_id.toString() === filters.player_id,
					)
				: true;
			return byRound && byTeam && byPlayer;
		});
	}, [matches, filters]);

	const getTeamName = (id: number) =>
		allTeams.find((t) => t.id_team === id)?.name ?? `Time ${id}`;

	const createMatchMutation = useMutation({
		mutationFn: (body: object) =>
			fetchAPI('/matches/', {
				method: 'POST',
				body: JSON.stringify(body),
			}),
		onSuccess: () => {
			queryClient.invalidateQueries({
				queryKey: ['matches', 'season', selectedSeason],
			});
			setIsMatchModalOpen(false);
			setNewMatch(DEFAULT_MATCH);
		},
		onError: () => alert('Erro ao criar partida.'),
	});

	const startRoundMutation = useMutation({
		mutationFn: (body: object) =>
			fetchAPI('/rounds/', {
				method: 'POST',
				body: JSON.stringify(body),
			}),
		onSuccess: () => {
			queryClient.invalidateQueries({
				queryKey: ['rounds', 'season', selectedSeason],
			});
			setIsRoundModalOpen(false);
			setNewRound(DEFAULT_ROUND);
		},
		onError: () => alert('Erro ao iniciar rodada.'),
	});

	const handleCreateMatch = (e: React.FormEvent) => {
		e.preventDefault();
		createMatchMutation.mutate({
			round_id: parseInt(newMatch.round_id),
			home_team_id: parseInt(newMatch.home_team_id),
			away_team_id: parseInt(newMatch.away_team_id),
			home_score: newMatch.home_score,
			away_score: newMatch.away_score,
		});
	};

	const handleStartRound = (e: React.FormEvent) => {
		e.preventDefault();
		startRoundMutation.mutate({
			round_number: parseInt(newRound.round_number),
			location: newRound.location,
			referee: newRound.referee,
			date: new Date(newRound.date).toISOString(),
			season_id: parseInt(selectedSeason),
			initial_time: new Date().toISOString(),
		});
	};

	const handleSeasonChange = (season: string) => {
		setSelectedSeasonOverride(season);
		setFilters({ round_id: '', team_id: '', player_id: '' });
	};

	const isLoading =
		seasonsQuery.isLoading ||
		currentSeasonQuery.isLoading ||
		teamsQuery.isLoading ||
		playersQuery.isLoading;

	if (isLoading) return <Loading />;

	return (
		<div className="flex flex-col gap-6 animate-slide-down">
			<div className="flex items-center justify-between flex-wrap gap-4">
				<div>
					<h1 className="text-3xl text-main">Central de Partidas</h1>
					<p className="text-sm text-muted mt-1">
						{activeRound
							? `Rodada ${activeRound.round_number} em andamento`
							: 'Nenhuma rodada ativa no momento'}
					</p>
				</div>
				<div className="flex items-center gap-3 flex-wrap">
					<Select
						value={selectedSeason}
						onChange={(e) => handleSeasonChange(e.target.value)}
						className="w-auto"
					>
						{seasons.map((s) => (
							<option key={s.id_season} value={s.id_season}>
								Temporada {s.number}{' '}
								{s.is_active ? '(Atual)' : ''}
							</option>
						))}
					</Select>
					{!activeRound && (
						<Button
							onClick={() => setIsRoundModalOpen(true)}
							className="w-auto"
						>
							▶ Iniciar Rodada
						</Button>
					)}
					<Button
						onClick={() => setIsMatchModalOpen(true)}
						className="w-auto"
					>
						+ Nova Partida
					</Button>
				</div>
			</div>

			<div className="grid grid-cols-[repeat(auto-fit,minmax(180px,1fr))] gap-3">
				<FormField label="Filtrar por Rodada">
					<Select
						value={filters.round_id}
						onChange={(e) =>
							setFilters({ ...filters, round_id: e.target.value })
						}
					>
						<option value="">Todas as Rodadas</option>
						{rounds.map((r) => (
							<option key={r.id_round} value={r.id_round}>
								Rodada {r.round_number} (
								{new Date(r.date).toLocaleDateString('pt-BR')})
							</option>
						))}
					</Select>
				</FormField>
				<FormField label="Filtrar por Time">
					<Select
						value={filters.team_id}
						onChange={(e) =>
							setFilters({ ...filters, team_id: e.target.value })
						}
					>
						<option value="">Todos os Times</option>
						{allTeams.map((t) => (
							<option key={t.id_team} value={t.id_team}>
								{t.name}
							</option>
						))}
					</Select>
				</FormField>
				<FormField label="Filtrar por Jogador">
					<Select
						value={filters.player_id}
						onChange={(e) =>
							setFilters({
								...filters,
								player_id: e.target.value,
							})
						}
					>
						<option value="">Todos os Jogadores</option>
						{allPlayers.map((p) => (
							<option key={p.id_player} value={p.id_player}>
								{p.nome}
							</option>
						))}
					</Select>
				</FormField>
			</div>

			{matchesQuery.isLoading ? (
				<Loading />
			) : filteredMatches.length === 0 ? (
				<div className="bg-surface border border-border rounded-xl p-10 text-center text-muted text-sm">
					Nenhuma partida encontrada com estes filtros.
				</div>
			) : (
				<div className="grid grid-cols-[repeat(auto-fill,minmax(280px,1fr))] gap-4">
					{filteredMatches.map((m) => (
						<Link
							href={`/matches/${m.id}`}
							key={m.id}
							className="bg-surface border border-border rounded-xl p-5 hover:border-primary transition-colors"
						>
							<div className="flex items-center justify-between gap-3 mb-3">
								<span className="text-sm font-semibold text-main flex-1 text-right">
									{getTeamName(m.home_team_id)}
								</span>
								<span className="text-xl font-bold text-primary shrink-0">
									{m.home_score} x {m.away_score}
								</span>
								<span className="text-sm font-semibold text-main flex-1">
									{getTeamName(m.away_team_id)}
								</span>
							</div>
							<div className="flex items-center justify-between text-xs text-muted">
								<span>
									#P{m.id} · Rodada {m.round_id}
								</span>
								<span className="text-primary">
									Ver Detalhes →
								</span>
							</div>
						</Link>
					))}
				</div>
			)}

			<Modal
				isOpen={isMatchModalOpen}
				onClose={() => setIsMatchModalOpen(false)}
				title="Nova Partida"
			>
				<form
					onSubmit={handleCreateMatch}
					className="flex flex-col gap-2"
				>
					<FormField label="Rodada">
						<Select
							value={newMatch.round_id}
							onChange={(e) =>
								setNewMatch({
									...newMatch,
									round_id: e.target.value,
									home_team_id: '',
									away_team_id: '',
								})
							}
							required
						>
							<option value="">Selecione a rodada</option>
							{rounds.map((r) => (
								<option key={r.id_round} value={r.id_round}>
									Rodada {r.round_number}
								</option>
							))}
						</Select>
					</FormField>
					<FormField label="Time da Casa">
						<Select
							value={newMatch.home_team_id}
							onChange={(e) =>
								setNewMatch({
									...newMatch,
									home_team_id: e.target.value,
								})
							}
							required
							disabled={!newMatch.round_id}
						>
							<option value="">Selecione o time</option>
							{teamsForMatch.map((t) => (
								<option key={t.id_team} value={t.id_team}>
									{t.name}
								</option>
							))}
						</Select>
					</FormField>
					<FormField label="Time Visitante">
						<Select
							value={newMatch.away_team_id}
							onChange={(e) =>
								setNewMatch({
									...newMatch,
									away_team_id: e.target.value,
								})
							}
							required
							disabled={!newMatch.round_id}
						>
							<option value="">Selecione o time</option>
							{teamsForMatch.map((t) => (
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

			<Modal
				isOpen={isRoundModalOpen}
				onClose={() => setIsRoundModalOpen(false)}
				title="Iniciar Nova Rodada"
			>
				<form
					onSubmit={handleStartRound}
					className="flex flex-col gap-2"
				>
					<FormField label="Número da Rodada">
						<Input
							type="number"
							value={newRound.round_number || nextRoundNumber}
							onChange={(e) =>
								setNewRound({
									...newRound,
									round_number: e.target.value,
								})
							}
							required
							placeholder="Ex: 1"
						/>
					</FormField>
					<FormField label="Local">
						<Input
							type="text"
							value={newRound.location}
							onChange={(e) =>
								setNewRound({
									...newRound,
									location: e.target.value,
								})
							}
							required
						/>
					</FormField>
					<FormField label="Árbitro">
						<Input
							type="text"
							value={newRound.referee}
							onChange={(e) =>
								setNewRound({
									...newRound,
									referee: e.target.value,
								})
							}
							required
						/>
					</FormField>
					<FormField label="Data">
						<Input
							type="date"
							value={newRound.date}
							onChange={(e) =>
								setNewRound({
									...newRound,
									date: e.target.value,
								})
							}
							required
						/>
					</FormField>
					<div className="flex gap-3 mt-2">
						<Button
							type="submit"
							disabled={startRoundMutation.isPending}
						>
							{startRoundMutation.isPending
								? 'Iniciando...'
								: 'Iniciar Rodada'}
						</Button>
						<Button
							type="button"
							variant="ghost"
							onClick={() => setIsRoundModalOpen(false)}
						>
							Cancelar
						</Button>
					</div>
				</form>
			</Modal>
		</div>
	);
}
