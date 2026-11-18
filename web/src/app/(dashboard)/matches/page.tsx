'use client';

import { Button } from '@/components/Button';
import { FormField } from '@/components/FormField';
import { Input } from '@/components/Input';
import { Loading } from '@/components/Loading';
import { Modal } from '@/components/Modal';
import { Select } from '@/components/Select';
import { SeasonSelector } from '@/components/SeasonSelector';
import { SearchableSelect } from '@/components/SearchableSelect';
import { TeamColorTag } from '@/components/TeamColorTag';
import { Plus, Play } from 'lucide-react';
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

	const matchOrderMap = useMemo(() => {
		const map = new Map<number, number>();
		const countersByRound = new Map<number, number>();
		const sortedAsc = [...matches].sort(
			(a, b) => (a.id ?? a.id_match ?? 0) - (b.id ?? b.id_match ?? 0),
		);
		for (const m of sortedAsc) {
			const matchId = m.id ?? m.id_match;
			const nextNum = (countersByRound.get(m.round_id) ?? 0) + 1;
			countersByRound.set(m.round_id, nextNum);
			map.set(matchId, nextNum);
		}
		return map;
	}, [matches]);

	const filteredMatches = useMemo(() => {
		return [...matches]
			.sort((a, b) => {
				if (b.round_id !== a.round_id) return b.round_id - a.round_id;
				return (a.id ?? a.id_match ?? 0) - (b.id ?? b.id_match ?? 0);
			})
			.filter((m) => {
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

	const roundOptions = useMemo(() => {
		return rounds.map((r) => ({
			value: r.id_round.toString(),
			label: `Rodada ${r.round_number}`,
			sublabel: new Date(r.date).toLocaleDateString('pt-BR'),
			badge: !r.end_time ? 'Ativa' : undefined,
			badgeVariant: (!r.end_time ? 'success' : 'default') as 'success' | 'default',
		}));
	}, [rounds]);

	const teamOptions = useMemo(() => {
		return allTeams.map((t) => ({
			value: t.id_team.toString(),
			label: t.name,
			sublabel: t.color ? `Cor: ${t.color}` : undefined,
		}));
	}, [allTeams]);

	const playerOptions = useMemo(() => {
		return allPlayers.map((p) => ({
			value: p.id_player.toString(),
			label: p.apelido ? `${p.apelido} (${p.nome})` : p.nome,
			sublabel: p.posicao ? `Posição: ${p.posicao}` : undefined,
		}));
	}, [allPlayers]);

	const getTeamName = (id: number) =>
		allTeams.find((t) => t.id_team === id)?.name ?? `Time ${id}`;

	const getTeamColor = (id: number) =>
		allTeams.find((t) => t.id_team === id)?.color ?? null;

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
			{/* Top Header */}
			<div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
				<div>
					<h1 className="text-2xl sm:text-3xl font-bold text-main">Central de Partidas</h1>
					<p className="text-xs sm:text-sm text-muted mt-0.5">
						{activeRound
							? `Rodada ${activeRound.round_number} em andamento`
							: 'Nenhuma rodada ativa no momento'}
					</p>
				</div>
				<div className="flex items-center gap-3 flex-wrap">
					<SeasonSelector
						seasons={seasons}
						selectedSeasonId={selectedSeason}
						onSelectSeason={(s) =>
							handleSeasonChange(s.id_season.toString())
						}
					/>
					{!activeRound && (
						<Button
							variant="ghost"
							onClick={() => setIsRoundModalOpen(true)}
							className="!w-auto flex items-center gap-1.5 px-3.5 py-2 text-sm self-start sm:self-auto"
						>
							<Play className="w-4 h-4" />
							<span>Iniciar Rodada</span>
						</Button>
					)}
					<Button
						onClick={() => setIsMatchModalOpen(true)}
						className="!w-auto flex items-center gap-1.5 px-3.5 py-2 text-sm self-start sm:self-auto"
					>
						<Plus className="w-4 h-4" />
						<span>Nova Partida</span>
					</Button>
				</div>
			</div>

			{/* Barra de Filtros */}
			<div className="bg-surface border border-border rounded-xl p-3 sm:px-4 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
				<div className="grid grid-cols-1 sm:grid-cols-3 gap-3 flex-1">
					<SearchableSelect
						label="Rodada"
						placeholder="Todas as Rodadas"
						allOptionLabel={`Todas as Rodadas (${rounds.length})`}
						showAllOption
						searchPlaceholder="Buscar rodada..."
						options={roundOptions}
						value={filters.round_id}
						onChange={(val) =>
							setFilters({ ...filters, round_id: val })
						}
					/>

					<SearchableSelect
						label="Time"
						placeholder="Todos os Times"
						allOptionLabel={`Todos os Times (${allTeams.length})`}
						showAllOption
						searchPlaceholder="Buscar time..."
						options={teamOptions}
						value={filters.team_id}
						onChange={(val) =>
							setFilters({ ...filters, team_id: val })
						}
					/>

					<SearchableSelect
						label="Jogador"
						placeholder="Todos os Jogadores"
						allOptionLabel={`Todos os Jogadores (${allPlayers.length})`}
						showAllOption
						searchPlaceholder="Buscar jogador..."
						options={playerOptions}
						value={filters.player_id}
						onChange={(val) =>
							setFilters({ ...filters, player_id: val })
						}
					/>
				</div>

				<div className="flex items-center justify-between lg:justify-end gap-3 pt-2 lg:pt-0 border-t lg:border-t-0 border-border/40 text-xs sm:text-sm text-muted">
					{(filters.round_id || filters.team_id || filters.player_id) && (
						<button
							type="button"
							onClick={() =>
								setFilters({ round_id: '', team_id: '', player_id: '' })
							}
							className="text-xs text-primary hover:underline font-medium cursor-pointer"
						>
							Limpar filtros
						</button>
					)}
					<span>
						<strong className="text-main font-semibold">{filteredMatches.length}</strong> partidas encontradas
					</span>
				</div>
			</div>

			{matchesQuery.isLoading ? (
				<Loading />
			) : filteredMatches.length === 0 ? (
				<div className="bg-surface border border-border rounded-xl p-10 text-center text-muted text-sm">
					Nenhuma partida encontrada com estes filtros.
				</div>
			) : (
				<div className="grid grid-cols-[repeat(auto-fill,minmax(280px,1fr))] gap-4">
					{filteredMatches.map((m, index) => (
						<Link
							href={`/matches/${m.id}`}
							key={m.id}
							className="bg-surface border border-border rounded-xl p-5 hover:border-primary transition-colors"
						>
							<div className="flex items-center justify-between gap-2.5 mb-3">
								<div className="flex items-center justify-end gap-1.5 flex-1 min-w-0 text-right">
									<TeamColorTag
										color={getTeamColor(m.home_team_id)}
										size="sm"
										showLabel={true}
									/>
									<span className="text-sm font-semibold text-main truncate">
										{getTeamName(m.home_team_id)}
									</span>
								</div>
								<span className="text-lg sm:text-xl font-bold text-primary shrink-0 px-2 py-0.5 rounded-lg bg-background border border-border">
									{m.home_score} x {m.away_score}
								</span>
								<div className="flex items-center justify-start gap-1.5 flex-1 min-w-0 text-left">
									<span className="text-sm font-semibold text-main truncate">
										{getTeamName(m.away_team_id)}
									</span>
									<TeamColorTag
										color={getTeamColor(m.away_team_id)}
										size="sm"
										showLabel={true}
									/>
								</div>
							</div>
							<div className="flex items-center justify-between text-xs text-muted">
								<span>
									#P{matchOrderMap.get(m.id ?? m.id_match) ?? index + 1} · Rodada {m.round_id}
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
