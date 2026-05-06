'use client';

import { Button } from '@/components/Button';
import { FormField } from '@/components/FormField';
import { Input } from '@/components/Input';
import { Loading } from '@/components/Loading';
import { Modal } from '@/components/Modal';
import { Select } from '@/components/Select';
import { useAuth } from '@/context/AuthContext';
import { fetchAPI } from '@/lib/api';
import {
	useMutation,
	useQueries,
	useQuery,
	useQueryClient,
} from '@tanstack/react-query';
import Link from 'next/link';
import { useMemo, useState } from 'react';

export default function TeamsPage() {
	const { user } = useAuth();
	const isAdmin = user?.role === 'admin';
	const queryClient = useQueryClient();

	const [selectedSeasonOverride, setSelectedSeasonOverride] = useState('');
	const [filterRoundId, setFilterRoundId] = useState('');
	const [isRoundModalOpen, setIsRoundModalOpen] = useState(false);
	const [isTeamModalOpen, setIsTeamModalOpen] = useState(false);

	const [newRound, setNewRound] = useState({
		round_number: '',
		location: 'Campo Principal',
		referee: 'A definir',
		date: new Date().toISOString().split('T')[0],
	});

	const [newTeam, setNewTeam] = useState<{
		name: string;
		round_id: string;
		player_ids: string[];
	}>({
		name: '',
		round_id: '',
		player_ids: ['', '', '', '', ''],
	});

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

	const roundsQuery = useQuery({
		queryKey: ['rounds', 'season', selectedSeason],
		queryFn: () => fetchAPI(`/rounds/season/${selectedSeason}`),
		enabled: !!selectedSeason,
	});

	const rounds: any[] = roundsQuery.data ?? [];

	const activeRound = useMemo(
		() => rounds.find((r) => !r.end_time),
		[rounds],
	);

	const filteredTeams = useMemo(() => {
		return allTeams.filter((team) => {
			if (filterRoundId)
				return team.round_id.toString() === filterRoundId;
			return rounds.some((r) => r.id_round === team.round_id);
		});
	}, [allTeams, filterRoundId, rounds]);

	const currentRoundTeams = useMemo(() => {
		if (!activeRound) return [];
		return allTeams.filter((t) => t.round_id === activeRound.id_round);
	}, [allTeams, activeRound]);

	const getRoundDisplay = (roundId: number) => {
		const r = rounds.find((rd) => rd.id_round === roundId);
		return r ? `Rodada ${r.round_number}` : `Rodada ID: ${roundId}`;
	};

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
		},
	});

	const createTeamMutation = useMutation({
		mutationFn: (body: object) =>
			fetchAPI('/teams/', { method: 'POST', body: JSON.stringify(body) }),
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ['teams'] });
			setIsTeamModalOpen(false);
			setNewTeam({
				name: '',
				round_id: activeRound?.id_round?.toString() ?? '',
				player_ids: ['', '', '', '', ''],
			});
		},
	});

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

	const handleCreateTeam = (e: React.FormEvent) => {
		e.preventDefault();
		const pIds = newTeam.player_ids
			.filter((id) => id !== '')
			.map((id) => parseInt(id));
		createTeamMutation.mutate({
			name: newTeam.name,
			round_id: parseInt(newTeam.round_id),
			player_ids: pIds,
		});
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
					<h1 className="text-3xl text-main">Times</h1>
					<p className="text-sm text-muted mt-1">
						Gerencie os times de cada rodada
					</p>
				</div>
				<div className="flex items-center gap-3">
					<Select
						value={selectedSeason}
						onChange={(e) =>
							setSelectedSeasonOverride(e.target.value)
						}
						className="w-auto"
					>
						{seasons.map((s) => (
							<option key={s.id_season} value={s.id_season}>
								Temporada {s.number}{' '}
								{s.is_active ? '(Atual)' : ''}
							</option>
						))}
					</Select>
					{isAdmin && (
						<Button
							onClick={() => setIsTeamModalOpen(true)}
							className="w-auto"
						>
							+ Novo Time
						</Button>
					)}
				</div>
			</div>

			<Select
				value={filterRoundId}
				onChange={(e) => setFilterRoundId(e.target.value)}
			>
				<option value="">Toda a Temporada</option>
				{rounds.map((r) => (
					<option key={r.id_round} value={r.id_round}>
						Rodada {r.round_number} (
						{new Date(r.date).toLocaleDateString('pt-BR')}){' '}
						{!r.end_time ? '[Ativa]' : ''}
					</option>
				))}
			</Select>

			{!activeRound ? (
				<div className="bg-surface border border-border rounded-xl p-6 flex flex-col items-center gap-3 text-center">
					<h3 className="text-lg font-semibold">
						Nenhuma Rodada Ativa
					</h3>
					<p className="text-muted text-sm">
						Para interagir com os times desta semana, inicie uma
						nova rodada.
					</p>
					{isAdmin && (
						<Button
							onClick={() => setIsRoundModalOpen(true)}
							className="w-auto"
						>
							▶ Iniciar Nova Rodada
						</Button>
					)}
				</div>
			) : currentRoundTeams.length === 0 &&
			  filterRoundId === activeRound.id_round.toString() ? (
				<div className="bg-surface border border-border rounded-xl p-6 flex flex-col items-center gap-3 text-center">
					<h3 className="text-lg font-semibold">
						Nenhum time cadastrado ainda
					</h3>
					<p className="text-muted text-sm">
						A rodada {activeRound.round_number} está em andamento,
						mas não há times cadastrados.
					</p>
					{isAdmin && (
						<Button
							onClick={() => {
								setNewTeam((prev) => ({
									...prev,
									round_id: activeRound.id_round.toString(),
								}));
								setIsTeamModalOpen(true);
							}}
							className="w-auto"
						>
							+ Cadastrar Novo Time
						</Button>
					)}
				</div>
			) : null}

			<div className="grid grid-cols-[repeat(auto-fill,minmax(240px,1fr))] gap-4">
				{filteredTeams.map((team) => (
					<Link
						href={`/teams/${team.id_team}`}
						key={team.id_team}
						className="bg-surface border border-border rounded-xl p-5 hover:border-primary transition-colors"
					>
						<div className="flex items-center justify-between mb-2">
							<span className="font-semibold text-main">
								{team.name}
							</span>
							<span>⚽</span>
						</div>
						<div className="flex items-center justify-between text-sm text-muted">
							<span>{getRoundDisplay(team.round_id)}</span>
							<span className="text-primary">Detalhes →</span>
						</div>
					</Link>
				))}
			</div>

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
							value={newRound.round_number}
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

			<Modal
				isOpen={isTeamModalOpen}
				onClose={() => setIsTeamModalOpen(false)}
				title="Cadastrar Novo Time"
			>
				<form
					onSubmit={handleCreateTeam}
					className="flex flex-col gap-2"
				>
					<FormField label="Nome do Time">
						<Input
							type="text"
							value={newTeam.name}
							onChange={(e) =>
								setNewTeam({ ...newTeam, name: e.target.value })
							}
							required
							placeholder="Ex: Time Azul"
						/>
					</FormField>
					<FormField label="Rodada Alvo">
						<Select
							value={newTeam.round_id}
							onChange={(e) =>
								setNewTeam({
									...newTeam,
									round_id: e.target.value,
								})
							}
							required
						>
							<option value="">Selecione uma Rodada</option>
							{rounds.map((r) => (
								<option key={r.id_round} value={r.id_round}>
									Rodada {r.round_number}{' '}
									{!r.end_time ? '[Ativa]' : ''}
								</option>
							))}
						</Select>
					</FormField>
					{[0, 1, 2, 3, 4].map((index) => (
						<FormField key={index} label={`Pote ${index + 1}`}>
							<Select
								value={newTeam.player_ids[index]}
								onChange={(e) => {
									const newIds = [...newTeam.player_ids];
									newIds[index] = e.target.value;
									setNewTeam({
										...newTeam,
										player_ids: newIds,
									});
								}}
								required
							>
								<option value="">Selecione o jogador...</option>
								{allPlayers.map((p) => (
									<option
										key={p.id_player}
										value={p.id_player}
									>
										{p.nome}{' '}
										{p.potes
											? `(Pote Origem: ${p.potes})`
											: ''}
									</option>
								))}
							</Select>
						</FormField>
					))}
					<div className="flex gap-3 mt-2">
						<Button
							type="submit"
							disabled={createTeamMutation.isPending}
						>
							{createTeamMutation.isPending
								? 'Criando...'
								: 'Criar Time'}
						</Button>
						<Button
							type="button"
							variant="ghost"
							onClick={() => setIsTeamModalOpen(false)}
						>
							Cancelar
						</Button>
					</div>
				</form>
			</Modal>
		</div>
	);
}
