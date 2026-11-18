'use client';

import React, { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/context/AuthContext';
import { fetchAPI } from '@/lib/api';
import { RoundVotingStatus, RoundVoteItem, Player } from '@/types/types';
import Link from 'next/link';
import {
	Award,
	CheckCircle2,
	AlertCircle,
	Clock,
	Lock,
	Unlock,
	UserCheck,
	UserPlus,
	Users,
	Sparkles,
	Check,
	Trophy,
	Shield,
	Flame,
	ThumbsDown,
	Target,
	HelpCircle,
	Save,
	RefreshCw,
	Gift,
	Crown,
	ExternalLink,
} from 'lucide-react';

interface RoundVotingTabProps {
	roundId: number;
	players: Player[];
	confirmedPlayerIds?: number[];
	awards?: any[];
	roundTeams?: any[];
	rouletteWinners?: any[];
}

const CATEGORY_META: Record<
	string,
	{ label: string; description: string; icon: React.ComponentType<{ className?: string }>; color: string }
> = {
	bola_cheia: {
		label: 'Bola Cheia (MVP)',
		description: 'Melhor jogador da rodada em atuação, liderança e regularidade.',
		icon: Trophy,
		color: 'text-amber-500 bg-amber-500/10 border-amber-500/30',
	},
	bola_murcha: {
		label: 'Bola Murcha',
		description: 'Pior atuação, trapalhadas ou momento esquecível da rodada.',
		icon: ThumbsDown,
		color: 'text-rose-500 bg-rose-500/10 border-rose-500/30',
	},
	gol_rodada: {
		label: 'Gol da Rodada',
		description: 'A pintura ou gol mais decisivo e bonito do dia.',
		icon: Target,
		color: 'text-emerald-500 bg-emerald-500/10 border-emerald-500/30',
	},
	defesa_rodada: {
		label: 'Defesa da Rodada',
		description: 'O milagre do goleiro que salvou a equipe.',
		icon: Shield,
		color: 'text-blue-500 bg-blue-500/10 border-blue-500/30',
	},
	drible_rodada: {
		label: 'Drible da Rodada',
		description: 'A jogada de efeito, caneta, lençol ou drible desconcertante.',
		icon: Flame,
		color: 'text-purple-500 bg-purple-500/10 border-purple-500/30',
	},
	inacreditavel: {
		label: 'Inacreditável',
		description: 'O lance surreal: gol inacreditavelmente perdido ou lance bizarro.',
		icon: HelpCircle,
		color: 'text-amber-600 bg-amber-600/10 border-amber-600/30',
	},
};

const ALL_AWARD_CATALOG = [
	{ key: 'time_vencedor_rodada', label: 'Time Campeão (Pizza)', icon: Crown, color: 'text-amber-500 bg-amber-500/10 border-amber-500/30' },
	{ key: 'bola_cheia', label: 'Bola Cheia (MVP)', icon: Trophy, color: 'text-amber-500 bg-amber-500/10 border-amber-500/30' },
	{ key: 'bola_murcha', label: 'Bola Murcha', icon: ThumbsDown, color: 'text-rose-500 bg-rose-500/10 border-rose-500/30' },
	{ key: 'gol_rodada', label: 'Gol da Rodada', icon: Target, color: 'text-emerald-500 bg-emerald-500/10 border-emerald-500/30' },
	{ key: 'defesa_rodada', label: 'Defesa da Rodada', icon: Shield, color: 'text-blue-500 bg-blue-500/10 border-blue-500/30' },
	{ key: 'drible_rodada', label: 'Drible da Rodada', icon: Flame, color: 'text-purple-500 bg-purple-500/10 border-purple-500/30' },
	{ key: 'inacreditavel', label: 'Inacreditável', icon: HelpCircle, color: 'text-amber-600 bg-amber-600/10 border-amber-600/30' },
	{ key: 'goleiro_menos_vazado', label: 'Goleiro Menos Vazado', icon: Shield, color: 'text-cyan-500 bg-cyan-500/10 border-cyan-500/30' },
	{ key: 'roleta', label: 'Roleta do Baba', icon: Gift, color: 'text-purple-500 bg-purple-500/10 border-purple-500/30' },
];

export default function RoundVotingTab({
	roundId,
	players,
	confirmedPlayerIds = [],
	awards: propAwards,
	roundTeams: propRoundTeams,
	rouletteWinners: propRouletteWinners,
}: RoundVotingTabProps) {
	const { user } = useAuth();
	const queryClient = useQueryClient();
	const isAdmin = Boolean(user?.is_admin || user?.role === 'admin');

	// Buscar prêmios oficiais da rodada (com fallback para prop)
	const { data: fetchedAwards = [] } = useQuery<any[]>({
		queryKey: ['awards', 'round', String(roundId)],
		queryFn: async () => {
			return await fetchAPI(`/awards/round/${roundId}`).catch(() => []);
		},
		initialData: propAwards,
	});
	const officialAwards = fetchedAwards && fetchedAwards.length > 0 ? fetchedAwards : (propAwards || []);

	// Buscar sorteios da roleta da rodada
	const { data: fetchedRoulette = [] } = useQuery<any[]>({
		queryKey: ['round-roulette', String(roundId)],
		queryFn: async () => {
			return await fetchAPI(`/roulette-prizes/round/${roundId}`).catch(() => []);
		},
		initialData: propRouletteWinners,
	});
	const officialRouletteWinners = fetchedRoulette && fetchedRoulette.length > 0 ? fetchedRoulette : (propRouletteWinners || []);
	const roundTeams = propRoundTeams || [];

	// Mapear os prêmios oficiais por event_type
	const officialAwardsMap = useMemo(() => {
		const map = new Map<string, any>();
		(officialAwards || []).forEach((a: any) => {
			map.set(a.event_type, a);
		});
		return map;
	}, [officialAwards]);

	const hasOfficialAwards = (officialAwards && officialAwards.length > 0) || (officialRouletteWinners && officialRouletteWinners.length > 0);

	// Votos selecionados no formulário pelo jurado: { [award_type]: playerId }
	const [formVotes, setFormVotes] = useState<Record<string, number>>({});
	const [formInitialized, setFormInitialized] = useState(false);

	// Estado para modal de designação de jurados
	const [isAssignModalOpen, setIsAssignModalOpen] = useState(false);
	const [selectedVoterUserIds, setSelectedVoterUserIds] = useState<number[]>([]);
	const [votersSearch, setVotersSearch] = useState('');

	// Mensagens de feedback
	const [feedbackMsg, setFeedbackMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(
		null,
	);

	// Buscar status da votação da rodada
	const {
		data: votingStatus,
		isLoading,
		refetch,
	} = useQuery<RoundVotingStatus>({
		queryKey: ['round_voting', roundId],
		queryFn: async () => {
			return await fetchAPI(`/rounds/${roundId}/voting`);
		},
	});

	// Buscar todos os usuários (apenas para Admin designar jurados)
	const { data: allUsers = [] } = useQuery<any[]>({
		queryKey: ['users'],
		queryFn: async () => {
			if (!isAdmin) return [];
			return await fetchAPI('/users/');
		},
		enabled: isAdmin,
	});

	// Preencher votos existentes do usuário no formulário
	React.useEffect(() => {
		if (votingStatus && !formInitialized) {
			const initial: Record<string, number> = {};
			votingStatus.user_votes.forEach((v) => {
				initial[v.award_type] = v.player_id;
			});

			// Se o usuário ainda não tiver votos salvos, mas a rodada já possui vencedores cadastrados,
			// auto-preenche o formulário com os vencedores registrados para facilitar a visualização e voto
			if (votingStatus.user_votes.length === 0 && officialAwards.length > 0) {
				Object.keys(CATEGORY_META).forEach((cat) => {
					const official = officialAwardsMap.get(cat);
					const pid = official?.players?.[0]?.id_player;
					if (pid) {
						initial[cat] = pid;
					}
				});
			}

			setFormVotes(initial);
			setFormInitialized(true);

			// Preencher lista de jurados selecionados
			setSelectedVoterUserIds(votingStatus.voters.map((v) => v.user_id));
		}
	}, [votingStatus, formInitialized, officialAwards, officialAwardsMap]);

	const handleFillFromOfficial = () => {
		const updated: Record<string, number> = { ...formVotes };
		let filledCount = 0;
		Object.keys(CATEGORY_META).forEach((cat) => {
			const official = officialAwardsMap.get(cat);
			const pid = official?.players?.[0]?.id_player;
			if (pid) {
				updated[cat] = pid;
				filledCount++;
			}
		});
		setFormVotes(updated);
		setFeedbackMsg({
			type: 'success',
			text: `${filledCount} categorias preenchidas com os vencedores cadastrados! Clique em "Salvar Meus Votos" para enviar.`,
		});
	};

	// Mutação: Alternar Votação Aberta/Fechada
	const toggleVotingMutation = useMutation({
		mutationFn: async (isOpen: boolean) => {
			return await fetchAPI(`/rounds/${roundId}/voting/toggle`, {
				method: 'POST',
				body: JSON.stringify({ is_open: isOpen }),
			});
		},
		onSuccess: (data) => {
			queryClient.setQueryData(['round_voting', roundId], data);
			queryClient.invalidateQueries({ queryKey: ['round', String(roundId)] });
			setFeedbackMsg({
				type: 'success',
				text: data.is_voting_open
					? hasOfficialAwards
						? 'Votação aberta para edição! O botão de designar jurados agora está disponível.'
						: 'Votação aberta aos jurados! O botão de designar jurados agora está disponível.'
					: 'Votação encerrada com sucesso. O botão de designar jurados foi bloqueado.',
			});
		},
		onError: (err: any) => {
			setFeedbackMsg({ type: 'error', text: err?.message || 'Erro ao alterar status da votação.' });
		},
	});

	// Mutação: Designar Jurados
	const assignVotersMutation = useMutation({
		mutationFn: async (userIds: number[]) => {
			return await fetchAPI(`/rounds/${roundId}/voting/voters`, {
				method: 'POST',
				body: JSON.stringify({ user_ids: userIds }),
			});
		},
		onSuccess: (data) => {
			queryClient.setQueryData(['round_voting', roundId], data);
			setIsAssignModalOpen(false);
			setFeedbackMsg({ type: 'success', text: 'Júri da rodada atualizado com sucesso!' });
		},
		onError: (err: any) => {
			setFeedbackMsg({ type: 'error', text: err?.message || 'Erro ao designar jurados.' });
		},
	});

	// Mutação: Submeter Votos
	const submitVotesMutation = useMutation({
		mutationFn: async (votes: RoundVoteItem[]) => {
			return await fetchAPI(`/rounds/${roundId}/voting/vote`, {
				method: 'POST',
				body: JSON.stringify({ votes }),
			});
		},
		onSuccess: (data) => {
			queryClient.setQueryData(['round_voting', roundId], data);
			setFeedbackMsg({ type: 'success', text: 'Seus votos foram registrados com sucesso!' });
		},
		onError: (err: any) => {
			setFeedbackMsg({ type: 'error', text: err?.message || 'Erro ao salvar votos.' });
		},
	});

	// Mutação: Consolidar Vencedores nos Prêmios Oficiais
	const applyAwardsMutation = useMutation({
		mutationFn: async () => {
			return await fetchAPI(`/rounds/${roundId}/voting/apply-awards`, {
				method: 'POST',
				body: JSON.stringify({ recalculate_scores: true }),
			});
		},
		onSuccess: (data) => {
			queryClient.invalidateQueries({ queryKey: ['awards', 'round', String(roundId)] });
			queryClient.invalidateQueries({ queryKey: ['scores', 'round', String(roundId)] });
			queryClient.invalidateQueries({ queryKey: ['round_voting', roundId] });
			setFeedbackMsg({
				type: 'success',
				text: data?.message || 'Vencedores consolidados nas premiações oficiais da rodada!',
			});
		},
		onError: (err: any) => {
			setFeedbackMsg({ type: 'error', text: err?.message || 'Erro ao consolidar vencedores.' });
		},
	});

	// Lista de candidatos ordenada: primeiro confirmados na rodada, depois demais
	const candidatePlayers = useMemo(() => {
		const confirmedSet = new Set(confirmedPlayerIds);
		const sorted = [...players].sort((a, b) => {
			const aConf = confirmedSet.has(a.id_player);
			const bConf = confirmedSet.has(b.id_player);
			if (aConf && !bConf) return -1;
			if (!aConf && bConf) return 1;
			return a.nome.localeCompare(b.nome);
		});
		return sorted;
	}, [players, confirmedPlayerIds]);

	// Jogadores presentes na rodada (confirmados na presença OU escalados em times)
	const roundPlayerIdSet = useMemo(() => {
		const ids = new Set<number>(confirmedPlayerIds || []);
		(roundTeams || []).forEach((t: any) => {
			(t.players || []).forEach((p: any) => ids.add(p.id_player));
		});
		return ids;
	}, [confirmedPlayerIds, roundTeams]);

	// Mapa de user_id -> Player para cruzar com allUsers
	const userToPlayerMap = useMemo(() => {
		const map = new Map<number, Player>();
		(players || []).forEach((p) => {
			if (p.user_id) map.set(p.user_id, p);
		});
		return map;
	}, [players]);

	// Usuários elegíveis para o júri: APENAS jogadores que estavam na rodada
	const roundEligibleUsers = useMemo(() => {
		return allUsers.filter((u) => {
			// 1. Verifica se tem player nos u.players que esteve na rodada
			const hasInUserPlayers = (u.players || []).some((p: any) =>
				roundPlayerIdSet.has(p.id_player),
			);
			if (hasInUserPlayers) return true;

			// 2. Verifica se está vinculado a um player pelo user_id
			const linkedPlayer = userToPlayerMap.get(u.id_user);
			if (linkedPlayer && roundPlayerIdSet.has(linkedPlayer.id_player)) {
				return true;
			}

			// 3. Se já era um jurado previamente salvo nesta rodada, mantém na lista para permitir desmarcar
			if (selectedVoterUserIds.includes(u.id_user)) {
				return true;
			}

			return false;
		});
	}, [allUsers, roundPlayerIdSet, userToPlayerMap, selectedVoterUserIds]);

	// Usuários filtrados para o modal de designar jurados
	const filteredUsers = useMemo(() => {
		if (!votersSearch.trim()) return roundEligibleUsers;
		const term = votersSearch.toLowerCase();
		return roundEligibleUsers.filter(
			(u) =>
				u.name?.toLowerCase().includes(term) ||
				u.email?.toLowerCase().includes(term) ||
				u.username?.toLowerCase().includes(term),
		);
	}, [roundEligibleUsers, votersSearch]);

	const handleCategoryVoteChange = (category: string, playerId: number) => {
		setFormVotes((prev) => ({ ...prev, [category]: playerId }));
		setFeedbackMsg(null);
	};

	const handleSaveVotes = () => {
		const items: RoundVoteItem[] = Object.entries(formVotes)
			.filter(([_, pid]) => Boolean(pid))
			.map(([cat, pid]) => ({ award_type: cat, player_id: pid }));

		if (items.length === 0) {
			setFeedbackMsg({ type: 'error', text: 'Selecione ao menos um voto antes de salvar.' });
			return;
		}

		submitVotesMutation.mutate(items);
	};

	const handleToggleUserSelection = (userId: number) => {
		setSelectedVoterUserIds((prev) =>
			prev.includes(userId) ? prev.filter((id) => id !== userId) : [...prev, userId],
		);
	};

	if (isLoading || !votingStatus) {
		return <div className="py-12 text-center text-muted">Carregando votação da rodada...</div>;
	}

	const isVotingOpen = votingStatus.is_voting_open;
	const isActualJuror = Boolean(votingStatus.is_user_voter);
	const canAccessVoteForm = isActualJuror || isAdmin;
	const canEditVotes = isVotingOpen || isAdmin;

	return (
		<div className="space-y-6">
			{/* Banner / Feedback */}
			{feedbackMsg && (
				<div
					className={`rounded-xl p-4 flex items-center justify-between gap-3 text-sm border ${
						feedbackMsg.type === 'success'
							? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-600 dark:text-emerald-400'
							: 'bg-red-500/10 border-red-500/30 text-red-500'
					}`}
				>
					<div className="flex items-center gap-2">
						{feedbackMsg.type === 'success' ? (
							<CheckCircle2 className="w-5 h-5 shrink-0" />
						) : (
							<AlertCircle className="w-5 h-5 shrink-0" />
						)}
						<span>{feedbackMsg.text}</span>
					</div>
					<button
						onClick={() => setFeedbackMsg(null)}
						className="text-xs opacity-70 hover:opacity-100"
					>
						✕
					</button>
				</div>
			)}

			{/* Cabeçalho de Status e Ações do Admin */}
			<div className="bg-surface border border-border rounded-2xl p-6 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
				<div>
					<div className="flex items-center gap-2 mb-1">
						<h2 className="text-xl font-bold text-main flex items-center gap-2">
							<Sparkles className="w-6 h-6 text-amber-500" />
							Votação dos Destaques da Rodada
						</h2>
						<span
							className={`text-xs px-2.5 py-0.5 rounded-full font-semibold flex items-center gap-1 ${
								isVotingOpen
									? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30'
									: 'bg-zinc-500/10 text-zinc-600 dark:text-zinc-400 border border-zinc-500/30'
							}`}
						>
							{isVotingOpen ? (
								<>
									<Unlock className="w-3 h-3" /> Votação Aberta
								</>
							) : (
								<>
									<Lock className="w-3 h-3" /> Votação Encerrada
								</>
							)}
						</span>
					</div>
					<p className="text-sm text-muted">
						Votação restrita para jurados designados. Categorias: Bola Cheia, Bola Murcha, Gol,
						Defesa, Drible e Inacreditável.
					</p>
				</div>

				{/* Ações do Admin */}
				{isAdmin && (
					<div className="flex flex-wrap items-center gap-2">
						<button
							onClick={() => {
								if (!isVotingOpen) return;
								setIsAssignModalOpen(true);
							}}
							disabled={!isVotingOpen}
							title={
								!isVotingOpen
									? hasOfficialAwards
										? 'Votação encerrada. Clique em "Editar Votação" para designar jurados.'
										: 'Votação encerrada. Abra a votação para designar jurados.'
									: 'Designar jurados participantes da rodada'
							}
							className={`inline-flex items-center gap-1.5 px-3 py-2 border text-xs font-semibold rounded-lg shadow-xs transition ${
								isVotingOpen
									? 'bg-surface hover:bg-background border-border text-main cursor-pointer'
									: 'bg-background/50 border-border/60 text-muted opacity-50 cursor-not-allowed'
							}`}
						>
							{isVotingOpen ? (
								<UserPlus className="w-4 h-4 text-primary" />
							) : (
								<Lock className="w-4 h-4 text-muted" />
							)}
							Designar Jurados ({votingStatus.voters.length})
						</button>

						<button
							onClick={() => toggleVotingMutation.mutate(!isVotingOpen)}
							disabled={toggleVotingMutation.isPending}
							className={`inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold rounded-lg shadow-xs transition cursor-pointer ${
								isVotingOpen
									? 'bg-amber-500/15 hover:bg-amber-500/25 text-amber-600 dark:text-amber-400 border border-amber-500/30'
									: hasOfficialAwards
									? 'bg-primary hover:bg-primary-hover text-white'
									: 'bg-emerald-600 hover:bg-emerald-500 text-white'
							}`}
						>
							{isVotingOpen ? (
								<>
									<Lock className="w-4 h-4" /> Fechar Votação
								</>
							) : hasOfficialAwards ? (
								<>
									<Unlock className="w-4 h-4" /> Editar Votação
								</>
							) : (
								<>
									<Unlock className="w-4 h-4" /> Abrir Votação
								</>
							)}
						</button>
					</div>
				)}
			</div>

			{/* Vencedores Oficiais Já Cadastrados nesta Rodada */}
			{hasOfficialAwards && (
				<div className="bg-gradient-to-br from-amber-500/10 via-surface to-surface border border-amber-500/30 rounded-2xl p-6 shadow-sm space-y-4">
					<div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-border">
						<div>
							<div className="flex items-center gap-2">
								<Trophy className="w-5 h-5 text-amber-500" />
								<h3 className="text-base font-bold text-main">
									Premiações Oficiais Definidas nesta Rodada
								</h3>
								<span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
									Cadastrado no Sistema
								</span>
							</div>
							<p className="text-xs text-muted mt-0.5">
								Vencedores já cadastrados oficialmente para a Rodada #{roundId}. A votação dos jurados abaixo pode ser usada para apuração ou nova consolidação.
							</p>
						</div>

						{isAdmin && (
							<Link
								href={`/awards?round=${roundId}`}
								className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-surface hover:bg-background border border-border text-primary transition shrink-0"
							>
								<Award className="w-3.5 h-3.5" />
								Gerenciar Prêmios Oficiais →
							</Link>
						)}
					</div>

					<div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
						{ALL_AWARD_CATALOG.map((cat) => {
							const IconComponent = cat.icon;
							const awardData = officialAwardsMap.get(cat.key);

							let winnerLabel = 'A definir';
							let isDefined = false;

							if (cat.key === 'time_vencedor_rodada') {
								const pizzaAward = officialAwardsMap.get('time_vencedor_rodada') || officialAwardsMap.get('pizza');
								if (pizzaAward?.teams?.length) {
									winnerLabel = pizzaAward.teams.map((t: any) => t.name).join(', ');
									isDefined = true;
								}
							} else if (cat.key === 'roleta') {
								if (officialRouletteWinners?.length) {
									winnerLabel = officialRouletteWinners
										.map(
											(w: any) =>
												w.player_name ||
												w.player?.apelido ||
												w.player?.nome ||
												`Boleiro #${w.player_id}`,
										)
										.join(', ');
									isDefined = true;
								} else if (awardData?.players?.length) {
									winnerLabel = awardData.players.map((p: any) => p.apelido || p.nome).join(', ');
									isDefined = true;
								}
							} else {
								if (awardData?.players?.length) {
									const p = awardData.players[0];
									winnerLabel = p.apelido ? `${p.nome} (${p.apelido})` : p.nome;
									isDefined = true;
								}
							}

							return (
								<div
									key={cat.key}
									className={`p-3 rounded-xl border flex items-center justify-between gap-3 ${
										isDefined
											? 'bg-surface border-amber-500/30 shadow-xs'
											: 'bg-background/40 border-border opacity-70'
									}`}
								>
									<div className="flex items-center gap-2.5 min-w-0">
										<span className={`p-2 rounded-lg border shrink-0 ${cat.color}`}>
											<IconComponent className="w-4 h-4" />
										</span>
										<div className="min-w-0">
											<span className="text-[11px] font-semibold text-muted block truncate">
												{cat.label}
											</span>
											<strong className="text-xs sm:text-sm font-bold text-main block truncate">
												{winnerLabel}
											</strong>
										</div>
									</div>

									{isDefined && (
										<span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-1.5 py-0.5 rounded shrink-0">
											✓
										</span>
									)}
								</div>
							);
						})}
					</div>
				</div>
			)}

			{/* Status do Júri */}
			<div className="bg-surface border border-border rounded-xl p-5 shadow-sm">
				<div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-3">
					<h3 className="text-sm font-bold text-main flex items-center gap-2">
						<Users className="w-4 h-4 text-primary" />
						Júri Designado ({votingStatus.voted_voters_count}/{votingStatus.total_voters_count}{' '}
						votaram)
					</h3>
					<div className="flex flex-wrap items-center gap-2">
						{isAdmin && (
							<button
								onClick={() => {
									if (!isVotingOpen) return;
									setIsAssignModalOpen(true);
								}}
								disabled={!isVotingOpen}
								title={
									!isVotingOpen
										? hasOfficialAwards
											? 'Clique em "Editar Votação" acima para gerenciar os jurados'
											: 'Abra a votação para designar jurados'
										: 'Designar ou alterar jurados da rodada'
								}
								className={`inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold rounded-lg border transition ${
									isVotingOpen
										? 'bg-surface hover:bg-background border-border text-main cursor-pointer'
										: 'bg-background/50 border-border/60 text-muted opacity-50 cursor-not-allowed'
								}`}
							>
								{isVotingOpen ? (
									<UserPlus className="w-3.5 h-3.5 text-primary" />
								) : (
									<Lock className="w-3.5 h-3.5 text-muted" />
								)}
								{isVotingOpen ? 'Gerenciar Jurados' : 'Jurados Bloqueados'}
							</button>
						)}
						{isActualJuror && (
							<span className="text-xs px-2.5 py-0.5 rounded-full bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/30 font-semibold flex items-center gap-1">
								<Check className="w-3 h-3" /> Você é jurado nesta rodada
							</span>
						)}
						{isAdmin && !isActualJuror && (
							<span className="text-xs px-2.5 py-0.5 rounded-full bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-500/30 font-semibold flex items-center gap-1">
								<Shield className="w-3 h-3" /> Painel de Administração
							</span>
						)}
					</div>
				</div>

				{votingStatus.voters.length === 0 ? (
					<div className="py-4 text-center text-xs text-muted border border-dashed border-border rounded-lg">
						{isAdmin && !isVotingOpen ? (
							<span>
								Nenhum jurado designado ainda. Clique em{' '}
								<strong className="text-main font-semibold">
									{hasOfficialAwards ? '"Editar Votação"' : '"Abrir Votação"'}
								</strong>{' '}
								acima para habilitar a designação de jurados.
							</span>
						) : isAdmin && isVotingOpen ? (
							<span>
								Nenhum jurado designado ainda.{' '}
								<button
									onClick={() => setIsAssignModalOpen(true)}
									className="text-primary font-semibold hover:underline inline-flex items-center gap-1 ml-1 cursor-pointer"
								>
									Clique aqui para designar os jurados da rodada
								</button>
							</span>
						) : (
							'Nenhum jurado designado ainda pelo administrador.'
						)}
					</div>
				) : (
					<div className="flex flex-wrap gap-2">
						{votingStatus.voters.map((voter) => (
							<div
								key={voter.id_voter}
								className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium border ${
									voter.has_voted
										? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30'
										: 'bg-zinc-500/10 text-zinc-600 dark:text-zinc-400 border-zinc-500/30'
								}`}
							>
								{voter.has_voted ? (
									<CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
								) : (
									<Clock className="w-3.5 h-3.5 text-zinc-400" />
								)}
								<span>{voter.user_name}</span>
								<span className="text-[10px] opacity-75">
									{voter.has_voted ? '(Votou)' : '(Pendente)'}
								</span>
							</div>
						))}
					</div>
				)}
			</div>

			{/* Formulário de Voto (Apenas se o usuário for jurado ou admin) */}
			{canAccessVoteForm ? (
				<div className="bg-surface border border-border rounded-2xl p-6 shadow-sm space-y-6">
					<div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-4 border-b border-border">
						<div>
							<div className="flex items-center gap-2">
								<h3 className="text-lg font-bold text-main flex items-center gap-2">
									<Save className="w-5 h-5 text-primary" />
									{isActualJuror
										? 'Seus Votos de Jurado'
										: 'Registro / Edição de Votos (Admin)'}
								</h3>
								{isAdmin && !isVotingOpen && (
									<span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/25">
										Modo Edição Admin
									</span>
								)}
							</div>
							<p className="text-xs text-muted mt-0.5">
								{isActualJuror
									? 'Selecione um jogador para cada categoria de destaque abaixo.'
									: 'Como administrador, você pode registrar e editar votos para esta rodada diretamente.'}
							</p>
							{hasOfficialAwards && canEditVotes && (
								<button
									type="button"
									onClick={handleFillFromOfficial}
									className="mt-2 inline-flex items-center gap-1.5 text-xs text-primary hover:underline font-semibold cursor-pointer"
								>
									<Sparkles className="w-3.5 h-3.5" />
									Preencher meus votos com os vencedores já cadastrados
								</button>
							)}
						</div>

						{canEditVotes ? (
							<button
								onClick={handleSaveVotes}
								disabled={submitVotesMutation.isPending}
								className="inline-flex items-center gap-1.5 px-4 py-2 bg-primary hover:bg-primary-hover text-white text-xs font-semibold rounded-lg shadow-sm transition disabled:opacity-50 cursor-pointer"
							>
								<Save className="w-4 h-4" />
								{submitVotesMutation.isPending
									? 'Salvando Votos...'
									: isAdmin && !isVotingOpen
									? 'Salvar Votos (Admin)'
									: 'Salvar Meus Votos'}
							</button>
						) : (
							<div className="text-xs text-muted flex items-center gap-1">
								<Lock className="w-3.5 h-3.5" /> Votação encerrada para envio
							</div>
						)}
					</div>

					{/* Grade das 6 categorias */}
					<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
						{Object.entries(CATEGORY_META).map(([catKey, meta]) => {
							const IconComponent = meta.icon;
							const currentSelectedId = formVotes[catKey] || 0;
							const official = officialAwardsMap.get(catKey);
							const officialWinner = official?.players?.[0];

							return (
								<div
									key={catKey}
									className="border border-border bg-background/50 rounded-xl p-4 flex flex-col justify-between gap-3"
								>
									<div>
										<div className="flex items-center gap-2 mb-1">
											<span className={`p-1.5 rounded-lg border ${meta.color}`}>
												<IconComponent className="w-4 h-4" />
											</span>
											<h4 className="font-bold text-sm text-main">{meta.label}</h4>
										</div>
										<p className="text-xs text-muted mb-2">{meta.description}</p>

										{officialWinner && (
											<div className="text-[11px] text-muted flex items-center gap-1.5 bg-surface px-2.5 py-1 rounded-lg border border-border/80 mb-2">
												<span className="text-amber-500 font-bold shrink-0">Vencedor cadastrado:</span>
												<strong className="text-main truncate">
													{officialWinner.apelido ? `${officialWinner.nome} (${officialWinner.apelido})` : officialWinner.nome}
												</strong>
											</div>
										)}
									</div>

									<div>
										<label className="block text-[11px] font-semibold text-muted uppercase tracking-wider mb-1">
											Jogador Escolhido
										</label>
										<select
											disabled={!canEditVotes}
											value={currentSelectedId}
											onChange={(e) =>
												handleCategoryVoteChange(catKey, Number(e.target.value))
											}
											className="w-full bg-surface border border-border rounded-lg px-3 py-2 text-xs text-main font-medium focus:outline-none focus:border-primary disabled:opacity-60 cursor-pointer"
										>
											<option value={0} className="bg-surface text-muted">
												-- Selecione o jogador --
											</option>
											{candidatePlayers.map((player) => {
												const isConfirmed = confirmedPlayerIds.includes(player.id_player);
												const isCurrentAwardWinner = officialWinner?.id_player === player.id_player;
												return (
													<option
														key={player.id_player}
														value={player.id_player}
														className="bg-surface text-main"
													>
														{player.nome}
														{player.apelido ? ` (${player.apelido})` : ''}
														{isCurrentAwardWinner ? ' 🏆 (Vencedor Atual)' : ''}
														{isConfirmed ? ' ⭐ (Presente)' : ''}
													</option>
												);
											})}
										</select>
									</div>
								</div>
							);
						})}
					</div>

					{canEditVotes && (
						<div className="pt-2 flex justify-end">
							<button
								onClick={handleSaveVotes}
								disabled={submitVotesMutation.isPending}
								className="inline-flex items-center gap-1.5 px-6 py-2.5 bg-primary hover:bg-primary-hover text-white text-xs font-semibold rounded-lg shadow-sm transition disabled:opacity-50 cursor-pointer"
							>
								<Save className="w-4 h-4" />
								{submitVotesMutation.isPending
									? 'Salvando Votos...'
									: isAdmin && !isVotingOpen
									? 'Salvar Votos (Admin)'
									: 'Salvar Meus Votos'}
							</button>
						</div>
					)}
				</div>
			) : (
				<div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-5 flex items-start gap-3">
					<Lock className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
					<div className="text-sm">
						<span className="font-semibold text-amber-600 dark:text-amber-400">
							Acesso Restrito ao Júri:
						</span>{' '}
						<span className="text-muted">
							Apenas os usuários designados pela administração podem votar nas premiações desta
							rodada. Acompanhe a apuração abaixo em tempo real.
						</span>
					</div>
				</div>
			)}

			{/* Apuração e Resultados em Tempo Real */}
			<div className="space-y-4">
				<div className="flex items-center justify-between">
					<h3 className="text-lg font-bold text-main flex items-center gap-2">
						<Trophy className="w-5 h-5 text-primary" />
						Apuração dos Votos ({votingStatus.tallies.length} categorias)
					</h3>
					<button
						onClick={() => refetch()}
						className="inline-flex items-center gap-1 text-xs text-muted hover:text-main"
					>
						<RefreshCw className="w-3.5 h-3.5" /> Atualizar
					</button>
				</div>

				<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
					{votingStatus.tallies.map((tally) => {
						const meta = CATEGORY_META[tally.award_type] || {
							label: tally.category_label,
							icon: Award,
							color: 'text-primary bg-primary/10 border-primary/30',
						};
						const IconComponent = meta.icon;
						const official = officialAwardsMap.get(tally.award_type);
						const officialWinner = official?.players?.[0];

						return (
							<div
								key={tally.award_type}
								className="bg-surface border border-border rounded-xl p-5 shadow-sm flex flex-col justify-between"
							>
								<div>
									{/* Topo do Card */}
									<div className="flex items-start justify-between gap-2 mb-3">
										<div className="flex items-center gap-2">
											<span className={`p-1.5 rounded-lg border ${meta.color}`}>
												<IconComponent className="w-4 h-4" />
											</span>
											<div>
												<h4 className="font-bold text-sm text-main">{tally.category_label}</h4>
												<span className="text-[11px] text-muted">
													{tally.total_votes} {tally.total_votes === 1 ? 'voto' : 'votos'}
												</span>
											</div>
										</div>

										{tally.leading_player_name && (
											<span className="text-[10px] px-2 py-0.5 rounded-md font-semibold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
												Líder
											</span>
										)}
									</div>

									{/* Vencedor Oficial Registrado no Sistema */}
									{officialWinner && (
										<div className="mb-3 px-3 py-2 rounded-lg bg-amber-500/10 border border-amber-500/20 flex items-center justify-between text-xs">
											<div className="flex items-center gap-1.5 truncate">
												<Trophy className="w-3.5 h-3.5 text-amber-500 shrink-0" />
												<span className="text-muted">Oficial:</span>
												<strong className="text-main truncate">
													{officialWinner.apelido
														? `${officialWinner.nome} (${officialWinner.apelido})`
														: officialWinner.nome}
												</strong>
											</div>
											<span className="text-[10px] font-bold text-amber-600 dark:text-amber-400 bg-amber-500/15 px-1.5 py-0.5 rounded uppercase shrink-0">
												Cadastrado
											</span>
										</div>
									)}

									{/* Lista de Candidatos e Percentual */}
									<div className="space-y-2 mt-2">
										{tally.candidates.length === 0 ? (
											<div className="py-4 px-2 text-center text-xs text-muted border border-dashed border-border rounded-lg space-y-1">
												<div>Nenhum voto do júri registrado ainda.</div>
												{officialWinner && (
													<div className="text-[11px] text-amber-600 dark:text-amber-400 font-medium">
														Vencedor já cadastrado:{' '}
														<strong>
															{officialWinner.apelido
																? `${officialWinner.nome} (${officialWinner.apelido})`
																: officialWinner.nome}
														</strong>
													</div>
												)}
											</div>
										) : (
											tally.candidates.map((cand, idx) => {
												const isLeader = idx === 0 && cand.votes_count > 0;
												return (
													<div
														key={cand.player_id}
														className={`relative overflow-hidden border rounded-lg p-2.5 transition ${
															isLeader
																? 'border-emerald-500/40 bg-emerald-500/5'
																: 'border-border bg-background/50'
														}`}
													>
														<div
															className={`absolute top-0 bottom-0 left-0 opacity-15 pointer-events-none transition-all duration-500 ${
																isLeader ? 'bg-emerald-500' : 'bg-primary'
															}`}
															style={{ width: `${cand.percentage}%` }}
														/>

														<div className="relative flex items-center justify-between text-xs">
															<span className="font-medium text-main truncate max-w-[160px]">
																{cand.player_name}
																{cand.player_apelido ? ` (${cand.player_apelido})` : ''}
															</span>
															<div className="flex items-center gap-2">
																<span className="text-muted">
																	{cand.votes_count}{' '}
																	{cand.votes_count === 1 ? 'voto' : 'votos'}
																</span>
																<span className="font-bold text-main min-w-[38px] text-right">
																	{cand.percentage}%
																</span>
															</div>
														</div>
													</div>
												);
											})
										)}
									</div>
								</div>
							</div>
						);
					})}
				</div>
			</div>

			{/* Modal de Designação de Jurados (Admin) */}
			{isAssignModalOpen && (
				<div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
					<div className="bg-surface border border-border rounded-xl w-full max-w-md p-6 shadow-2xl max-h-[90vh] flex flex-col">
						<div className="flex items-center justify-between pb-3 border-b border-border mb-4">
							<h3 className="text-base font-bold text-main flex items-center gap-2">
								<UserPlus className="w-5 h-5 text-primary" />
								Designar Jurados da Rodada
							</h3>
							<button
								onClick={() => setIsAssignModalOpen(false)}
								className="text-muted hover:text-main text-lg font-semibold"
							>
								✕
							</button>
						</div>

						<p className="text-xs text-muted mb-3">
							Selecione os usuários que participaram desta rodada para compor o júri de votação.
						</p>

						<input
							type="text"
							placeholder="Buscar usuário por nome ou email..."
							value={votersSearch}
							onChange={(e) => setVotersSearch(e.target.value)}
							className="w-full bg-background border border-border rounded-lg px-3 py-2 text-xs text-main focus:outline-none focus:border-primary mb-3"
						/>

						{/* Lista rolável de usuários elegíveis */}
						<div className="flex-1 overflow-y-auto space-y-2 max-h-[300px] pr-1">
							{filteredUsers.length === 0 ? (
								<div className="py-8 px-4 text-center text-xs text-muted border border-dashed border-border rounded-lg space-y-1">
									<p className="font-medium text-main">Nenhum jogador da rodada com conta de usuário</p>
									<p>Apenas jogadores que participaram desta rodada e possuem conta de usuário cadastrada podem ser designados como jurados.</p>
								</div>
							) : (
								filteredUsers.map((u) => {
									const isSelected = selectedVoterUserIds.includes(u.id_user);
									const linkedPlayer =
										userToPlayerMap.get(u.id_user) ||
										(u.players || []).find((p: any) => roundPlayerIdSet.has(p.id_player));

									return (
										<div
											key={u.id_user}
											onClick={() => handleToggleUserSelection(u.id_user)}
											className={`p-2.5 rounded-lg border text-xs flex items-center justify-between cursor-pointer transition ${
												isSelected
													? 'border-primary bg-primary/10 text-main'
													: 'border-border bg-background text-muted hover:border-border-hover'
											}`}
										>
											<div>
												<div className="font-semibold text-main flex items-center gap-1.5">
													<span>{u.name || u.username}</span>
													{linkedPlayer && (
														<span className="text-[10px] bg-primary/15 text-primary px-1.5 py-0.2 rounded font-medium">
															{linkedPlayer.apelido
																? `${linkedPlayer.nome} (${linkedPlayer.apelido})`
																: linkedPlayer.nome}
														</span>
													)}
												</div>
												<div className="text-[11px] text-muted">{u.email}</div>
											</div>
											<div
												className={`w-4 h-4 rounded border flex items-center justify-center ${
													isSelected
														? 'border-primary bg-primary text-white'
														: 'border-border bg-surface'
												}`}
											>
												{isSelected && <Check className="w-3 h-3 stroke-[3]" />}
											</div>
										</div>
									);
								})
							)}
						</div>

						<div className="pt-4 border-t border-border mt-4 flex items-center justify-between">
							<span className="text-xs text-muted">
								{selectedVoterUserIds.length} selecionado(s)
							</span>
							<div className="flex items-center gap-2">
								<button
									onClick={() => setIsAssignModalOpen(false)}
									className="px-3 py-1.5 border border-border rounded-lg text-xs font-semibold text-muted hover:text-main"
								>
									Cancelar
								</button>
								<button
									disabled={assignVotersMutation.isPending || !isVotingOpen}
									onClick={() => assignVotersMutation.mutate(selectedVoterUserIds)}
									className="px-4 py-1.5 bg-primary hover:bg-primary/90 text-white rounded-lg text-xs font-semibold shadow-sm transition disabled:opacity-50"
								>
									{assignVotersMutation.isPending ? 'Salvando...' : 'Salvar Jurados'}
								</button>
							</div>
						</div>
					</div>
				</div>
			)}
		</div>
	);
}
