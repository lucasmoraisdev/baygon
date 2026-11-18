'use client';

import React, { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/context/AuthContext';
import { fetchAPI } from '@/lib/api';
import { Poll, Season, RoundStatsItem } from '@/types/types';
import {
	Vote,
	Plus,
	CheckCircle2,
	AlertCircle,
	Calendar,
	Clock,
	Lock,
	Unlock,
	Trash2,
	ChevronRight,
	Award,
	Check,
	UserCheck,
	Sparkles,
} from 'lucide-react';
import Link from 'next/link';

export default function PollsPage() {
	const { user } = useAuth();
	const queryClient = useQueryClient();
	const isAdmin = Boolean(user?.is_admin || user?.role === 'admin');

	// Temporada selecionada
	const [selectedSeasonId, setSelectedSeasonId] = useState<number | null>(null);

	// Aba ativa: 'polls' (Enquetes de Temporada) ou 'round_awards' (Destaques da Rodada)
	const [activeTab, setActiveTab] = useState<'polls' | 'round_awards'>('polls');

	// Filtro de rodadas: 'all' | 'open' | 'finished'
	const [roundFilter, setRoundFilter] = useState<'all' | 'open' | 'finished'>('all');

	// Estado para modal de criação de enquete
	const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
	const [newTitle, setNewTitle] = useState('');
	const [newDescription, setNewDescription] = useState('');
	const [newMultipleChoices, setNewMultipleChoices] = useState(false);
	const [newEndsAt, setNewEndsAt] = useState('');
	const [newOptions, setNewOptions] = useState<string[]>(['', '']);
	const [createError, setCreateError] = useState<string | null>(null);

	// Seleção de opções para voto por enquete: { [pollId]: number[] }
	const [selectedVoteOptions, setSelectedVoteOptions] = useState<{ [pollId: number]: number[] }>({});
	const [votingError, setVotingError] = useState<{ [pollId: number]: string | null }>({});

	// Buscar Temporadas
	const { data: seasons = [], isLoading: isLoadingSeasons } = useQuery<Season[]>({
		queryKey: ['seasons'],
		queryFn: async () => {
			const res = await fetchAPI('/seasons/');
			return res;
		},
	});

	// Definir temporada inicial ativa
	React.useEffect(() => {
		if (seasons.length > 0 && selectedSeasonId === null) {
			const activeSeason = seasons.find((s) => s.is_active) || seasons[0];
			setSelectedSeasonId(activeSeason.id_season);
		}
	}, [seasons, selectedSeasonId]);

	// Buscar Enquetes da Temporada
	const {
		data: polls = [],
		isLoading: isLoadingPolls,
		refetch: refetchPolls,
	} = useQuery<Poll[]>({
		queryKey: ['polls', selectedSeasonId],
		queryFn: async () => {
			if (!selectedSeasonId) return [];
			return await fetchAPI(`/polls/season/${selectedSeasonId}`);
		},
		enabled: Boolean(selectedSeasonId),
	});

	// Buscar Rodadas da Temporada
	const { data: rawRounds = [], isLoading: isLoadingRounds } = useQuery<any[]>({
		queryKey: ['rounds', 'season', selectedSeasonId],
		queryFn: async () => {
			if (!selectedSeasonId) return [];
			return await fetchAPI(`/rounds/season/${selectedSeasonId}`);
		},
		enabled: Boolean(selectedSeasonId),
	});

	// Rodadas agrupadas ordenadas sempre da mais recente para a mais antiga
	const sortedRounds = useMemo(() => {
		return [...rawRounds].sort((a, b) => {
			if (b.round_number !== a.round_number) {
				return b.round_number - a.round_number;
			}
			return new Date(b.date || 0).getTime() - new Date(a.date || 0).getTime();
		});
	}, [rawRounds]);

	// Rodadas filtradas
	const filteredRounds = useMemo(() => {
		if (roundFilter === 'open') {
			return sortedRounds.filter((r) => !r.end_time);
		}
		if (roundFilter === 'finished') {
			return sortedRounds.filter((r) => Boolean(r.end_time));
		}
		return sortedRounds;
	}, [sortedRounds, roundFilter]);

	// Mutation: Votar na Enquete
	const voteMutation = useMutation({
		mutationFn: async ({ pollId, optionIds }: { pollId: number; optionIds: number[] }) => {
			return await fetchAPI(`/polls/${pollId}/vote`, {
				method: 'POST',
				body: JSON.stringify({ option_ids: optionIds }),
			});
		},
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ['polls', selectedSeasonId] });
		},
		onError: (err: any, variables) => {
			setVotingError((prev) => ({
				...prev,
				[variables.pollId]: err?.message || 'Falha ao registrar voto.',
			}));
		},
	});

	// Mutation: Criar Enquete
	const createMutation = useMutation({
		mutationFn: async (payload: any) => {
			return await fetchAPI('/polls/', {
				method: 'POST',
				body: JSON.stringify(payload),
			});
		},
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ['polls', selectedSeasonId] });
			setIsCreateModalOpen(false);
			setNewTitle('');
			setNewDescription('');
			setNewMultipleChoices(false);
			setNewEndsAt('');
			setNewOptions(['', '']);
			setCreateError(null);
		},
		onError: (err: any) => {
			setCreateError(err?.message || 'Erro ao criar enquete.');
		},
	});

	// Mutation: Alternar Ativação da Enquete
	const toggleStatusMutation = useMutation({
		mutationFn: async ({ pollId, isActive }: { pollId: number; isActive: boolean }) => {
			return await fetchAPI(`/polls/${pollId}`, {
				method: 'PUT',
				body: JSON.stringify({ is_active: isActive }),
			});
		},
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ['polls', selectedSeasonId] });
		},
	});

	// Mutation: Excluir Enquete
	const deleteMutation = useMutation({
		mutationFn: async (pollId: number) => {
			return await fetchAPI(`/polls/${pollId}`, {
				method: 'DELETE',
			});
		},
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ['polls', selectedSeasonId] });
		},
	});

	// Handlers de opções na criação
	const handleAddOptionField = () => {
		setNewOptions([...newOptions, '']);
	};

	const handleRemoveOptionField = (index: number) => {
		if (newOptions.length > 2) {
			setNewOptions(newOptions.filter((_, i) => i !== index));
		}
	};

	const handleOptionTextChange = (index: number, value: string) => {
		const updated = [...newOptions];
		updated[index] = value;
		setNewOptions(updated);
	};

	const handleCreatePollSubmit = (e: React.FormEvent) => {
		e.preventDefault();
		if (!selectedSeasonId) return;
		const validOptions = newOptions.map((o) => o.trim()).filter(Boolean);
		if (validOptions.length < 2) {
			setCreateError('Adicione pelo menos duas opções válidas.');
			return;
		}

		createMutation.mutate({
			season_id: selectedSeasonId,
			title: newTitle.trim(),
			description: newDescription.trim() || null,
			multiple_choices: newMultipleChoices,
			ends_at: newEndsAt ? new Date(newEndsAt).toISOString() : null,
			options: validOptions.map((title) => ({ title })),
		});
	};

	const handleSelectOptionToVote = (poll: Poll, optionId: number) => {
		setSelectedVoteOptions((prev) => {
			const current = prev[poll.id_poll] || [];
			if (poll.multiple_choices) {
				if (current.includes(optionId)) {
					return { ...prev, [poll.id_poll]: current.filter((id) => id !== optionId) };
				} else {
					return { ...prev, [poll.id_poll]: [...current, optionId] };
				}
			} else {
				return { ...prev, [poll.id_poll]: [optionId] };
			}
		});
		setVotingError((prev) => ({ ...prev, [poll.id_poll]: null }));
	};

	const handleConfirmVote = (pollId: number) => {
		const selected = selectedVoteOptions[pollId] || [];
		if (selected.length === 0) {
			setVotingError((prev) => ({
				...prev,
				[pollId]: 'Selecione ao menos uma opção antes de confirmar.',
			}));
			return;
		}
		voteMutation.mutate({ pollId, optionIds: selected });
	};

	return (
		<div className="space-y-6">
			{/* Cabeçalho */}
			<div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
				<div>
					<h1 className="text-2xl font-bold text-main flex items-center gap-2">
						<Vote className="w-7 h-7 text-primary" />
						Central de Votações
					</h1>
					<p className="text-sm text-muted">
						Participe das enquetes da temporada e acompanhe a eleição dos destaques das rodadas.
					</p>
				</div>

				<div className="flex items-center gap-3">
					{/* Seletor de Temporada */}
					<div className="flex items-center gap-2 bg-surface border border-border rounded-lg px-3 py-2 text-sm">
						<Calendar className="w-4 h-4 text-muted" />
						<select
							value={selectedSeasonId ?? ''}
							onChange={(e) => setSelectedSeasonId(Number(e.target.value))}
							className="bg-transparent text-main font-medium focus:outline-none cursor-pointer"
						>
							{seasons.map((s) => (
								<option key={s.id_season} value={s.id_season} className="bg-surface text-main">
									Temporada {s.number} {s.is_active ? '(Ativa)' : ''}
								</option>
							))}
						</select>
					</div>

					{/* Botão Admin: Nova Enquete */}
					{isAdmin && (
						<button
							onClick={() => setIsCreateModalOpen(true)}
							className="flex items-center gap-2 px-4 py-2 bg-primary hover:bg-primary/90 text-white text-sm font-semibold rounded-lg shadow-sm transition"
						>
							<Plus className="w-4 h-4" />
							Nova Enquete
						</button>
					)}
				</div>
			</div>

			{/* Abas */}
			<div className="border-b border-border flex items-center gap-6">
				<button
					onClick={() => setActiveTab('polls')}
					className={`pb-3 text-sm font-semibold transition border-b-2 flex items-center gap-2 ${
						activeTab === 'polls'
							? 'border-primary text-primary'
							: 'border-transparent text-muted hover:text-main'
					}`}
				>
					<Vote className="w-4 h-4" />
					Enquetes da Temporada
					{polls.length > 0 && (
						<span className="px-2 py-0.5 text-xs rounded-full bg-surface border border-border text-muted">
							{polls.length}
						</span>
					)}
				</button>
				<button
					onClick={() => setActiveTab('round_awards')}
					className={`pb-3 text-sm font-semibold transition border-b-2 flex items-center gap-2 ${
						activeTab === 'round_awards'
							? 'border-primary text-primary'
							: 'border-transparent text-muted hover:text-main'
					}`}
				>
					<Award className="w-4 h-4" />
					Votações dos Destaques das Rodadas
					{rawRounds.length > 0 && (
						<span className="px-2 py-0.5 text-xs rounded-full bg-surface border border-border text-muted">
							{rawRounds.length}
						</span>
					)}
				</button>
			</div>

			{/* Conteúdo Aba 1: Enquetes */}
			{activeTab === 'polls' && (
				<div className="space-y-6">
					{/* Informação para associados */}
					<div className="bg-blue-500/10 border border-blue-500/30 rounded-xl p-4 flex items-start gap-3">
						<UserCheck className="w-5 h-5 text-blue-500 shrink-0 mt-0.5" />
						<div className="text-sm">
							<span className="font-semibold text-blue-600 dark:text-blue-400">
								Votação exclusiva para mensalistas:
							</span>{' '}
							<span className="text-muted">
								Apenas associados e administradores têm direito a voto nas enquetes oficiais da
								temporada.
							</span>
						</div>
					</div>

					{isLoadingPolls ? (
						<div className="py-12 text-center text-muted">Carregando enquetes da temporada...</div>
					) : polls.length === 0 ? (
						<div className="py-16 text-center bg-surface border border-border rounded-xl">
							<Vote className="w-12 h-12 text-muted mx-auto mb-3 opacity-40" />
							<h3 className="text-base font-semibold text-main mb-1">Nenhuma enquete cadastrada</h3>
							<p className="text-sm text-muted max-w-md mx-auto mb-4">
								Não há enquetes cadastradas nesta temporada ainda.
							</p>
							{isAdmin && (
								<button
									onClick={() => setIsCreateModalOpen(true)}
									className="inline-flex items-center gap-2 px-4 py-2 bg-primary text-white text-sm font-medium rounded-lg hover:bg-primary/90"
								>
									<Plus className="w-4 h-4" />
									Criar Primeira Enquete
								</button>
							)}
						</div>
					) : (
						<div className="grid grid-cols-1 md:grid-cols-2 gap-6">
							{polls.map((poll) => {
								const hasVoted = poll.has_voted;
								const canVote = poll.is_active && !hasVoted;
								const selectedForThis = selectedVoteOptions[poll.id_poll] || [];
								const pollErr = votingError[poll.id_poll];

								return (
									<div
										key={poll.id_poll}
										className="bg-surface border border-border rounded-xl p-5 shadow-sm flex flex-col justify-between"
									>
										<div>
											{/* Cabeçalho da Enquete */}
											<div className="flex items-start justify-between gap-2 mb-2">
												<div className="flex flex-wrap items-center gap-2">
													<span
														className={`text-xs px-2.5 py-0.5 rounded-full font-medium flex items-center gap-1 ${
															poll.is_active
																? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30'
																: 'bg-zinc-500/10 text-zinc-600 dark:text-zinc-400 border border-zinc-500/30'
														}`}
													>
														{poll.is_active ? (
															<>
																<Unlock className="w-3 h-3" /> Em Votação
															</>
														) : (
															<>
																<Lock className="w-3 h-3" /> Encerrada
															</>
														)}
													</span>

													{poll.multiple_choices && (
														<span className="text-xs px-2 py-0.5 rounded-full bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-500/30 font-medium">
															Múltipla Escolha
														</span>
													)}

													{hasVoted && (
														<span className="text-xs px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/30 font-medium flex items-center gap-1">
															<Check className="w-3 h-3" /> Voto Registrado
														</span>
													)}
												</div>

												{/* Ações de Admin */}
												{isAdmin && (
													<div className="flex items-center gap-1">
														<button
															title={poll.is_active ? 'Encerrar Votação' : 'Reabrir Votação'}
															onClick={() =>
																toggleStatusMutation.mutate({
																	pollId: poll.id_poll,
																	isActive: !poll.is_active,
																})
															}
															className="p-1.5 text-muted hover:text-main rounded-md hover:bg-background transition text-xs"
														>
															{poll.is_active ? (
																<Lock className="w-4 h-4 text-amber-500" />
															) : (
																<Unlock className="w-4 h-4 text-emerald-500" />
															)}
														</button>
														<button
															title="Excluir Enquete"
															onClick={() => {
																if (confirm('Tem certeza que deseja excluir esta enquete?')) {
																	deleteMutation.mutate(poll.id_poll);
																}
															}}
															className="p-1.5 text-muted hover:text-red-500 rounded-md hover:bg-background transition text-xs"
														>
															<Trash2 className="w-4 h-4" />
														</button>
													</div>
												)}
											</div>

											{/* Título e Descrição */}
											<h3 className="text-lg font-bold text-main mb-1">{poll.title}</h3>
											{poll.description && (
												<p className="text-sm text-muted mb-4">{poll.description}</p>
											)}

											{/* Data limite */}
											{poll.ends_at && (
												<div className="text-xs text-muted flex items-center gap-1 mb-4">
													<Clock className="w-3.5 h-3.5" />
													<span>
														Encerra em:{' '}
														{new Date(poll.ends_at).toLocaleString('pt-BR', {
															dateStyle: 'short',
															timeStyle: 'short',
														})}
													</span>
												</div>
											)}

											{/* Opções */}
											<div className="space-y-2.5 my-4">
												{poll.options.map((opt) => {
													const isSelected = selectedForThis.includes(opt.id_option);
													const isUserVoted = (poll.user_voted_option_ids || []).includes(
														opt.id_option,
													);

													// Se a enquete estiver encerrada ou o usuário já votou: exibe gráfico percentual
													if (!canVote) {
														return (
															<div
																key={opt.id_option}
																className={`relative overflow-hidden border rounded-lg p-3 transition ${
																	isUserVoted
																		? 'border-primary/50 bg-primary/5'
																		: 'border-border bg-background/50'
																}`}
															>
																{/* Barra de progresso */}
																<div
																	className={`absolute top-0 bottom-0 left-0 opacity-20 pointer-events-none transition-all duration-500 ${
																		isUserVoted ? 'bg-primary' : 'bg-zinc-400 dark:bg-zinc-600'
																	}`}
																	style={{ width: `${opt.percentage}%` }}
																/>

																<div className="relative flex items-center justify-between gap-3 text-sm">
																	<div className="flex items-center gap-2">
																		<span className="font-medium text-main">{opt.title}</span>
																		{isUserVoted && (
																			<span className="text-xs px-2 py-0.5 rounded bg-primary/20 text-primary font-semibold">
																				Seu voto
																			</span>
																		)}
																	</div>
																	<div className="flex items-center gap-2 text-right">
																		<span className="text-xs text-muted">
																			{opt.votes_count}{' '}
																			{opt.votes_count === 1 ? 'voto' : 'votos'}
																		</span>
																		<span className="text-sm font-bold text-main min-w-[45px] text-right">
																			{opt.percentage}%
																		</span>
																	</div>
																</div>
															</div>
														);
													}

													// Modo de votação (usuário ainda não votou e enquete aberta)
													return (
														<div
															key={opt.id_option}
															onClick={() => handleSelectOptionToVote(poll, opt.id_option)}
															className={`cursor-pointer border rounded-lg p-3 transition flex items-center justify-between gap-3 ${
																isSelected
																	? 'border-primary bg-primary/10 shadow-sm'
																	: 'border-border bg-background hover:border-border-hover'
															}`}
														>
															<div className="flex items-center gap-3">
																<div
																	className={`w-4 h-4 rounded-${
																		poll.multiple_choices ? 'sm' : 'full'
																	} border flex items-center justify-center transition ${
																		isSelected
																			? 'border-primary bg-primary text-white'
																			: 'border-border bg-surface'
																	}`}
																>
																	{isSelected && <Check className="w-3 h-3 stroke-[3]" />}
																</div>
																<span className="text-sm font-medium text-main">{opt.title}</span>
															</div>
														</div>
													);
												})}
											</div>
										</div>

										{/* Rodapé do Card */}
										<div className="pt-3 border-t border-border mt-2">
											{pollErr && (
												<div className="mb-3 text-xs text-red-500 flex items-center gap-1">
													<AlertCircle className="w-3.5 h-3.5 shrink-0" />
													<span>{pollErr}</span>
												</div>
											)}

											<div className="flex items-center justify-between">
												<span className="text-xs text-muted">
													Total: {poll.total_votes}{' '}
													{poll.total_votes === 1 ? 'voto' : 'votos computados'}
												</span>

												{canVote && (
													<button
														disabled={selectedForThis.length === 0 || voteMutation.isPending}
														onClick={() => handleConfirmVote(poll.id_poll)}
														className="px-4 py-1.5 bg-primary hover:bg-primary/90 disabled:opacity-50 text-white text-xs font-semibold rounded-lg shadow-sm transition flex items-center gap-1.5"
													>
														{voteMutation.isPending ? 'Salvando...' : 'Confirmar Voto'}
													</button>
												)}
											</div>
										</div>
									</div>
								);
							})}
						</div>
					)}
				</div>
			)}

			{/* Conteúdo Aba 2: Destaques das Rodadas */}
			{activeTab === 'round_awards' && (
				<div className="space-y-6">
					<div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-4 flex items-start gap-3">
						<Sparkles className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
						<div className="text-sm">
							<span className="font-semibold text-amber-600 dark:text-amber-400">
								Votação de Destaques por Júri Designado:
							</span>{' '}
							<span className="text-muted">
								Para as categorias Bola Cheia, Bola Murcha, Gol, Defesa, Drible e Inacreditável,
								apenas os jurados designados pelo administrador podem registrar votos. Abaixo, as rodadas
								estão agrupadas e listadas da mais recente para a mais antiga.
							</span>
						</div>
					</div>

					{/* Barra de Filtros e Contadores */}
					<div className="flex flex-wrap items-center justify-between gap-3 bg-surface border border-border rounded-xl p-3">
						<div className="flex items-center gap-2">
							<span className="text-xs font-semibold text-muted mr-1">Filtrar Rodadas:</span>
							<button
								onClick={() => setRoundFilter('all')}
								className={`px-3 py-1.5 rounded-lg text-xs font-medium transition ${
									roundFilter === 'all'
										? 'bg-primary text-white shadow-xs'
										: 'bg-background hover:bg-background/80 text-muted hover:text-main border border-border'
								}`}
							>
								Todas ({sortedRounds.length})
							</button>
							<button
								onClick={() => setRoundFilter('open')}
								className={`px-3 py-1.5 rounded-lg text-xs font-medium transition ${
									roundFilter === 'open'
										? 'bg-primary text-white shadow-xs'
										: 'bg-background hover:bg-background/80 text-muted hover:text-main border border-border'
								}`}
							>
								Em Aberto ({sortedRounds.filter((r) => !r.end_time).length})
							</button>
							<button
								onClick={() => setRoundFilter('finished')}
								className={`px-3 py-1.5 rounded-lg text-xs font-medium transition ${
									roundFilter === 'finished'
										? 'bg-primary text-white shadow-xs'
										: 'bg-background hover:bg-background/80 text-muted hover:text-main border border-border'
								}`}
							>
								Concluídas ({sortedRounds.filter((r) => Boolean(r.end_time)).length})
							</button>
						</div>

						<span className="text-xs text-muted">
							Ordenadas pela mais recente
						</span>
					</div>

					{isLoadingRounds ? (
						<div className="py-12 text-center text-muted">Carregando rodadas...</div>
					) : filteredRounds.length === 0 ? (
						<div className="py-16 text-center bg-surface border border-border rounded-xl">
							<Award className="w-12 h-12 text-muted mx-auto mb-3 opacity-40" />
							<h3 className="text-base font-semibold text-main mb-1">Nenhuma rodada encontrada</h3>
							<p className="text-sm text-muted">
								{sortedRounds.length === 0
									? 'Não há rodadas cadastradas nesta temporada.'
									: 'Nenhuma rodada corresponde ao filtro selecionado.'}
							</p>
						</div>
					) : (
						<div className="space-y-4">
							{filteredRounds.map((round: any, idx: number) => {
								const isVotingOpen = Boolean(round.is_voting_open);
								const isFinished = Boolean(round.end_time);
								const isLatest = idx === 0;

								return (
									<div
										key={round.id_round}
										className={`bg-surface border rounded-xl p-5 shadow-sm transition flex flex-col md:flex-row md:items-center justify-between gap-5 ${
											isLatest
												? 'border-primary/50 ring-1 ring-primary/20'
												: 'border-border hover:border-border-hover'
										}`}
									>
										<div className="space-y-2 flex-1">
											<div className="flex flex-wrap items-center gap-2">
												<span className="text-xs px-2.5 py-0.5 rounded-full font-bold bg-primary/10 text-primary border border-primary/25">
													Rodada #{round.round_number}
												</span>

												{isLatest && (
													<span className="text-xs px-2 py-0.5 rounded-full font-bold bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/30">
														⭐ Mais Recente
													</span>
												)}

												{/* Status do Jogo */}
												<span
													className={`text-xs px-2.5 py-0.5 rounded-full font-medium flex items-center gap-1 ${
														isFinished
															? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30'
															: 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/30'
													}`}
												>
													{isFinished ? (
														<>
															<CheckCircle2 className="w-3 h-3" /> Rodada Concluída
														</>
													) : (
														<>
															<Clock className="w-3 h-3" /> Rodada Em Aberto
														</>
													)}
												</span>

												{/* Status da Votação */}
												<span
													className={`text-xs px-2.5 py-0.5 rounded-full font-medium flex items-center gap-1 ${
														isVotingOpen
															? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30 font-semibold'
															: 'bg-zinc-500/10 text-zinc-600 dark:text-zinc-400 border border-zinc-500/30'
													}`}
												>
													{isVotingOpen ? (
														<>
															<Unlock className="w-3 h-3" /> Votação Aberta
														</>
													) : (
														<>
															<Lock className="w-3 h-3" /> Votação Fechada
														</>
													)}
												</span>
											</div>

											<div>
												<h4 className="font-bold text-base text-main">
													{round.location || 'Local a definir'}
												</h4>
												<p className="text-xs text-muted flex items-center gap-2">
													<span>
														Data:{' '}
														{round.date
															? new Date(round.date).toLocaleDateString('pt-BR')
															: 'Data não informada'}
													</span>
													{round.referee && (
														<>
															<span>•</span>
															<span>Árbitro: {round.referee}</span>
														</>
													)}
												</p>
											</div>

											{/* Categorias avaliadas nesta rodada */}
											<div className="flex flex-wrap gap-1.5 pt-1">
												<span className="text-[11px] px-2 py-0.5 rounded-md bg-background border border-border text-muted">
													🏆 Bola Cheia (MVP)
												</span>
												<span className="text-[11px] px-2 py-0.5 rounded-md bg-background border border-border text-muted">
													👎 Bola Murcha
												</span>
												<span className="text-[11px] px-2 py-0.5 rounded-md bg-background border border-border text-muted">
													⚽ Gol da Rodada
												</span>
												<span className="text-[11px] px-2 py-0.5 rounded-md bg-background border border-border text-muted">
													🧤 Defesa da Rodada
												</span>
												<span className="text-[11px] px-2 py-0.5 rounded-md bg-background border border-border text-muted">
													🔥 Drible da Rodada
												</span>
												<span className="text-[11px] px-2 py-0.5 rounded-md bg-background border border-border text-muted">
													❓ Inacreditável
												</span>
											</div>
										</div>

										{/* Botões de Ação */}
										<div className="flex flex-row md:flex-col items-center md:items-end gap-2 pt-2 md:pt-0 border-t md:border-t-0 border-border">
											<Link
												href={`/rounds/${round.id_round}?tab=voting`}
												className="inline-flex items-center justify-center gap-1.5 px-4 py-2 bg-primary hover:bg-primary/90 text-white rounded-lg text-xs font-semibold shadow-sm transition w-full md:w-auto"
											>
												<Sparkles className="w-3.5 h-3.5" />
												{isVotingOpen
													? 'Votar / Gerenciar Júri'
													: isFinished
													? 'Ver Apuração & Resultados'
													: 'Acessar Votação'}
												<ChevronRight className="w-3.5 h-3.5" />
											</Link>

											<Link
												href={`/rounds/${round.id_round}`}
												className="inline-flex items-center justify-center gap-1 px-3 py-1.5 bg-surface hover:bg-background border border-border text-muted hover:text-main rounded-lg text-xs font-medium transition w-full md:w-auto"
											>
												Ver Rodada Completa
											</Link>
										</div>
									</div>
								);
							})}
						</div>
					)}
				</div>
			)}

			{/* Modal: Criar Enquete */}
			{isCreateModalOpen && (
				<div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
					<div className="bg-surface border border-border rounded-xl w-full max-w-lg p-6 shadow-2xl max-h-[90vh] overflow-y-auto">
						<div className="flex items-center justify-between pb-3 border-b border-border mb-4">
							<h3 className="text-lg font-bold text-main flex items-center gap-2">
								<Plus className="w-5 h-5 text-primary" />
								Nova Enquete da Temporada
							</h3>
							<button
								onClick={() => setIsCreateModalOpen(false)}
								className="text-muted hover:text-main text-lg font-semibold"
							>
								✕
							</button>
						</div>

						{createError && (
							<div className="mb-4 bg-red-500/10 border border-red-500/30 text-red-500 text-xs rounded-lg p-3 flex items-center gap-2">
								<AlertCircle className="w-4 h-4 shrink-0" />
								<span>{createError}</span>
							</div>
						)}

						<form onSubmit={handleCreatePollSubmit} className="space-y-4">
							<div>
								<label className="block text-xs font-semibold text-main mb-1">
									Título / Pergunta *
								</label>
								<input
									type="text"
									required
									placeholder="Ex: Quem foi o jogador mais regular do mês?"
									value={newTitle}
									onChange={(e) => setNewTitle(e.target.value)}
									className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm text-main focus:outline-none focus:border-primary"
								/>
							</div>

							<div>
								<label className="block text-xs font-semibold text-main mb-1">
									Descrição (opcional)
								</label>
								<textarea
									rows={2}
									placeholder="Detalhes ou regras desta enquete..."
									value={newDescription}
									onChange={(e) => setNewDescription(e.target.value)}
									className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm text-main focus:outline-none focus:border-primary"
								/>
							</div>

							<div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
								<label className="flex items-center gap-2 cursor-pointer bg-background border border-border rounded-lg p-3 text-xs font-medium text-main">
									<input
										type="checkbox"
										checked={newMultipleChoices}
										onChange={(e) => setNewMultipleChoices(e.target.checked)}
										className="w-4 h-4 rounded text-primary"
									/>
									<span>Permitir Múltipla Escolha</span>
								</label>

								<div>
									<label className="block text-xs font-semibold text-main mb-1">
										Prazo Final (opcional)
									</label>
									<input
										type="datetime-local"
										value={newEndsAt}
										onChange={(e) => setNewEndsAt(e.target.value)}
										className="w-full bg-background border border-border rounded-lg px-3 py-2 text-xs text-main focus:outline-none focus:border-primary"
									/>
								</div>
							</div>

							<div>
								<div className="flex items-center justify-between mb-2">
									<label className="text-xs font-semibold text-main">Opções de Resposta *</label>
									<button
										type="button"
										onClick={handleAddOptionField}
										className="text-xs text-primary hover:underline font-medium flex items-center gap-1"
									>
										<Plus className="w-3.5 h-3.5" /> Adicionar Opção
									</button>
								</div>

								<div className="space-y-2">
									{newOptions.map((opt, idx) => (
										<div key={idx} className="flex items-center gap-2">
											<input
												type="text"
												required
												placeholder={`Opção ${idx + 1}`}
												value={opt}
												onChange={(e) => handleOptionTextChange(idx, e.target.value)}
												className="flex-1 bg-background border border-border rounded-lg px-3 py-1.5 text-sm text-main focus:outline-none focus:border-primary"
											/>
											{newOptions.length > 2 && (
												<button
													type="button"
													onClick={() => handleRemoveOptionField(idx)}
													className="p-2 text-muted hover:text-red-500 rounded-lg hover:bg-background transition"
												>
													<Trash2 className="w-4 h-4" />
												</button>
											)}
										</div>
									))}
								</div>
							</div>

							<div className="pt-4 border-t border-border flex items-center justify-end gap-3">
								<button
									type="button"
									onClick={() => setIsCreateModalOpen(false)}
									className="px-4 py-2 border border-border rounded-lg text-xs font-semibold text-muted hover:text-main"
								>
									Cancelar
								</button>
								<button
									type="submit"
									disabled={createMutation.isPending}
									className="px-4 py-2 bg-primary hover:bg-primary/90 text-white rounded-lg text-xs font-semibold shadow-sm transition disabled:opacity-50"
								>
									{createMutation.isPending ? 'Criando...' : 'Salvar Enquete'}
								</button>
							</div>
						</form>
					</div>
				</div>
			)}
		</div>
	);
}
