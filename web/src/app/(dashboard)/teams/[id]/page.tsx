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

	const playersQuery = useQuery<Player[]>({
		queryKey: ['players'],
		queryFn: () => fetchAPI('/players/').catch(() => []),
		enabled: isAdmin && isEditOpen,
	});

	const allPlayers = playersQuery.data ?? [];
	const filteredPlayers = useMemo(() => {
		const q = playerSearch.toLowerCase().trim();
		if (!q) return allPlayers;
		return allPlayers.filter(
			(p) =>
				p.nome.toLowerCase().includes(q) ||
				(p.apelido ?? '').toLowerCase().includes(q),
		);
	}, [allPlayers, playerSearch]);

	const updateTeamMutation = useMutation({
		mutationFn: (body: { name: string; player_ids: number[] }) =>
			fetchAPI(`/teams/${params.id}`, {
				method: 'PUT',
				body: JSON.stringify(body),
			}),
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ['team', params.id] });
			queryClient.invalidateQueries({ queryKey: ['teams'] });
			setIsEditOpen(false);
		},
		onError: (err: Error) =>
			alert(`Erro ao atualizar time: ${err.message}`),
	});

	const deleteTeamMutation = useMutation({
		mutationFn: (roundId: number) =>
			fetchAPI(`/teams/${params.id}`, { method: 'DELETE' }).then(
				() => roundId,
			),
		onSuccess: (roundId: number) => {
			queryClient.invalidateQueries({ queryKey: ['teams'] });
			router.push(`/rounds/${roundId}`);
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
							<Link
								key={p.id_player}
								href={`/players/${p.id_player}`}
								className="flex items-center justify-between py-3 px-2 hover:bg-white/5 rounded transition-colors"
							>
								<div>
									<span className="text-sm font-medium text-main">
										{p.apelido || p.nome}
									</span>
									{p.apelido && p.apelido !== p.nome && (
										<span className="text-xs text-muted ml-2">
											({p.nome})
										</span>
									)}
								</div>
								<div className="flex items-center gap-3 text-xs text-muted">
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
									<span className="text-primary">→</span>
								</div>
							</Link>
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
					<FormField label={`Jogadores (${editPlayerIds.size})`}>
						<div className="flex flex-col gap-2">
							<Input
								placeholder="Buscar jogador..."
								value={playerSearch}
								onChange={(e) => setPlayerSearch(e.target.value)}
							/>
							<div className="max-h-52 overflow-y-auto border border-border rounded-lg divide-y divide-border">
								{filteredPlayers.map((p) => {
									const checked = editPlayerIds.has(p.id_player);
									return (
										<label
											key={p.id_player}
											className="flex items-center gap-2 px-3 py-1.5 text-xs cursor-pointer hover:bg-white/5"
										>
											<input
												type="checkbox"
												checked={checked}
												onChange={() =>
													setEditPlayerIds((prev) => {
														const next = new Set(prev);
														next.has(p.id_player)
															? next.delete(p.id_player)
															: next.add(p.id_player);
														return next;
													})
												}
											/>
											<span className="text-main">
												{p.apelido || p.nome}
											</span>
											{p.potes ? (
												<span className="text-muted ml-auto">
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
