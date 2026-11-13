'use client';

import { Button } from '@/components/Button';
import { FormField } from '@/components/FormField';
import { Input } from '@/components/Input';
import { Loading } from '@/components/Loading';
import { Modal } from '@/components/Modal';
import { useAuth } from '@/context/AuthContext';
import { fetchAPI } from '@/lib/api';
import { Player } from '@/types/types';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useMemo, useState } from 'react';

interface TeamPlayerItem {
	id_player: number;
	nome: string;
	apelido?: string | null;
	potes?: number | null;
	posicao?: string | null;
}

interface TeamDetail {
	id_team: number;
	name: string;
	round_id: number;
	players: TeamPlayerItem[];
	awards: { id_award: number; event_type: string }[];
}

export default function TeamDetailPage({ params }: { params: { id: string } }) {
	const router = useRouter();
	const queryClient = useQueryClient();
	const { user } = useAuth();
	const isAdmin = Boolean(user?.is_admin || user?.role === 'admin');

	const [isEditOpen, setIsEditOpen] = useState(false);
	const [editName, setEditName] = useState('');
	const [editPlayerIds, setEditPlayerIds] = useState<Set<number>>(new Set());
	const [playerSearch, setPlayerSearch] = useState('');

	const teamQuery = useQuery<TeamDetail>({
		queryKey: ['team', params.id],
		queryFn: () => fetchAPI(`/teams/${params.id}`),
	});

	const roundId = teamQuery.data?.round_id;

	const roundTeamsQuery = useQuery<TeamDetail[]>({
		queryKey: ['teams', 'round', String(roundId ?? '')],
		queryFn: () =>
			fetchAPI(`/teams/round/${roundId}`).catch(() => []),
		enabled: Boolean(roundId),
	});

	const playersQuery = useQuery<Player[]>({
		queryKey: ['players'],
		queryFn: () => fetchAPI('/players/').catch(() => []),
		enabled: isAdmin && isEditOpen,
	});

	const otherTeamByPlayerId = useMemo(() => {
		const m = new Map<number, { id_team: number; name: string }>();
		const currentTeamId = teamQuery.data?.id_team;
		for (const t of roundTeamsQuery.data ?? []) {
			if (t.id_team === currentTeamId) continue;
			for (const p of t.players ?? []) {
				m.set(p.id_player, { id_team: t.id_team, name: t.name });
			}
		}
		return m;
	}, [roundTeamsQuery.data, teamQuery.data?.id_team]);

	const allPlayers = playersQuery.data ?? [];
	const filteredPlayers = useMemo(() => {
		const q = playerSearch.toLowerCase().trim();
		const base = !q
			? allPlayers
			: allPlayers.filter(
					(p) =>
						p.nome.toLowerCase().includes(q) ||
						(p.apelido ?? '').toLowerCase().includes(q),
				);
		return [...base].sort((a, b) => {
			const aAssigned = otherTeamByPlayerId.has(a.id_player) ? 1 : 0;
			const bAssigned = otherTeamByPlayerId.has(b.id_player) ? 1 : 0;
			if (aAssigned !== bAssigned) return aAssigned - bAssigned;
			return (a.apelido || a.nome).localeCompare(
				b.apelido || b.nome,
				'pt-BR',
			);
		});
	}, [allPlayers, playerSearch, otherTeamByPlayerId]);

	const updateTeamMutation = useMutation({
		mutationFn: (body: { name: string; player_ids: number[] }) =>
			fetchAPI(`/teams/${params.id}`, {
				method: 'PUT',
				body: JSON.stringify(body),
			}),
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ['team', params.id] });
			queryClient.invalidateQueries({ queryKey: ['teams'] });
			if (roundId) {
				queryClient.invalidateQueries({
					queryKey: ['teams', 'round', String(roundId)],
				});
			}
			setIsEditOpen(false);
		},
		onError: (err: Error) =>
			alert(`Erro ao atualizar time: ${err.message}`),
	});

	const deleteTeamMutation = useMutation({
		mutationFn: (rId: number) =>
			fetchAPI(`/teams/${params.id}`, { method: 'DELETE' }).then(
				() => rId,
			),
		onSuccess: (rId: number) => {
			queryClient.invalidateQueries({ queryKey: ['teams'] });
			queryClient.invalidateQueries({
				queryKey: ['teams', 'round', String(rId)],
			});
			router.push(`/rounds/${rId}`);
		},
		onError: (err: Error) =>
			alert(`Erro ao excluir time: ${err.message}`),
	});

	if (teamQuery.isLoading) return <Loading />;
	if (!teamQuery.data)
		return <div className="text-muted p-4">Time não encontrado.</div>;

	const team = teamQuery.data;

	const openEditModal = () => {
		setEditName(team.name);
		setEditPlayerIds(
			new Set((team.players ?? []).map((p) => p.id_player)),
		);
		setPlayerSearch('');
		setIsEditOpen(true);
	};

	const handleRemovePlayerFromTeam = (playerId: number, playerName: string) => {
		if (
			!window.confirm(
				`Remover "${playerName}" do time "${team.name}"?`,
			)
		) {
			return;
		}
		const remainingIds = (team.players ?? [])
			.filter((p) => p.id_player !== playerId)
			.map((p) => p.id_player);
		updateTeamMutation.mutate({
			name: team.name,
			player_ids: remainingIds,
		});
	};

	return (
		<div className="flex flex-col gap-6 animate-slide-down">
			<div className="flex items-center justify-between flex-wrap gap-3">
				<div>
					<h1 className="text-3xl text-main">{team.name}</h1>
					<Link
						href={`/rounds/${team.round_id}`}
						className="text-xs text-primary hover:underline"
					>
						← Voltar para Rodada #{team.round_id}
					</Link>
				</div>
				<div className="flex items-center gap-2 flex-wrap">
					{team.awards?.length > 0 && (
						<div className="flex gap-2 flex-wrap">
							{team.awards.map((aw) => (
								<span
									key={aw.id_award}
									className="text-xs font-semibold px-3 py-1 rounded-full bg-yellow-500/15 text-yellow-300 border border-yellow-500/30"
								>
									🏆 {aw.event_type}
								</span>
							))}
						</div>
					)}
					{isAdmin && (
						<>
							<Button
								variant="ghost"
								onClick={openEditModal}
								className="w-auto"
							>
								Editar Time
							</Button>
							<Button
								variant="danger"
								disabled={deleteTeamMutation.isPending}
								onClick={() => {
									if (
										window.confirm(
											`Tem certeza que deseja excluir o time "${team.name}"?`,
										)
									) {
										deleteTeamMutation.mutate(team.round_id);
									}
								}}
								className="w-auto"
							>
								{deleteTeamMutation.isPending
									? 'Excluindo...'
									: 'Excluir Time'}
							</Button>
						</>
					)}
				</div>
			</div>

			<div className="bg-surface border border-border rounded-xl p-6">
				<h2 className="text-base font-semibold text-main mb-4">
					Jogadores ({team.players?.length ?? 0})
				</h2>
				{!team.players || team.players.length === 0 ? (
					<p className="text-sm text-muted">
						Nenhum jogador vinculado a este time.
					</p>
				) : (
					<div className="divide-y divide-border">
						{team.players.map((p) => (
							<div
								key={p.id_player}
								className="flex items-center justify-between py-3 px-2 hover:bg-white/5 rounded transition-colors gap-3"
							>
								<Link
									href={`/players/${p.id_player}`}
									className="flex-1 min-w-0"
								>
									<span className="text-sm font-medium text-main hover:text-primary transition-colors">
										{p.apelido || p.nome}
									</span>
									{p.apelido && p.apelido !== p.nome && (
										<span className="text-xs text-muted ml-2">
											({p.nome})
										</span>
									)}
								</Link>
								<div className="flex items-center gap-3 text-xs text-muted shrink-0">
									{p.potes && (
										<span className="px-2 py-0.5 rounded bg-primary/10 text-primary font-semibold">
											Pote {p.potes}
										</span>
									)}
									{p.posicao && (
										<span className="uppercase">
											{p.posicao}
										</span>
									)}
									{isAdmin && (
										<button
											type="button"
											disabled={updateTeamMutation.isPending}
											onClick={() =>
												handleRemovePlayerFromTeam(
													p.id_player,
													p.apelido || p.nome,
												)
											}
											className="px-2 py-1 rounded border border-red-500/30 bg-red-500/10 text-red-400 hover:bg-red-500/20 text-[11px] font-medium transition-colors cursor-pointer"
											title="Remover jogador deste time"
										>
											Remover
										</button>
									)}
								</div>
							</div>
						))}
					</div>
				)}
			</div>

			<Modal
				isOpen={isEditOpen}
				onClose={() => setIsEditOpen(false)}
				title="Editar Time"
			>
				<form
					onSubmit={(e) => {
						e.preventDefault();
						updateTeamMutation.mutate({
							name: editName.trim(),
							player_ids: Array.from(editPlayerIds),
						});
					}}
					className="flex flex-col gap-3"
				>
					<FormField label="Nome do Time">
						<Input
							value={editName}
							onChange={(e) => setEditName(e.target.value)}
							required
							placeholder="Ex: Time Azul"
						/>
					</FormField>
					<FormField label={`Jogadores (${editPlayerIds.size} selecionados)`}>
						<div className="flex flex-col gap-2">
							<Input
								placeholder="Buscar jogador..."
								value={playerSearch}
								onChange={(e) => setPlayerSearch(e.target.value)}
							/>
							{otherTeamByPlayerId.size > 0 && (
								<p className="text-[11px] text-[#94a3b8]">
									Jogadores já escalados em outro time desta
									rodada exibem a tag do time e ficam
									bloqueados. Para incluí-los aqui, remova-os
									primeiro do time em que estão.
								</p>
							)}
							<div className="max-h-56 overflow-y-auto border border-border rounded-lg divide-y divide-border">
								{filteredPlayers.map((p) => {
									const assignedOtherTeam =
										otherTeamByPlayerId.get(p.id_player);
									const isAssignedOther =
										Boolean(assignedOtherTeam);
									const checked =
										!isAssignedOther &&
										editPlayerIds.has(p.id_player);
									return (
										<label
											key={p.id_player}
											className={`flex items-center justify-between gap-2 px-3 py-2 text-xs ${
												isAssignedOther
													? 'opacity-60 cursor-not-allowed bg-white/[0.01] text-[#94a3b8]'
													: 'cursor-pointer hover:bg-white/5 text-main'
											}`}
										>
											<div className="flex items-center gap-2 min-w-0">
												<input
													type="checkbox"
													disabled={isAssignedOther}
													checked={checked}
													onChange={() => {
														if (isAssignedOther)
															return;
														setEditPlayerIds(
															(prev) => {
																const next =
																	new Set(
																		prev,
																	);
																next.has(
																	p.id_player,
																)
																	? next.delete(
																			p.id_player,
																		)
																	: next.add(
																			p.id_player,
																		);
																return next;
															},
														);
													}}
													className={
														isAssignedOther
															? 'cursor-not-allowed opacity-50'
															: 'cursor-pointer'
													}
												/>
												<span className="truncate">
													{p.apelido || p.nome}
												</span>
											</div>
											{assignedOtherTeam ? (
												<span
													className="ml-auto inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-amber-500/15 text-[#facc15] border border-amber-500/30 shrink-0"
													title={`Escalado em ${assignedOtherTeam.name}. Remova-o de lá para selecionar aqui.`}
												>
													{assignedOtherTeam.name}
												</span>
											) : p.potes ? (
												<span className="text-muted ml-auto shrink-0">
													Pote {p.potes}
												</span>
											) : null}
										</label>
									);
								})}
							</div>
						</div>
					</FormField>
					<div className="flex gap-3 mt-2">
						<Button
							type="submit"
							disabled={updateTeamMutation.isPending}
						>
							{updateTeamMutation.isPending
								? 'Salvando...'
								: 'Salvar Alterações'}
						</Button>
						<Button
							type="button"
							variant="ghost"
							onClick={() => setIsEditOpen(false)}
						>
							Cancelar
						</Button>
					</div>
				</form>
			</Modal>
		</div>
	);
}
