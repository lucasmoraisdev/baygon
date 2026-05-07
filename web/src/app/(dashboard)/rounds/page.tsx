'use client';

import { Button } from '@/components/Button';
import { FormField } from '@/components/FormField';
import { Input } from '@/components/Input';
import { Loading } from '@/components/Loading';
import { Modal } from '@/components/Modal';
import { StatCard2 } from '@/components/StatCard/two';
import { fetchAPI } from '@/lib/api';
import { Player, Round, RoundStats, Season } from '@/types/types';
import { DEFAULT_ROUND, initials, POS_LABEL } from '@/utils/helpers';
import {
	useMutation,
	useQueries,
	useQuery,
	useQueryClient,
} from '@tanstack/react-query';
import { useEffect, useMemo, useState } from 'react';

export default function RoundsPage() {
	const queryClient = useQueryClient();

	const [selectedSeasonOverride, setSelectedSeasonOverride] = useState('');
	const [selectedRoundIdOverride, setSelectedRoundIdOverride] = useState<
		number | null
	>(null);
	const [isModalOpen, setIsModalOpen] = useState(false);
	const [isFinishModalOpen, setIsFinishModalOpen] = useState(false);
	const [newRound, setNewRound] = useState(DEFAULT_ROUND);
	const [selectedPlayerIds, setSelectedPlayerIds] = useState<Set<number>>(
		new Set(),
	);
	const [playerSearch, setPlayerSearch] = useState('');

	const [seasonsQuery, currentSeasonQuery, playersQuery] = useQueries({
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
				queryKey: ['players'],
				queryFn: () => fetchAPI('/players/').catch(() => []),
			},
		],
	});

	const seasons: Season[] = seasonsQuery.data ?? [];
	const allPlayers: Player[] = playersQuery.data ?? [];

	const selectedSeason =
		selectedSeasonOverride ||
		currentSeasonQuery.data?.id_season?.toString() ||
		seasons[0]?.id_season?.toString() ||
		'';

	const roundsQuery = useQuery({
		queryKey: ['rounds', 'season', selectedSeason],
		queryFn: () => fetchAPI(`/rounds/season/${selectedSeason}`),
		enabled: !!selectedSeason,
		select: (data: Round[]) =>
			[...data].sort((a, b) => b.round_number - a.round_number),
	});

	const rounds: Round[] = roundsQuery.data ?? [];
	const activeRound = useMemo(
		() => rounds.find((r) => !r.end_time),
		[rounds],
	);
	const defaultRoundId = useMemo(() => {
		const active = rounds.find((r) => !r.end_time);
		return active?.id_round ?? rounds[0]?.id_round ?? null;
	}, [rounds]);
	const selectedRoundId = selectedRoundIdOverride ?? defaultRoundId;
	const selectedRound = useMemo(
		() => rounds.find((r) => r.id_round === selectedRoundId),
		[rounds, selectedRoundId],
	);

	const statsQuery = useQuery<RoundStats>({
		queryKey: ['round-stats', selectedRoundId],
		queryFn: () => fetchAPI(`/rounds/${selectedRoundId}/stats`),
		enabled: selectedRoundId !== null,
	});
	const stats = statsQuery.data ?? null;

	useEffect(() => {
		if (rounds.length > 0) {
			const max = Math.max(...rounds.map((r) => r.round_number));
			setNewRound((p) => ({ ...p, round_number: (max + 1).toString() }));
		} else {
			setNewRound((p) => ({ ...p, round_number: '1' }));
		}
	}, [rounds]);

	const startRoundMutation = useMutation({
		mutationFn: (body: object) =>
			fetchAPI('/rounds/', {
				method: 'POST',
				body: JSON.stringify(body),
			}),
		onSuccess: (created: Round) => {
			queryClient.invalidateQueries({
				queryKey: ['rounds', 'season', selectedSeason],
			});
			setSelectedRoundIdOverride(created.id_round);
			setIsModalOpen(false);
			setNewRound(DEFAULT_ROUND);
			setSelectedPlayerIds(new Set());
			setPlayerSearch('');
		},
		onError: () => alert('Erro ao iniciar rodada.'),
	});

	const finishRoundMutation = useMutation({
		mutationFn: (roundId: number) =>
			fetchAPI(`/rounds/${roundId}`, {
				method: 'PUT',
				body: JSON.stringify({ end_time: new Date().toISOString() }),
			}),
		onSuccess: () => {
			queryClient.invalidateQueries({
				queryKey: ['rounds', 'season', selectedSeason],
			});
			if (selectedRoundId)
				queryClient.invalidateQueries({
					queryKey: ['round-stats', selectedRoundId],
				});
			setIsFinishModalOpen(false);
		},
		onError: () => alert('Erro ao finalizar rodada.'),
	});

	const filteredPlayers = useMemo(() => {
		const q = playerSearch.toLowerCase().trim();
		if (!q) return allPlayers;
		return allPlayers.filter(
			(p) =>
				p.nome.toLowerCase().includes(q) ||
				p.apelido?.toLowerCase().includes(q),
		);
	}, [allPlayers, playerSearch]);

	const handleSeasonChange = (season: string) => {
		setSelectedSeasonOverride(season);
		setSelectedRoundIdOverride(null);
	};

	const handleStartRound = (e: React.FormEvent) => {
		e.preventDefault();
		if (!selectedSeason) return;
		startRoundMutation.mutate({
			round_number: parseInt(newRound.round_number),
			location: newRound.location,
			referee: newRound.referee,
			date: new Date(newRound.date).toISOString(),
			season_id: parseInt(selectedSeason),
			initial_time: new Date().toISOString(),
		});
	};

	const togglePlayer = (id: number) => {
		setSelectedPlayerIds((prev) => {
			const next = new Set(prev);
			next.has(id) ? next.delete(id) : next.add(id);
			return next;
		});
	};

	if (seasonsQuery.isLoading || currentSeasonQuery.isLoading)
		return <Loading />;

	return (
		<div className="flex flex-col gap-6 animate-slide-down">
			<div className="flex items-center justify-between flex-wrap gap-4">
				<div>
					<h1 className="text-3xl text-main">Rodadas</h1>
					<p className="text-sm text-muted mt-1">
						{activeRound
							? `Rodada ${activeRound.round_number} em andamento`
							: rounds.length > 0
								? 'Nenhuma rodada ativa no momento'
								: 'Nenhuma rodada cadastrada'}
					</p>
				</div>
				<div className="flex items-center gap-3">
					<select
						value={selectedSeason}
						onChange={(e) => handleSeasonChange(e.target.value)}
						className="px-3 py-2.5 bg-background/80 border border-border rounded-md text-main text-sm focus:outline-none focus:border-primary transition-colors"
					>
						{seasons.map((s) => (
							<option key={s.id_season} value={s.id_season}>
								Temporada {s.number}{' '}
								{s.is_active ? '(Atual)' : ''}
							</option>
						))}
					</select>
					{!activeRound && (
						<Button
							onClick={() => setIsModalOpen(true)}
							className="w-auto"
						>
							▶ Iniciar Rodada
						</Button>
					)}
					{activeRound &&
						selectedRound?.id_round === activeRound.id_round && (
							<Button
								variant="danger"
								onClick={() => setIsFinishModalOpen(true)}
								className="w-auto"
							>
								🏁 Finalizar Rodada
							</Button>
						)}
				</div>
			</div>

			{rounds.length > 0 ? (
				<div className="bg-surface border border-border rounded-xl p-4 flex items-center gap-3 flex-wrap">
					<span className="text-xs text-muted shrink-0">Rodada</span>
					<div className="flex gap-2 flex-wrap flex-1">
						{rounds.map((r) => {
							const isActive = !r.end_time;
							const isSelected = r.id_round === selectedRoundId;
							return (
								<button
									key={r.id_round}
									onClick={() =>
										setSelectedRoundIdOverride(r.id_round)
									}
									className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
										isSelected
											? 'bg-primary text-white'
											: 'bg-background/50 border border-border text-muted hover:text-main'
									}`}
								>
									#{r.round_number}
									{isActive && (
										<span className="flex items-center gap-1 text-xs">
											<span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
											LIVE
										</span>
									)}
								</button>
							);
						})}
					</div>
					{selectedRound && (
						<span className="text-xs text-muted shrink-0">
							{new Date(selectedRound.date).toLocaleDateString(
								'pt-BR',
								{
									day: '2-digit',
									month: 'short',
									year: 'numeric',
								},
							)}
						</span>
					)}
				</div>
			) : (
				<div className="bg-surface border border-border rounded-xl p-10 flex flex-col items-center gap-3 text-center">
					<span className="text-4xl">🏟️</span>
					<h3 className="text-lg font-semibold">
						Nenhuma rodada cadastrada
					</h3>
					<p className="text-sm text-muted max-w-sm">
						Inicie a primeira rodada desta temporada para começar a
						registrar partidas e estatísticas.
					</p>
					<Button
						onClick={() => setIsModalOpen(true)}
						className="w-auto mt-2"
					>
						▶ Iniciar Primeira Rodada
					</Button>
				</div>
			)}

			{selectedRound && (
				<>
					<div className="bg-surface border border-border rounded-xl px-5 py-3 flex gap-6 flex-wrap text-sm text-muted">
						<span>
							📅{' '}
							{new Date(selectedRound.date).toLocaleDateString(
								'pt-BR',
								{
									weekday: 'long',
									day: '2-digit',
									month: 'long',
									year: 'numeric',
								},
							)}
						</span>
						<span>📍 {selectedRound.location}</span>
						<span>👨‍⚖️ {selectedRound.referee}</span>
						{selectedRound.initial_time && (
							<span>
								⏱ Início:{' '}
								{new Date(
									selectedRound.initial_time,
								).toLocaleTimeString('pt-BR', {
									hour: '2-digit',
									minute: '2-digit',
								})}
							</span>
						)}
						{selectedRound.end_time && (
							<span>
								🏁 Fim:{' '}
								{new Date(
									selectedRound.end_time,
								).toLocaleTimeString('pt-BR', {
									hour: '2-digit',
									minute: '2-digit',
								})}
							</span>
						)}
					</div>

					{statsQuery.isLoading ? (
						<Loading />
					) : stats ? (
						<>
							<div className="grid grid-cols-[repeat(auto-fill,minmax(140px,1fr))] gap-3">
								<StatCard2
									icon="⚽"
									value={stats.total_goals}
									label="Gols"
									sub={`${stats.goals_per_match} por partida`}
									variant="highlight"
								/>
								<StatCard2
									icon="🎯"
									value={stats.total_assists}
									label="Assistências"
									sub={`${stats.assists_per_match} por partida`}
									variant="highlight"
								/>
								<StatCard2
									icon="🏟️"
									value={stats.total_matches}
									label="Partidas"
								/>
								<StatCard2
									icon="🟡"
									value={stats.total_yellow_cards}
									label="Amarelos"
									variant="gold"
								/>
								<StatCard2
									icon="🔴"
									value={stats.total_red_cards}
									label="Vermelhos"
									variant="red"
								/>
								<StatCard2
									icon="🔵"
									value={stats.total_blue_cards}
									label="Azuis (Ouro)"
								/>
								{stats.winner_team && (
									<StatCard2
										icon="🏆"
										value={stats.winner_team.name}
										label="Time Vencedor"
										sub={`${stats.winner_team.wins} vitória${stats.winner_team.wins !== 1 ? 's' : ''}`}
										variant="gold"
									/>
								)}
							</div>

							<div className="grid grid-cols-1 md:grid-cols-2 gap-4">
								<div className="bg-surface border border-border rounded-xl p-5">
									<p className="text-sm font-semibold mb-4">
										🌟 Destaques da Rodada
									</p>
									<div className="flex flex-col gap-3">
										{[
											{
												icon: '⚽',
												name: stats.top_scorer
													? stats.top_scorer
															.apelido ||
														stats.top_scorer.nome
													: null,
												sub: stats.top_scorer
													? `Artilheiro · ${stats.top_scorer.goals} gol${stats.top_scorer.goals !== 1 ? 's' : ''}`
													: 'Nenhum gol registrado',
												empty: '— Sem artilheiro',
											},
											{
												icon: '🎯',
												name: stats.top_assister
													? stats.top_assister
															.apelido ||
														stats.top_assister.nome
													: null,
												sub: stats.top_assister
													? `Garçom · ${stats.top_assister.assists} assistência${stats.top_assister.assists !== 1 ? 's' : ''}`
													: 'Nenhuma assistência registrada',
												empty: '— Sem assistências',
											},
											{
												icon: '🏆',
												name: stats.winner_team
													? stats.winner_team.name
													: null,
												sub: stats.winner_team
													? `Time mais vitorioso · ${stats.winner_team.wins} vitória${stats.winner_team.wins !== 1 ? 's' : ''}`
													: 'Nenhuma partida encerrada',
												empty: '— Sem vencedor',
											},
										].map(({ icon, name, sub, empty }) => (
											<div
												key={icon}
												className={`flex items-center gap-3 p-3 rounded-lg bg-surface/50 border border-border ${!name ? 'opacity-50' : ''}`}
											>
												<span className="text-2xl">
													{icon}
												</span>
												<div>
													<p className="text-sm font-medium text-main">
														{name ?? empty}
													</p>
													<p className="text-xs text-muted">
														{sub}
													</p>
												</div>
											</div>
										))}
									</div>
								</div>

								{/* Participantes */}
								<div className="bg-surface border border-border rounded-xl p-5">
									<p className="text-sm font-semibold mb-4">
										👥 Participantes (
										{stats.participants.length})
									</p>
									{stats.participants.length === 0 ? (
										<p className="text-sm text-muted">
											Nenhum jogador com eventos
											registrados.
										</p>
									) : (
										<div className="flex flex-col gap-2 max-h-64 overflow-y-auto">
											{stats.participants.map((p) => (
												<div
													key={p.id}
													className="flex items-center gap-2"
												>
													<div className="w-7 h-7 rounded-full bg-primary/20 text-primary text-xs font-bold flex items-center justify-center shrink-0">
														{initials(p.nome)}
													</div>
													<span className="text-sm text-main flex-1 truncate">
														{p.apelido || p.nome}
													</span>
													{p.posicao && (
														<span className="text-xs text-muted bg-surface border border-border px-1.5 py-0.5 rounded shrink-0">
															{POS_LABEL[
																p.posicao
															] ??
																p.posicao.toUpperCase()}
														</span>
													)}
												</div>
											))}
										</div>
									)}
								</div>
							</div>
						</>
					) : null}
				</>
			)}

			{isModalOpen && (
				<div
					className="fixed inset-0 bg-black/70 flex items-center justify-center z-1000 p-4"
					onClick={(e) => {
						if (e.target === e.currentTarget) setIsModalOpen(false);
					}}
				>
					<div className="bg-surface border border-border rounded-xl p-8 w-full max-w-2xl shadow-[0_10px_25px_rgba(0,0,0,0.5)] text-main animate-slide-down max-h-[90vh] overflow-y-auto">
						<h2 className="text-xl font-semibold mb-1">
							🏟️ Iniciar Nova Rodada
						</h2>
						<p className="text-sm text-muted mb-6">
							Configure a data do baba e selecione os jogadores
							participantes.
						</p>

						<form
							onSubmit={handleStartRound}
							className="flex flex-col gap-4"
						>
							<div className="grid grid-cols-2 gap-4">
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
										min={1}
										placeholder="Ex: 1"
									/>
								</FormField>
								<FormField label="Data do Baba">
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
										placeholder="Ex: Campo Principal"
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
										placeholder="Ex: A definir"
									/>
								</FormField>
							</div>

							<hr className="border-border" />

							<div>
								<p className="text-sm font-medium mb-2">
									Jogadores Convocados (
									{selectedPlayerIds.size} selecionados)
								</p>
								<Input
									type="text"
									placeholder="🔍 Buscar jogador..."
									value={playerSearch}
									onChange={(e) =>
										setPlayerSearch(e.target.value)
									}
									className="mb-3"
								/>
								<div className="grid grid-cols-[repeat(auto-fill,minmax(140px,1fr))] gap-2 max-h-48 overflow-y-auto">
									{filteredPlayers.map((p) => {
										const selected = selectedPlayerIds.has(
											p.id_player,
										);
										return (
											<div
												key={p.id_player}
												onClick={() =>
													togglePlayer(p.id_player)
												}
												className={`flex items-center gap-2 px-3 py-2 rounded-lg border cursor-pointer text-sm transition-colors ${
													selected
														? 'bg-primary/15 border-primary text-main'
														: 'bg-background/50 border-border text-muted hover:border-primary/50'
												}`}
											>
												<div
													className={`w-4 h-4 rounded flex items-center justify-center shrink-0 border ${selected ? 'bg-primary border-primary' : 'border-border'}`}
												>
													{selected && (
														<span className="text-white text-[10px] font-bold">
															✓
														</span>
													)}
												</div>
												<span className="truncate">
													{p.apelido || p.nome}
												</span>
											</div>
										);
									})}
									{filteredPlayers.length === 0 && (
										<p className="text-sm text-muted text-center py-4 col-span-full">
											Nenhum jogador encontrado.
										</p>
									)}
								</div>
							</div>

							<div className="flex gap-3 pt-2">
								<Button
									type="submit"
									disabled={startRoundMutation.isPending}
								>
									{startRoundMutation.isPending
										? 'Criando...'
										: '▶ Iniciar Rodada'}
								</Button>
								<Button
									type="button"
									variant="ghost"
									onClick={() => {
										setIsModalOpen(false);
										setSelectedPlayerIds(new Set());
										setPlayerSearch('');
									}}
								>
									Cancelar
								</Button>
							</div>
						</form>
					</div>
				</div>
			)}

			<Modal
				isOpen={isFinishModalOpen}
				onClose={() => setIsFinishModalOpen(false)}
				title="Finalizar Rodada?"
			>
				<div className="text-center mb-2 text-5xl">🏁</div>
				<p className="text-sm text-muted text-center mb-4">
					Você está prestes a encerrar a{' '}
					<strong className="text-main">
						Rodada {activeRound?.round_number}
					</strong>
					. Isso registrará o horário de fim e a rodada será marcada
					como concluída.
				</p>
				<div className="bg-red-500/10 border border-red-500/20 rounded-lg p-3 mb-6 text-sm text-red-300">
					⚠️ Após finalizar, não será possível criar novas partidas
					nesta rodada sem reabri-la manualmente.
				</div>
				<div className="flex gap-3">
					<Button
						variant="danger"
						onClick={() =>
							activeRound &&
							finishRoundMutation.mutate(activeRound.id_round)
						}
						disabled={finishRoundMutation.isPending}
					>
						{finishRoundMutation.isPending
							? 'Finalizando...'
							: '🏁 Confirmar Encerramento'}
					</Button>
					<Button
						variant="ghost"
						onClick={() => setIsFinishModalOpen(false)}
						disabled={finishRoundMutation.isPending}
					>
						Cancelar
					</Button>
				</div>
			</Modal>
		</div>
	);
}
