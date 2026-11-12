'use client';

import { Button } from '@/components/Button';
import { FormField } from '@/components/FormField';
import { Input } from '@/components/Input';
import { Loading } from '@/components/Loading';
import { Modal } from '@/components/Modal';
import { Select } from '@/components/Select';
import { useAuth } from '@/context/AuthContext';
import { fetchAPI } from '@/lib/api';
import { Player, Round, Team } from '@/types/types';
import { useMutation, useQueries, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useMemo, useState } from 'react';

export default function RoundDetail({ params }: { params: { id: string } }) {
	const router = useRouter();
	const queryClient = useQueryClient();
	const { user } = useAuth();
	const isAdmin = Boolean(user?.is_admin || user?.role === 'admin');

	const [isTeamModalOpen, setIsTeamModalOpen] = useState(false);
	const [isMatchModalOpen, setIsMatchModalOpen] = useState(false);
	const [isEditRoundOpen, setIsEditRoundOpen] = useState(false);
	const [editRoundDate, setEditRoundDate] = useState('');
	const [editRoundLocation, setEditRoundLocation] = useState('');
	const [editRoundReferee, setEditRoundReferee] = useState('');
	const [editRoundNumber, setEditRoundNumber] = useState('1');

	const [teamName, setTeamName] = useState('');
	const [selectedPlayerIds, setSelectedPlayerIds] = useState<Set<number>>(
		new Set(),
	);
	const [playerSearch, setPlayerSearch] = useState('');

	const [homeTeamId, setHomeTeamId] = useState('');
	const [awayTeamId, setAwayTeamId] = useState('');

	const [isDrawModalOpen, setIsDrawModalOpen] = useState(false);
	const [drawMode, setDrawMode] = useState<'draw' | 'manual'>('draw');
	const [numTeams, setNumTeams] = useState(4);
	const [drawSelectedIds, setDrawSelectedIds] = useState<Set<number>>(
		new Set(),
	);
	const [poteOverrides, setPoteOverrides] = useState<
		Record<number, number | null>
	>({});
	const [drawSearch, setDrawSearch] = useState('');
	const [draftTeams, setDraftTeams] = useState<
		Array<{ name: string; playerIds: number[] }>
	>([]);
	const [overwriteExisting, setOverwriteExisting] = useState(false);

	const [isAttendanceModalOpen, setIsAttendanceModalOpen] = useState(false);
	const [attendanceDraft, setAttendanceDraft] = useState<
		Record<number, 'confirmed' | 'waiting' | 'declined' | ''>
	>({});
	const [attendanceSearch, setAttendanceSearch] = useState('');

	const [roundQuery, teamsQuery, matchesQuery, playersQuery, attendanceQuery] =
		useQueries({
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
				{
					queryKey: ['players'],
					queryFn: () => fetchAPI('/players/').catch(() => []),
				},
				{
					queryKey: ['attendance', 'round', params.id],
					queryFn: () =>
						fetchAPI(`/attendance/round/${params.id}`).catch(() => ({
							round_id: parseInt(params.id, 10),
							confirmed_count: 0,
							declined_count: 0,
							waiting_count: 0,
							items: [],
						})),
				},
			],
		});

	const teams: Team[] = teamsQuery.data ?? [];
	const matches: any[] = matchesQuery.data ?? [];
	const allPlayers: Player[] = playersQuery.data ?? [];
	const attendance: {
		confirmed_count: number;
		declined_count: number;
		waiting_count: number;
		items: Array<{
			id_attendance: number;
			player_id: number;
			status: 'confirmed' | 'waiting' | 'declined';
			note?: string | null;
			player?: {
				id_player: number;
				nome: string;
				apelido?: string | null;
				potes?: number | null;
				is_guest?: boolean;
			} | null;
		}>;
	} = attendanceQuery.data ?? {
		confirmed_count: 0,
		declined_count: 0,
		waiting_count: 0,
		items: [],
	};

	const teamMap = useMemo(() => {
		const m = new Map<number, string>();
		for (const t of teams) m.set(t.id_team, t.name);
		return m;
	}, [teams]);

	const filteredPlayers = useMemo(() => {
		const q = playerSearch.toLowerCase().trim();
		if (!q) return allPlayers;
		return allPlayers.filter(
			(p) =>
				p.nome.toLowerCase().includes(q) ||
				p.apelido?.toLowerCase().includes(q),
		);
	}, [allPlayers, playerSearch]);

	const createTeamMutation = useMutation({
		mutationFn: (body: object) =>
			fetchAPI('/teams/', {
				method: 'POST',
				body: JSON.stringify(body),
			}),
		onSuccess: () => {
			queryClient.invalidateQueries({
				queryKey: ['teams', 'round', params.id],
			});
			queryClient.invalidateQueries({ queryKey: ['teams'] });
			setIsTeamModalOpen(false);
			setTeamName('');
			setSelectedPlayerIds(new Set());
			setPlayerSearch('');
		},
		onError: (err: Error) => alert(`Erro ao criar time: ${err.message}`),
	});

	const createMatchMutation = useMutation({
		mutationFn: (body: object) =>
			fetchAPI('/matches/', {
				method: 'POST',
				body: JSON.stringify(body),
			}),
		onSuccess: () => {
			queryClient.invalidateQueries({
				queryKey: ['matches', 'round', params.id],
			});
			queryClient.invalidateQueries({ queryKey: ['matches'] });
			setIsMatchModalOpen(false);
			setHomeTeamId('');
			setAwayTeamId('');
		},
		onError: (err: Error) =>
			alert(`Erro ao criar partida: ${err.message}`),
	});

	const calculateScoresMutation = useMutation({
		mutationFn: () =>
			fetchAPI(`/rules/round/${params.id}/calculate-scores`, {
				method: 'POST',
			}),
		onSuccess: (res: { players_scored: number }) => {
			queryClient.invalidateQueries({ queryKey: ['rankings'] });
			alert(
				`Pontuações calculadas para ${res.players_scored} jogador(es) com sucesso!`,
			);
		},
		onError: (err: Error) =>
			alert(`Erro ao calcular pontuações: ${err.message}`),
	});

	const drawPreviewMutation = useMutation({
		mutationFn: (body: {
			player_ids: number[];
			num_teams: number;
			pote_overrides: Record<number, number | null>;
		}) =>
			fetchAPI('/teams/draw-preview', {
				method: 'POST',
				body: JSON.stringify(body),
			}),
		onSuccess: (res: {
			teams: Array<{
				slot: number;
				name: string;
				players: Array<{ id_player: number }>;
			}>;
		}) => {
			setDraftTeams(
				res.teams.map((t) => ({
					name: t.name,
					playerIds: t.players.map((p) => p.id_player),
				})),
			);
		},
		onError: (err: Error) =>
			alert(`Erro ao sortear times: ${err.message}`),
	});

	const saveBatchTeamsMutation = useMutation({
		mutationFn: (body: {
			overwrite_existing: boolean;
			teams: Array<{ name: string; player_ids: number[] }>;
		}) =>
			fetchAPI(`/teams/round/${params.id}/batch`, {
				method: 'POST',
				body: JSON.stringify(body),
			}),
		onSuccess: () => {
			queryClient.invalidateQueries({
				queryKey: ['teams', 'round', params.id],
			});
			queryClient.invalidateQueries({ queryKey: ['teams'] });
			setIsDrawModalOpen(false);
		},
		onError: (err: Error) =>
			alert(`Erro ao salvar times: ${err.message}`),
	});

	const playerMap = useMemo(() => {
		const m = new Map<number, Player>();
		for (const p of allPlayers) m.set(p.id_player, p);
		return m;
	}, [allPlayers]);

	const filteredDrawPlayers = useMemo(() => {
		const q = drawSearch.toLowerCase().trim();
		if (!q) return allPlayers;
		return allPlayers.filter(
			(p) =>
				p.nome.toLowerCase().includes(q) ||
				p.apelido?.toLowerCase().includes(q),
		);
	}, [allPlayers, drawSearch]);

	const assignedPlayerIds = useMemo(() => {
		const s = new Set<number>();
		for (const t of draftTeams) {
			for (const pid of t.playerIds) s.add(pid);
		}
		return s;
	}, [draftTeams]);

	const unassignedPlayers = useMemo(() => {
		if (drawMode === 'manual') {
			return allPlayers.filter((p) => !assignedPlayerIds.has(p.id_player));
		}
		return allPlayers.filter(
			(p) =>
				drawSelectedIds.has(p.id_player) &&
				!assignedPlayerIds.has(p.id_player),
		);
	}, [allPlayers, assignedPlayerIds, drawMode, drawSelectedIds]);

	const myAttendanceMutation = useMutation({
		mutationFn: (status: 'confirmed' | 'waiting' | 'declined') =>
			fetchAPI(`/attendance/round/${params.id}/me`, {
				method: 'POST',
				body: JSON.stringify({ status }),
			}),
		onSuccess: () => {
			queryClient.invalidateQueries({
				queryKey: ['attendance', 'round', params.id],
			});
		},
		onError: (err: Error) =>
			alert(`Erro ao atualizar presença: ${err.message}`),
	});

	const adminAttendanceMutation = useMutation({
		mutationFn: (
			items: Array<{
				player_id: number;
				status: 'confirmed' | 'waiting' | 'declined';
			}>,
		) =>
			fetchAPI(`/attendance/round/${params.id}/batch`, {
				method: 'POST',
				body: JSON.stringify({ items }),
			}),
		onSuccess: () => {
			queryClient.invalidateQueries({
				queryKey: ['attendance', 'round', params.id],
			});
			setIsAttendanceModalOpen(false);
		},
		onError: (err: Error) =>
			alert(`Erro ao salvar lista de presença: ${err.message}`),
	});

	const removeAttendanceMutation = useMutation({
		mutationFn: (playerId: number) =>
			fetchAPI(`/attendance/round/${params.id}/player/${playerId}`, {
				method: 'DELETE',
			}),
		onSuccess: () => {
			queryClient.invalidateQueries({
				queryKey: ['attendance', 'round', params.id],
			});
		},
	});

	const openAttendanceModal = () => {
		const draft: Record<number, 'confirmed' | 'waiting' | 'declined' | ''> =
			{};
		for (const item of attendance.items) {
			draft[item.player_id] = item.status;
		}
		setAttendanceDraft(draft);
		setAttendanceSearch('');
		setIsAttendanceModalOpen(true);
	};

	const openDrawModal = () => {
		setDrawMode('draw');
		setDrawSearch('');
		setOverwriteExisting(teams.length > 0);
		if (teams.length > 0) {
			setNumTeams(Math.max(2, Math.min(6, teams.length)));
			setDraftTeams(
				teams.map((t) => ({
					name: t.name,
					playerIds: (t.players ?? []).map((p) => p.id_player),
				})),
			);
			const initialIds = new Set<number>();
			for (const t of teams) {
				for (const p of t.players ?? []) initialIds.add(p.id_player);
			}
			setDrawSelectedIds(initialIds);
		} else {
			setNumTeams(4);
			setDraftTeams([]);
			const confirmedIds = new Set<number>(
				attendance.items
					.filter((item) => item.status === 'confirmed')
					.map((item) => item.player_id),
			);
			setDrawSelectedIds(confirmedIds);
		}
		setPoteOverrides({});
		setIsDrawModalOpen(true);
	};

	const initManualTeams = (count: number) => {
		setDraftTeams(
			Array.from({ length: count }, (_, idx) => ({
				name: `Time ${idx + 1}`,
				playerIds: [],
			})),
		);
	};

	const handleRunDraw = () => {
		if (drawSelectedIds.size < numTeams) {
			alert(`Selecione pelo menos ${numTeams} jogadores para sortear.`);
			return;
		}
		drawPreviewMutation.mutate({
			player_ids: Array.from(drawSelectedIds),
			num_teams: numTeams,
			pote_overrides: poteOverrides,
		});
	};

	const movePlayerToTeam = (playerId: number, targetIndex: number) => {
		setDraftTeams((prev) =>
			prev.map((team, idx) => {
				const filtered = team.playerIds.filter((id) => id !== playerId);
				if (idx === targetIndex) {
					return { ...team, playerIds: [...filtered, playerId] };
				}
				return { ...team, playerIds: filtered };
			}),
		);
	};

	const removePlayerFromDraft = (playerId: number) => {
		setDraftTeams((prev) =>
			prev.map((team) => ({
				...team,
				playerIds: team.playerIds.filter((id) => id !== playerId),
			})),
		);
	};

	const togglePlayer = (id: number) => {
		setSelectedPlayerIds((prev) => {
			const next = new Set(prev);
			next.has(id) ? next.delete(id) : next.add(id);
			return next;
		});
	};

	const handleCreateTeam = (e: React.FormEvent) => {
		e.preventDefault();
		createTeamMutation.mutate({
			name: teamName.trim(),
			round_id: parseInt(params.id, 10),
			player_ids: Array.from(selectedPlayerIds),
		});
	};

	const handleCreateMatch = (e: React.FormEvent) => {
		e.preventDefault();
		if (homeTeamId === awayTeamId) {
			alert('Selecione dois times diferentes.');
			return;
		}
		createMatchMutation.mutate({
			round_id: parseInt(params.id, 10),
			home_team_id: parseInt(homeTeamId, 10),
			away_team_id: parseInt(awayTeamId, 10),
			score_home: 0,
			score_away: 0,
		});
	};

	const updateRoundMutation = useMutation({
		mutationFn: (body: object) =>
			fetchAPI(`/rounds/${params.id}`, {
				method: 'PUT',
				body: JSON.stringify(body),
			}),
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ['round', params.id] });
			queryClient.invalidateQueries({ queryKey: ['rounds'] });
			setIsEditRoundOpen(false);
		},
		onError: (err: Error) =>
			alert(`Erro ao atualizar rodada: ${err.message}`),
	});

	const deleteRoundMutation = useMutation({
		mutationFn: (seasonId: number) =>
			fetchAPI(`/rounds/${params.id}`, { method: 'DELETE' }).then(
				() => seasonId,
			),
		onSuccess: (seasonId: number) => {
			queryClient.invalidateQueries({ queryKey: ['rounds'] });
			router.push(seasonId ? `/seasons/${seasonId}` : '/seasons');
		},
		onError: (err: Error) =>
			alert(`Erro ao excluir rodada: ${err.message}`),
	});

	if (roundQuery.isLoading || teamsQuery.isLoading || matchesQuery.isLoading)
		return <Loading />;
	if (!roundQuery.data)
		return <div className="text-muted p-4">Rodada não encontrada.</div>;

	const round: Round = roundQuery.data;

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
						})}{' '}
						· {round.location} · Juiz: {round.referee}
					</p>
				</div>
				{isAdmin && (
					<div className="flex flex-wrap gap-3">
						<Button
							variant="ghost"
							onClick={() => calculateScoresMutation.mutate()}
							disabled={calculateScoresMutation.isPending}
							className="w-auto"
						>
							{calculateScoresMutation.isPending
								? 'Calculando...'
								: '⚡ Calcular Pontuações'}
						</Button>
						<Button
							variant="ghost"
							onClick={openDrawModal}
							className="w-auto"
						>
							🎲 Sortear / Montar Times
						</Button>
						<Button
							onClick={() => setIsTeamModalOpen(true)}
							className="w-auto"
						>
							+ Time
						</Button>
						<Button
							onClick={() => setIsMatchModalOpen(true)}
							disabled={teams.length < 2}
							className="w-auto"
						>
							+ Partida
						</Button>
						<Button
							variant="ghost"
							onClick={() => {
								setEditRoundNumber(String(round.round_number));
								setEditRoundDate(
									round.date
										? new Date(round.date).toISOString().slice(0, 10)
										: '',
								);
								setEditRoundLocation(round.location ?? '');
								setEditRoundReferee(round.referee ?? '');
								setIsEditRoundOpen(true);
							}}
							className="w-auto"
						>
							Editar Rodada
						</Button>
						<Button
							variant="danger"
							disabled={deleteRoundMutation.isPending}
							onClick={() => {
								if (
									window.confirm(
										`Tem certeza que deseja excluir a Rodada ${round.round_number}?`,
									)
								) {
									deleteRoundMutation.mutate(round.season_id);
								}
							}}
							className="w-auto"
						>
							{deleteRoundMutation.isPending
								? 'Excluindo...'
								: 'Excluir Rodada'}
						</Button>
					</div>
				)}
			</div>

			{/* Lista de Presença */}
			<div className="bg-surface border border-border rounded-xl p-5 flex flex-col gap-4">
				<div className="flex items-center justify-between flex-wrap gap-3">
					<div>
						<h3 className="text-base font-semibold text-main">
							📋 Lista de Presença
						</h3>
						<p className="text-xs text-muted mt-0.5">
							Confirmados:{' '}
							<strong className="text-green-400">
								{attendance.confirmed_count}
							</strong>{' '}
							· Lista de espera:{' '}
							<strong className="text-yellow-400">
								{attendance.waiting_count}
							</strong>{' '}
							· Não vão:{' '}
							<strong className="text-zinc-400">
								{attendance.declined_count}
							</strong>
						</p>
					</div>
					<div className="flex flex-wrap items-center gap-2">
						<Button
							size="sm"
							variant="ghost"
							disabled={myAttendanceMutation.isPending}
							onClick={() =>
								myAttendanceMutation.mutate('confirmed')
							}
							className="w-auto border-green-500/40 text-green-400 hover:bg-green-500/10"
						>
							✅ Vou jogar
						</Button>
						<Button
							size="sm"
							variant="ghost"
							disabled={myAttendanceMutation.isPending}
							onClick={() =>
								myAttendanceMutation.mutate('waiting')
							}
							className="w-auto border-yellow-500/40 text-yellow-400 hover:bg-yellow-500/10"
						>
							⏳ Espera
						</Button>
						<Button
							size="sm"
							variant="ghost"
							disabled={myAttendanceMutation.isPending}
							onClick={() =>
								myAttendanceMutation.mutate('declined')
							}
							className="w-auto border-red-500/40 text-red-400 hover:bg-red-500/10"
						>
							❌ Não vou
						</Button>
						{isAdmin && (
							<Button
								size="sm"
								onClick={openAttendanceModal}
								className="w-auto"
							>
								Gerenciar Lista
							</Button>
						)}
					</div>
				</div>

				{attendance.items.length === 0 ? (
					<p className="text-xs text-muted">
						Nenhuma resposta registrada ainda para esta rodada.
					</p>
				) : (
					<div className="flex flex-wrap gap-2">
						{attendance.items.map((item) => {
							const label =
								item.player?.apelido ||
								item.player?.nome ||
								`#${item.player_id}`;
							const badgeStyle =
								item.status === 'confirmed'
									? 'bg-green-500/15 border-green-500/30 text-green-300'
									: item.status === 'waiting'
										? 'bg-yellow-500/15 border-yellow-500/30 text-yellow-300'
										: 'bg-zinc-500/15 border-zinc-500/30 text-zinc-400 line-through';
							return (
								<div
									key={item.id_attendance}
									className={`flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full border ${badgeStyle}`}
								>
									<span>{label}</span>
									{item.player?.potes ? (
										<span className="opacity-75">
											P{item.player.potes}
										</span>
									) : null}
									{isAdmin && (
										<button
											type="button"
											onClick={() =>
												removeAttendanceMutation.mutate(
													item.player_id,
												)
											}
											className="ml-1 opacity-70 hover:opacity-100"
											title="Remover da lista"
										>
											×
										</button>
									)}
								</div>
							);
						})}
					</div>
				)}
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
									<span>{t.name}</span>
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
							matches.map((m) => {
								const matchId = m.id_match ?? m.id;
								const hScore = m.home_score ?? m.score_home ?? 0;
								const aScore = m.away_score ?? m.score_away ?? 0;
								return (
									<Link
										key={matchId}
										href={`/matches/${matchId}`}
										className="bg-surface border border-border rounded-xl p-4 flex items-center justify-between hover:border-primary transition-colors"
									>
										<span className="text-sm font-medium text-main">
											{teamMap.get(m.home_team_id) ??
												`Time #${m.home_team_id}`}{' '}
											vs{' '}
											{teamMap.get(m.away_team_id) ??
												`Time #${m.away_team_id}`}
										</span>
										<span className="text-lg font-bold text-primary">
											{hScore} x {aScore}
										</span>
									</Link>
								);
							})
						)}
					</div>
				</div>
			</div>

			{/* Modal Adicionar Time */}
			<Modal
				isOpen={isTeamModalOpen}
				onClose={() => setIsTeamModalOpen(false)}
				title="Novo Time na Rodada"
			>
				<form
					onSubmit={handleCreateTeam}
					className="flex flex-col gap-3"
				>
					<FormField label="Nome do Time">
						<Input
							value={teamName}
							onChange={(e) => setTeamName(e.target.value)}
							placeholder="Ex: Time 1 (DIEGO)"
							required
						/>
					</FormField>

					<FormField
						label={`Jogadores (${selectedPlayerIds.size} selecionados)`}
					>
						<Input
							value={playerSearch}
							onChange={(e) => setPlayerSearch(e.target.value)}
							placeholder="Filtrar jogador..."
							className="mb-2"
						/>
						<div className="max-h-48 overflow-y-auto border border-border rounded-md divide-y divide-border/50">
							{filteredPlayers.map((p) => (
								<label
									key={p.id_player}
									className="flex items-center gap-2 px-3 py-2 text-sm text-main hover:bg-white/5 cursor-pointer"
								>
									<input
										type="checkbox"
										checked={selectedPlayerIds.has(
											p.id_player,
										)}
										onChange={() =>
											togglePlayer(p.id_player)
										}
									/>
									<span>{p.apelido || p.nome}</span>
								</label>
							))}
						</div>
					</FormField>

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

			{/* Modal Nova Partida */}
			<Modal
				isOpen={isMatchModalOpen}
				onClose={() => setIsMatchModalOpen(false)}
				title="Nova Partida"
			>
				<form
					onSubmit={handleCreateMatch}
					className="flex flex-col gap-3"
				>
					<FormField label="Time da Casa">
						<Select
							value={homeTeamId}
							onChange={(e) => setHomeTeamId(e.target.value)}
							required
						>
							<option value="">Selecione...</option>
							{teams.map((t) => (
								<option key={t.id_team} value={t.id_team}>
									{t.name}
								</option>
							))}
						</Select>
					</FormField>
					<FormField label="Time Visitante">
						<Select
							value={awayTeamId}
							onChange={(e) => setAwayTeamId(e.target.value)}
							required
						>
							<option value="">Selecione...</option>
							{teams.map((t) => (
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

			{/* Modal: Sortear / Montar Times */}
			<Modal
				isOpen={isDrawModalOpen}
				onClose={() => setIsDrawModalOpen(false)}
				title="Sortear ou Montar Times da Rodada"
			>
				<div className="flex flex-col gap-4 max-h-[75vh] overflow-y-auto pr-1">
					{/* Modo */}
					<div className="flex gap-2">
						<button
							type="button"
							onClick={() => setDrawMode('draw')}
							className={`flex-1 py-2 px-3 rounded-lg text-xs font-medium border transition-colors ${
								drawMode === 'draw'
									? 'bg-primary/15 border-primary text-primary'
									: 'border-border text-muted hover:text-main'
							}`}
						>
							🎲 Sorteio por Potes (Sugestão)
						</button>
						<button
							type="button"
							onClick={() => {
								setDrawMode('manual');
								if (draftTeams.length === 0) {
									initManualTeams(numTeams);
								}
							}}
							className={`flex-1 py-2 px-3 rounded-lg text-xs font-medium border transition-colors ${
								drawMode === 'manual'
									? 'bg-primary/15 border-primary text-primary'
									: 'border-border text-muted hover:text-main'
							}`}
						>
							✍️ Informar Times Já Prontos
						</button>
					</div>

					{/* Configuração de quantidade de times */}
					<div className="flex items-end gap-3 flex-wrap">
						<div className="w-32">
							<FormField label="Qtd. de Times">
								<Select
									value={String(numTeams)}
									onChange={(e) => {
										const next = parseInt(e.target.value, 10);
										setNumTeams(next);
										if (drawMode === 'manual') {
											setDraftTeams((prev) => {
												if (prev.length === next) return prev;
												if (prev.length < next) {
													return [
														...prev,
														...Array.from(
															{ length: next - prev.length },
															(_, idx) => ({
																name: `Time ${prev.length + idx + 1}`,
																playerIds: [],
															}),
														),
													];
												}
												return prev.slice(0, next);
											});
										}
									}}
								>
									{[2, 3, 4, 5, 6].map((n) => (
										<option key={n} value={n}>
											{n} times
										</option>
									))}
								</Select>
							</FormField>
						</div>

						{drawMode === 'draw' && (
							<Button
								type="button"
								onClick={handleRunDraw}
								disabled={drawPreviewMutation.isPending}
								className="w-auto"
							>
								{drawPreviewMutation.isPending
									? 'Sorteando...'
									: draftTeams.length > 0
										? '🔄 Re-sortear'
										: '🎲 Sortear Times'}
							</Button>
						)}
					</div>

					{/* Seleção de jogadores + ajuste opcional de pote (modo Sorteio) */}
					{drawMode === 'draw' && (
						<div className="flex flex-col gap-2 border border-border rounded-xl p-3 bg-white/[0.02]">
							<div className="flex items-center justify-between gap-2 flex-wrap">
								<span className="text-xs font-medium text-main">
									Jogadores presentes ({drawSelectedIds.size}) — pote é apenas sugestão
								</span>
								<div className="flex gap-2">
									<button
										type="button"
										onClick={() =>
											setDrawSelectedIds(
												new Set(allPlayers.map((p) => p.id_player)),
											)
										}
										className="text-xs text-primary hover:underline"
									>
										Selecionar todos
									</button>
									<button
										type="button"
										onClick={() => setDrawSelectedIds(new Set())}
										className="text-xs text-muted hover:underline"
									>
										Limpar
									</button>
								</div>
							</div>
							<Input
								placeholder="Buscar jogador..."
								value={drawSearch}
								onChange={(e) => setDrawSearch(e.target.value)}
							/>
							<div className="max-h-44 overflow-y-auto divide-y divide-border border border-border rounded-lg">
								{filteredDrawPlayers.map((p) => {
									const checked = drawSelectedIds.has(p.id_player);
									const effectivePot =
										p.id_player in poteOverrides
											? poteOverrides[p.id_player]
											: p.potes ?? null;
									return (
										<div
											key={p.id_player}
											className="flex items-center justify-between gap-2 px-3 py-1.5 text-xs"
										>
											<label className="flex items-center gap-2 cursor-pointer flex-1 min-w-0">
												<input
													type="checkbox"
													checked={checked}
													onChange={() =>
														setDrawSelectedIds((prev) => {
															const next = new Set(prev);
															next.has(p.id_player)
																? next.delete(p.id_player)
																: next.add(p.id_player);
															return next;
														})
													}
												/>
												<span className="text-main truncate">
													{p.apelido || p.nome}
												</span>
											</label>
											{checked && (
												<select
													value={effectivePot ?? ''}
													onChange={(e) => {
														const val = e.target.value
															? parseInt(e.target.value, 10)
															: null;
														setPoteOverrides((prev) => ({
															...prev,
															[p.id_player]: val,
														}));
													}}
													className="bg-surface border border-border rounded px-1.5 py-0.5 text-xs text-main"
												>
													<option value="">Sem pote</option>
													{[1, 2, 3, 4, 5].map((pot) => (
														<option key={pot} value={pot}>
															Pote {pot}
														</option>
													))}
												</select>
											)}
										</div>
									);
								})}
							</div>
						</div>
					)}

					{/* Editor de Times (comum aos dois modos) */}
					{draftTeams.length > 0 && (
						<div className="flex flex-col gap-3">
							<span className="text-xs font-medium text-muted">
								Ajuste livremente os nomes e jogadores antes de confirmar:
							</span>
							<div className="grid grid-cols-1 md:grid-cols-2 gap-3">
								{draftTeams.map((team, tIdx) => (
									<div
										key={tIdx}
										className="border border-border rounded-xl p-3 bg-surface flex flex-col gap-2"
									>
										<Input
											value={team.name}
											onChange={(e) =>
												setDraftTeams((prev) =>
													prev.map((item, i) =>
														i === tIdx
															? { ...item, name: e.target.value }
															: item,
													),
												)
											}
											placeholder={`Time ${tIdx + 1}`}
										/>
										<div className="flex flex-col gap-1.5 min-h-[48px]">
											{team.playerIds.length === 0 ? (
												<span className="text-xs text-muted italic">
													Nenhum jogador neste time
												</span>
											) : (
												team.playerIds.map((pid) => {
													const p = playerMap.get(pid);
													if (!p) return null;
													const pot =
														pid in poteOverrides
															? poteOverrides[pid]
															: p.potes;
													return (
														<div
															key={pid}
															className="flex items-center justify-between gap-1 text-xs bg-white/5 rounded px-2 py-1"
														>
															<span className="truncate text-main">
																{p.apelido || p.nome}
																{pot ? (
																	<span className="text-muted ml-1">
																		(P{pot})
																	</span>
																) : null}
															</span>
															<div className="flex items-center gap-1 shrink-0">
																<select
																	aria-label="Mover para outro time"
																	value={String(tIdx)}
																	onChange={(e) =>
																		movePlayerToTeam(
																			pid,
																			parseInt(e.target.value, 10),
																		)
																	}
																	className="bg-surface border border-border rounded px-1 py-0.5 text-[11px] text-muted"
																>
																	{draftTeams.map((dest, dIdx) => (
																		<option key={dIdx} value={dIdx}>
																			{dest.name || `Time ${dIdx + 1}`}
																		</option>
																	))}
																</select>
																<button
																	type="button"
																	onClick={() => removePlayerFromDraft(pid)}
																	className="text-muted hover:text-red-400 px-1"
																	title="Remover do time"
																>
																	×
																</button>
															</div>
														</div>
													);
												})
											)}
										</div>
									</div>
								))}
							</div>
						</div>
					)}

					{/* Jogadores disponíveis para adicionar manualmente */}
					{draftTeams.length > 0 && unassignedPlayers.length > 0 && (
						<div className="border border-border rounded-xl p-3 flex flex-col gap-2">
							<span className="text-xs font-medium text-main">
								Disponíveis para alocar ({unassignedPlayers.length})
							</span>
							<div className="max-h-36 overflow-y-auto flex flex-wrap gap-1.5">
								{unassignedPlayers.map((p) => (
									<div
										key={p.id_player}
										className="flex items-center gap-1 text-xs border border-border rounded-lg px-2 py-1 bg-surface"
									>
										<span className="text-main">
											{p.apelido || p.nome}
										</span>
										<select
											value=""
											onChange={(e) => {
												if (e.target.value !== '') {
													movePlayerToTeam(
														p.id_player,
														parseInt(e.target.value, 10),
													);
												}
											}}
											className="bg-transparent border border-border rounded px-1 py-0.5 text-[11px] text-primary"
										>
											<option value="">+ Time</option>
											{draftTeams.map((t, idx) => (
												<option key={idx} value={idx}>
													{t.name || `Time ${idx + 1}`}
												</option>
											))}
										</select>
									</div>
								))}
							</div>
						</div>
					)}

					{teams.length > 0 && (
						<label className="flex items-center gap-2 text-xs text-muted cursor-pointer">
							<input
								type="checkbox"
								checked={overwriteExisting}
								onChange={(e) => setOverwriteExisting(e.target.checked)}
							/>
							Substituir os {teams.length} time(s) já cadastrados nesta rodada
						</label>
					)}

					<div className="flex gap-3 pt-1">
						<Button
							type="button"
							disabled={
								draftTeams.length === 0 || saveBatchTeamsMutation.isPending
							}
							onClick={() =>
								saveBatchTeamsMutation.mutate({
									overwrite_existing: overwriteExisting,
									teams: draftTeams.map((t, idx) => ({
										name: t.name.trim() || `Time ${idx + 1}`,
										player_ids: t.playerIds,
									})),
								})
							}
						>
							{saveBatchTeamsMutation.isPending
								? 'Salvando...'
								: 'Confirmar Times na Rodada'}
						</Button>
						<Button
							type="button"
							variant="ghost"
							onClick={() => setIsDrawModalOpen(false)}
						>
							Cancelar
						</Button>
					</div>
				</div>
			</Modal>

			{/* Modal: Editar Rodada */}
			<Modal
				isOpen={isEditRoundOpen}
				onClose={() => setIsEditRoundOpen(false)}
				title={`Editar Rodada ${round.round_number}`}
			>
				<form
					onSubmit={(e) => {
						e.preventDefault();
						updateRoundMutation.mutate({
							round_number: parseInt(editRoundNumber, 10) || round.round_number,
							date: editRoundDate
								? new Date(`${editRoundDate}T12:00:00`).toISOString()
								: undefined,
							location: editRoundLocation.trim(),
							referee: editRoundReferee.trim(),
						});
					}}
					className="flex flex-col gap-3"
				>
					<FormField label="Número da Rodada">
						<Input
							type="number"
							min={1}
							value={editRoundNumber}
							onChange={(e) => setEditRoundNumber(e.target.value)}
							required
						/>
					</FormField>
					<FormField label="Data">
						<Input
							type="date"
							value={editRoundDate}
							onChange={(e) => setEditRoundDate(e.target.value)}
							required
						/>
					</FormField>
					<FormField label="Local">
						<Input
							value={editRoundLocation}
							onChange={(e) => setEditRoundLocation(e.target.value)}
							required
						/>
					</FormField>
					<FormField label="Juiz">
						<Input
							value={editRoundReferee}
							onChange={(e) => setEditRoundReferee(e.target.value)}
							required
						/>
					</FormField>
					<div className="flex gap-3 mt-2">
						<Button
							type="submit"
							disabled={updateRoundMutation.isPending}
						>
							{updateRoundMutation.isPending
								? 'Salvando...'
								: 'Salvar Alterações'}
						</Button>
						<Button
							type="button"
							variant="ghost"
							onClick={() => setIsEditRoundOpen(false)}
						>
							Cancelar
						</Button>
					</div>
				</form>
			</Modal>

			{/* Modal: Gerenciar Lista de Presença (Admin) */}
			<Modal
				isOpen={isAttendanceModalOpen}
				onClose={() => setIsAttendanceModalOpen(false)}
				title="Gerenciar Lista de Presença"
			>
				<div className="flex flex-col gap-3">
					<Input
						placeholder="Buscar jogador..."
						value={attendanceSearch}
						onChange={(e) => setAttendanceSearch(e.target.value)}
					/>
					<div className="max-h-72 overflow-y-auto border border-border rounded-lg divide-y divide-border">
						{allPlayers
							.filter((p) => {
								const q = attendanceSearch.toLowerCase().trim();
								if (!q) return true;
								return (
									p.nome.toLowerCase().includes(q) ||
									(p.apelido ?? '').toLowerCase().includes(q)
								);
							})
							.map((p) => {
								const current =
									attendanceDraft[p.id_player] ?? '';
								return (
									<div
										key={p.id_player}
										className="flex items-center justify-between gap-2 px-3 py-2 text-xs"
									>
										<span className="text-main truncate">
											{p.apelido || p.nome}
										</span>
										<select
											value={current}
											onChange={(e) =>
												setAttendanceDraft((prev) => ({
													...prev,
													[p.id_player]: e.target
														.value as
														| 'confirmed'
														| 'waiting'
														| 'declined'
														| '',
												}))
											}
											className="bg-surface border border-border rounded px-2 py-1 text-xs text-main"
										>
											<option value="">Sem resposta</option>
											<option value="confirmed">
												Confirmado
											</option>
											<option value="waiting">
												Lista de espera
											</option>
											<option value="declined">
												Não vai
											</option>
										</select>
									</div>
								);
							})}
					</div>
					<div className="flex gap-3 mt-1">
						<Button
							type="button"
							disabled={adminAttendanceMutation.isPending}
							onClick={() => {
								const items = Object.entries(attendanceDraft)
									.filter(([, st]) => st !== '')
									.map(([pid, st]) => ({
										player_id: parseInt(pid, 10),
										status: st as
											| 'confirmed'
											| 'waiting'
											| 'declined',
									}));
								if (items.length === 0) {
									alert(
										'Marque ao menos um jogador antes de salvar.',
									);
									return;
								}
								adminAttendanceMutation.mutate(items);
							}}
						>
							{adminAttendanceMutation.isPending
								? 'Salvando...'
								: 'Salvar Lista'}
						</Button>
						<Button
							type="button"
							variant="ghost"
							onClick={() => setIsAttendanceModalOpen(false)}
						>
							Cancelar
						</Button>
					</div>
				</div>
			</Modal>
		</div>
	);
}
