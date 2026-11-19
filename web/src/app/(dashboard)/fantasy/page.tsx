'use client';

import React, { useState, useMemo, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/context/AuthContext';
import { fetchAPI } from '@/lib/api';
import {
	FantasySetting,
	FantasyRoundConfig,
	FantasyPlayer,
	FantasyTeam,
	FantasyLineup,
	FantasyRoundRankingResponse,
	FantasySeasonRankingResponse,
	FantasySlotRule,
} from '@/types/fantasy';
import { Season } from '@/types/types';
import {
	Gamepad2,
	Coins,
	TrendingUp,
	TrendingDown,
	Users,
	Trophy,
	Shield,
	Lock,
	Unlock,
	CheckCircle,
	AlertTriangle,
	Settings,
	X,
	Plus,
	Pencil,
	RefreshCw,
	Sparkles,
	Search,
	Minus,
	Eye,
} from 'lucide-react';
import { Select } from '@/components/Select';

interface RoundItem {
	id_round: number;
	round_number: number;
	date?: string | null;
	season_id: number;
}

function normalizePos(s: string): string {
	return s
		.toLowerCase()
		.normalize('NFD')
		.replace(/[\u0300-\u036f]/g, '')
		.replace(/es\b|s\b/g, '')
		.trim();
}

function matchesPosition(playerPos?: string | null, targetVal?: string | null): boolean {
	if (!playerPos || !targetVal) return false;
	const pNorm = normalizePos(playerPos);
	const targetTokens = targetVal
		.split(/[\/,]/)
		.map((t) => normalizePos(t))
		.filter(Boolean);

	return targetTokens.some((token) => pNorm.includes(token) || token.includes(pNorm));
}

export default function FantasyPage() {
	const { user } = useAuth();
	const queryClient = useQueryClient();
	const isAdmin = Boolean(user?.is_admin || user?.role === 'admin');

	// Temporada e Rodada selecionadas
	const [selectedSeasonId, setSelectedSeasonId] = useState<number | null>(null);
	const [selectedRoundId, setSelectedRoundId] = useState<number | null>(null);

	// Aba ativa
	const [activeTab, setActiveTab] = useState<'lineup' | 'market' | 'round_ranking' | 'season_ranking' | 'admin'>('lineup');

	// Estado local da escalação em edição: { [slotIndex]: FantasyPlayer }
	const [draftLineup, setDraftLineup] = useState<{ [slotIndex: number]: FantasyPlayer }>({});
	const [isPickingPlayerForSlot, setIsPickingPlayerForSlot] = useState<number | null>(null);
	const [searchPlayer, setSearchPlayer] = useState('');
	const [positionFilter, setPositionFilter] = useState('ALL');

	// Edição do nome do time
	const [isEditingTeamName, setIsEditingTeamName] = useState(false);
	const [newTeamName, setNewTeamName] = useState('');

	// Mensagens de feedback
	const [feedbackMsg, setFeedbackMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

	// Inspecionar escalação de outro participante
	const [inspectingTeam, setInspectingTeam] = useState<{
		teamId: number;
		teamName: string;
		userName: string;
	} | null>(null);

	// 1. Buscar Temporadas
	const { data: seasons = [] } = useQuery<Season[]>({
		queryKey: ['seasons'],
		queryFn: async () => fetchAPI('/seasons/'),
	});

	// Auto-selecionar temporada ativa
	useEffect(() => {
		if (seasons.length > 0 && selectedSeasonId === null) {
			const active = seasons.find((s) => s.is_active);
			setSelectedSeasonId(active ? active.id_season : seasons[0].id_season);
		}
	}, [seasons, selectedSeasonId]);

	// 2. Buscar Rodadas da Temporada
	const { data: rounds = [] } = useQuery<RoundItem[]>({
		queryKey: ['rounds', selectedSeasonId],
		queryFn: async () => {
			if (!selectedSeasonId) return [];
			return fetchAPI(`/rounds/season/${selectedSeasonId}`);
		},
		enabled: !!selectedSeasonId,
	});

	// Auto-selecionar última rodada
	useEffect(() => {
		if (rounds.length > 0 && (selectedRoundId === null || !rounds.some((r) => r.id_round === selectedRoundId))) {
			const sorted = [...rounds].sort((a, b) => b.round_number - a.round_number);
			setSelectedRoundId(sorted[0].id_round);
		}
	}, [rounds, selectedRoundId]);

	const currentRound = useMemo(() => rounds.find((r) => r.id_round === selectedRoundId), [rounds, selectedRoundId]);

	// 3. Status e Configurações do Fantasy
	const { data: fantasyStatus, isLoading: isLoadingStatus } = useQuery<{ is_enabled: boolean; initial_budget: number }>({
		queryKey: ['fantasy_status', selectedSeasonId],
		queryFn: async () => {
			if (!selectedSeasonId) return { is_enabled: false, initial_budget: 100 };
			try {
				return await fetchAPI(`/fantasy/status?season_id=${selectedSeasonId}`);
			} catch (e) {
				return { is_enabled: false, initial_budget: 100 };
			}
		},
		enabled: !!selectedSeasonId,
	});

	const { data: fantasySettings } = useQuery<FantasySetting>({
		queryKey: ['fantasy_settings', selectedSeasonId],
		queryFn: async () => fetchAPI(`/fantasy/settings?season_id=${selectedSeasonId}`),
		enabled: !!selectedSeasonId && fantasyStatus?.is_enabled === true,
	});

	// 4. Configuração da Rodada Atual
	const { data: roundConfig, refetch: refetchRoundConfig } = useQuery<FantasyRoundConfig>({
		queryKey: ['fantasy_round_config', selectedRoundId],
		queryFn: async () => {
			if (!selectedRoundId) return null;
			return fetchAPI(`/fantasy/rounds/${selectedRoundId}/config`);
		},
		enabled: !!selectedRoundId && fantasyStatus?.is_enabled === true,
	});

	// 5. Meu Time
	const { data: myTeam, refetch: refetchMyTeam } = useQuery<FantasyTeam>({
		queryKey: ['fantasy_my_team', selectedSeasonId],
		queryFn: async () => {
			if (!selectedSeasonId) return null;
			return fetchAPI(`/fantasy/my-team?season_id=${selectedSeasonId}`);
		},
		enabled: !!selectedSeasonId && fantasyStatus?.is_enabled === true,
	});

	// 6. Jogadores no Mercado
	const { data: marketPlayers = [], isLoading: isLoadingMarket } = useQuery<FantasyPlayer[]>({
		queryKey: ['fantasy_market', selectedSeasonId, selectedRoundId],
		queryFn: async () => {
			if (!selectedSeasonId) return [];
			const roundParam = selectedRoundId ? `&round_id=${selectedRoundId}` : '';
			return fetchAPI(`/fantasy/market?season_id=${selectedSeasonId}${roundParam}`);
		},
		enabled: !!selectedSeasonId && fantasyStatus?.is_enabled === true,
	});

	// 7. Minha Escalação salva na Rodada
	const { data: savedLineup, refetch: refetchLineup } = useQuery<FantasyLineup | null>({
		queryKey: ['fantasy_lineup', selectedRoundId],
		queryFn: async () => {
			if (!selectedRoundId) return null;
			return fetchAPI(`/fantasy/rounds/${selectedRoundId}/lineup`);
		},
		enabled: !!selectedRoundId && fantasyStatus?.is_enabled === true,
	});

	// 8. Rankings
	const { data: roundRankingData } = useQuery<FantasyRoundRankingResponse>({
		queryKey: ['fantasy_round_ranking', selectedRoundId],
		queryFn: async () => {
			if (!selectedRoundId) return null;
			return fetchAPI(`/fantasy/rankings/round/${selectedRoundId}`);
		},
		enabled: !!selectedRoundId && fantasyStatus?.is_enabled === true && (activeTab === 'round_ranking' || activeTab === 'lineup'),
	});

	const { data: seasonRankingData } = useQuery<FantasySeasonRankingResponse>({
		queryKey: ['fantasy_season_ranking', selectedSeasonId],
		queryFn: async () => {
			if (!selectedSeasonId) return null;
			return fetchAPI(`/fantasy/rankings/season?season_id=${selectedSeasonId}`);
		},
		enabled: !!selectedSeasonId && fantasyStatus?.is_enabled === true && activeTab === 'season_ranking',
	});

	// Escalação inspecionada de outro participante
	const {
		data: inspectedLineup,
		isLoading: isLoadingInspectedLineup,
		error: inspectedLineupError,
	} = useQuery<FantasyLineup | null>({
		queryKey: ['fantasy_inspected_lineup', selectedRoundId, inspectingTeam?.teamId],
		queryFn: async () => {
			if (!selectedRoundId || !inspectingTeam) return null;
			return fetchAPI(`/fantasy/rounds/${selectedRoundId}/lineup?team_id=${inspectingTeam.teamId}`);
		},
		enabled: !!selectedRoundId && !!inspectingTeam,
		retry: false,
	});

	// Sincroniza escalação salva com o draft ao carregar
	useEffect(() => {
		if (savedLineup && marketPlayers.length > 0) {
			const initialMap: { [slotIndex: number]: FantasyPlayer } = {};
			savedLineup.players.forEach((p, idx) => {
				const fp = marketPlayers.find((m) => m.player_id === p.player_id);
				if (fp) {
					initialMap[idx] = fp;
				}
			});
			setDraftLineup(initialMap);
		} else if (!savedLineup) {
			setDraftLineup({});
		}
	}, [savedLineup, marketPlayers]);

	// Mutação: Atualizar nome do time
	const updateTeamNameMutation = useMutation({
		mutationFn: async (name: string) => {
			return fetchAPI(`/fantasy/my-team?season_id=${selectedSeasonId}`, {
				method: 'PUT',
				body: JSON.stringify({ name }),
			});
		},
		onSuccess: () => {
			refetchMyTeam();
			setIsEditingTeamName(false);
			setFeedbackMsg({ type: 'success', text: 'Nome do time alterado com sucesso!' });
		},
		onError: (err: any) => {
			setFeedbackMsg({ type: 'error', text: err.message || 'Erro ao alterar nome do time.' });
		},
	});

	// Mutação: Salvar Escalação
	const saveLineupMutation = useMutation({
		mutationFn: async (players: { player_id: number; slot_label: string }[]) => {
			if (!selectedRoundId) throw new Error('Rodada não selecionada');
			return fetchAPI(`/fantasy/rounds/${selectedRoundId}/lineup`, {
				method: 'POST',
				body: JSON.stringify({ players }),
			});
		},
		onSuccess: () => {
			refetchLineup();
			refetchMyTeam();
			setFeedbackMsg({ type: 'success', text: 'Escalação salva com sucesso!' });
		},
		onError: (err: any) => {
			setFeedbackMsg({ type: 'error', text: err.message || 'Erro ao salvar escalação.' });
		},
	});

	// Mutação Admin: Ativar/Desativar Módulo
	const toggleModuleMutation = useMutation({
		mutationFn: async (enabled: boolean) => {
			return fetchAPI(`/fantasy/settings?season_id=${selectedSeasonId}`, {
				method: 'PUT',
				body: JSON.stringify({ is_enabled: enabled }),
			});
		},
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ['fantasy_status', selectedSeasonId] });
			queryClient.invalidateQueries({ queryKey: ['fantasy_settings', selectedSeasonId] });
			setFeedbackMsg({ type: 'success', text: 'Status do módulo Fantasy atualizado!' });
		},
	});

	// Mutação Admin: Abrir/Fechar Mercado
	const toggleMarketMutation = useMutation({
		mutationFn: async (isOpen: boolean) => {
			if (!selectedRoundId) throw new Error('Selecione uma rodada primeiro.');
			return fetchAPI(`/fantasy/rounds/${selectedRoundId}/config`, {
				method: 'PUT',
				body: JSON.stringify({ is_market_open: isOpen, status: isOpen ? 'OPEN' : 'CLOSED' }),
			});
		},
		onSuccess: (data: FantasyRoundConfig) => {
			if (data && selectedRoundId) {
				queryClient.setQueryData(['fantasy_round_config', selectedRoundId], data);
			}
			queryClient.invalidateQueries({ queryKey: ['fantasy_round_config'] });
			queryClient.invalidateQueries({ queryKey: ['fantasy_market'] });
			refetchRoundConfig();
			setFeedbackMsg({
				type: 'success',
				text: data?.is_market_open ? 'Mercado aberto com sucesso!' : 'Mercado fechado com sucesso!',
			});
		},
		onError: (err: any) => {
			setFeedbackMsg({ type: 'error', text: err.message || 'Erro ao alterar status do mercado.' });
		},
	});

	// Mutação Admin: Apurar Rodada
	const calculateRoundMutation = useMutation({
		mutationFn: async () => {
			if (!selectedRoundId) throw new Error('Selecione uma rodada primeiro.');
			return fetchAPI(`/fantasy/rounds/${selectedRoundId}/calculate`, {
				method: 'POST',
			});
		},
		onSuccess: (data: any) => {
			queryClient.invalidateQueries({ queryKey: ['fantasy_round_config'] });
			refetchRoundConfig();
			refetchLineup();
			refetchMyTeam();
			queryClient.invalidateQueries({ queryKey: ['fantasy_market'] });
			queryClient.invalidateQueries({ queryKey: ['fantasy_round_ranking'] });
			queryClient.invalidateQueries({ queryKey: ['fantasy_season_ranking'] });
			setFeedbackMsg({ type: 'success', text: data?.message || 'Rodada apurada com sucesso!' });
		},
		onError: (err: any) => {
			setFeedbackMsg({ type: 'error', text: err.message || 'Erro ao apurar rodada.' });
		},
	});

	// Slots configurados para a rodada
	const slotsList = useMemo(() => {
		if (!roundConfig) return [];
		const list: { slotIndex: number; rule: FantasySlotRule; label: string }[] = [];
		let currentIdx = 0;
		for (const rule of roundConfig.slot_rules) {
			for (let i = 0; i < rule.required_quantity; i++) {
				list.push({
					slotIndex: currentIdx++,
					rule,
					label: `${rule.target_value} #${i + 1}`,
				});
			}
		}
		return list;
	}, [roundConfig]);

	// Total gasto no rascunho de escalação
	const draftTotalSpent = useMemo(() => {
		return Object.values(draftLineup).reduce((acc, p) => acc + Number(p.current_price), 0);
	}, [draftLineup]);

	// Saldo restante no rascunho
	const userWealth = myTeam ? Number(myTeam.total_wealth) : (fantasyStatus?.initial_budget || 100);
	const draftRemainingBudget = userWealth - draftTotalSpent;

	// Salvar rascunho
	const handleSaveLineup = () => {
		if (!roundConfig) return;
		const players = Object.entries(draftLineup).map(([idxStr, p]) => {
			const idx = Number(idxStr);
			const slot = slotsList[idx];
			return {
				player_id: p.player_id,
				slot_label: slot ? slot.label : 'Titular',
			};
		});

		if (players.length !== roundConfig.total_slots) {
			setFeedbackMsg({
				type: 'error',
				text: `Preencha todas as ${roundConfig.total_slots} vagas antes de salvar!`,
			});
			return;
		}

		if (draftRemainingBudget < 0) {
			setFeedbackMsg({
				type: 'error',
				text: 'O valor da sua escalação ultrapassa o seu patrimônio disponível!',
			});
			return;
		}

		saveLineupMutation.mutate(players);
	};

	// Jogadores elegíveis para o slot selecionado
	const eligiblePlayersForSlot = useMemo(() => {
		if (isPickingPlayerForSlot === null || !roundConfig) return [];
		const targetSlot = slotsList[isPickingPlayerForSlot];
		if (!targetSlot) return [];

		const alreadyPickedIds = Object.entries(draftLineup)
			.filter(([idx]) => Number(idx) !== isPickingPlayerForSlot)
			.map(([_, p]) => p.player_id);

		return marketPlayers.filter((p) => {
			// Não pode ser jogador já selecionado em outro slot
			if (alreadyPickedIds.includes(p.player_id)) return false;

			// Filtro de Posição / Pote da regra do slot
			if (targetSlot.rule.slot_type === 'POSITION') {
				if (!matchesPosition(p.position, targetSlot.rule.target_value)) return false;
			} else if (targetSlot.rule.slot_type === 'POT') {
				const potNum = parseInt(targetSlot.rule.target_value.replace(/\D/g, ''), 10);
				if (p.pot !== potNum) return false;
			}

			// Filtro de busca textual
			if (searchPlayer) {
				const s = searchPlayer.toLowerCase();
				const matchName = p.player_name.toLowerCase().includes(s);
				const matchNick = (p.player_nickname || '').toLowerCase().includes(s);
				if (!matchName && !matchNick) return false;
			}

			return true;
		});
	}, [isPickingPlayerForSlot, roundConfig, slotsList, draftLineup, marketPlayers, searchPlayer]);

	if (isLoadingStatus) {
		return (
			<div className="flex flex-col items-center justify-center min-h-[400px] gap-3">
				<RefreshCw className="w-8 h-8 text-[#635bff] animate-spin" />
				<p className="text-sm text-muted">Carregando módulo Fantasy Game...</p>
			</div>
		);
	}

	// Caso o módulo esteja desativado para a temporada selecionada
	if (fantasyStatus && !fantasyStatus.is_enabled) {
		return (
			<div className="space-y-6">
				<div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-4 border-b border-border">
					<div>
						<h1 className="text-2xl font-black text-main tracking-tight flex items-center gap-2">
							<Gamepad2 className="text-[#635bff]" size={28} />
							Fantasy Game
						</h1>
						<p className="text-sm text-muted mt-1">
							Escale seus atletas do Baygon, valorize seu patrimônio e dispute a liderança rodada a rodada.
						</p>
					</div>

					{seasons.length > 0 && (
						<div className="w-56">
							<Select
								value={selectedSeasonId ?? ''}
								onChange={(e) => setSelectedSeasonId(Number(e.target.value))}
							>
								{seasons.map((s) => (
									<option key={s.id_season} value={s.id_season}>
										Temporada #{s.number} {s.is_active ? '(Ativa)' : ''}
									</option>
								))}
							</Select>
						</div>
					)}
				</div>

				<div className="p-8 rounded-2xl bg-surface border border-border text-center max-w-xl mx-auto my-12 shadow-sm space-y-4">
					<div className="w-16 h-16 rounded-2xl bg-[#635bff]/10 text-[#635bff] flex items-center justify-center mx-auto">
						<Lock size={32} />
					</div>
					<h2 className="text-xl font-bold text-main">Módulo Não Contratado ou Desativado</h2>
					<p className="text-sm text-muted">
						O Fantasy Game é um módulo exclusivo personalizável por temporada. Atualmente ele não está habilitado para esta associação/temporada.
					</p>

					{isAdmin && (
						<div className="pt-4 border-t border-border mt-4">
							<button
								type="button"
								onClick={() => toggleModuleMutation.mutate(true)}
								disabled={toggleModuleMutation.isPending}
								className="px-5 py-2.5 rounded-xl bg-[#635bff] text-white font-semibold text-sm hover:bg-[#533afd] transition-colors shadow-sm shadow-[#635bff]/25 inline-flex items-center gap-2"
							>
								<Sparkles size={16} />
								{toggleModuleMutation.isPending ? 'Ativando...' : 'Habilitar Módulo para esta Temporada'}
							</button>
						</div>
					)}
				</div>
			</div>
		);
	}

	return (
		<div className="space-y-6">
			{/* TOPO: Título, Seletores e Mensagens */}
			<div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4 pb-4 border-b border-border">
				<div>
					<h1 className="text-2xl font-black text-main tracking-tight flex items-center gap-2">
						<Gamepad2 className="text-[#635bff]" size={28} />
						Fantasy Game
					</h1>
					<p className="text-sm text-muted mt-1">
						Escale seus atletas do Baygon, valorize seu patrimônio e dispute a liderança da liga.
					</p>
				</div>

				<div className="flex flex-wrap items-center gap-3">
					{seasons.length > 0 && (
						<div className="w-48">
							<Select
								value={selectedSeasonId ?? ''}
								onChange={(e) => {
									setSelectedSeasonId(Number(e.target.value));
									setSelectedRoundId(null);
								}}
							>
								{seasons.map((s) => (
									<option key={s.id_season} value={s.id_season}>
										Temp. #{s.number} {s.is_active ? '(Ativa)' : ''}
									</option>
								))}
							</Select>
						</div>
					)}

					{rounds.length > 0 && (
						<div className="w-48">
							<Select
								value={selectedRoundId ?? ''}
								onChange={(e) => setSelectedRoundId(Number(e.target.value))}
							>
								{rounds.map((r) => (
									<option key={r.id_round} value={r.id_round}>
										Rodada #{r.round_number}
									</option>
								))}
							</Select>
						</div>
					)}
				</div>
			</div>

			{/* FEEDBACK TOAST / ALERT */}
			{feedbackMsg && (
				<div
					className={`p-4 rounded-xl text-sm font-medium flex items-center justify-between border ${
						feedbackMsg.type === 'success'
							? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-600 dark:text-emerald-400'
							: 'bg-rose-500/10 border-rose-500/20 text-rose-600 dark:text-rose-400'
					}`}
				>
					<div className="flex items-center gap-2">
						{feedbackMsg.type === 'success' ? <CheckCircle size={18} /> : <AlertTriangle size={18} />}
						<span>{feedbackMsg.text}</span>
					</div>
					<button
						type="button"
						onClick={() => setFeedbackMsg(null)}
						className="p-1 hover:opacity-75 transition-opacity"
					>
						<X size={16} />
					</button>
				</div>
			)}

			{/* CARD DE RESUMO DO MEU TIME & STATUS DO MERCADO */}
			{myTeam && (
				<div className="grid grid-cols-1 md:grid-cols-4 gap-4">
					{/* Nome do Time */}
					<div className="p-4 rounded-2xl bg-surface border border-border shadow-sm flex flex-col justify-between">
						<div className="text-xs font-semibold text-muted uppercase tracking-wider">Meu Time</div>
						<div className="flex items-center justify-between gap-2 mt-2">
							{isEditingTeamName ? (
								<div className="flex items-center gap-2 w-full">
									<input
										type="text"
										value={newTeamName}
										onChange={(e) => setNewTeamName(e.target.value)}
										className="w-full px-2 py-1 text-sm bg-background border border-border rounded-lg text-main focus:outline-none focus:ring-2 focus:ring-[#635bff]"
										placeholder="Nome do seu time"
									/>
									<button
										type="button"
										onClick={() => updateTeamNameMutation.mutate(newTeamName)}
										className="px-2 py-1 text-xs bg-[#635bff] text-white rounded-lg font-bold"
									>
										Salvar
									</button>
								</div>
							) : (
								<>
									<span className="font-bold text-main text-base truncate">{myTeam.name}</span>
									<button
										type="button"
										onClick={() => {
											setNewTeamName(myTeam.name);
											setIsEditingTeamName(true);
										}}
										className="text-muted hover:text-main p-1 rounded-md"
										title="Alterar nome do time"
									>
										<Pencil size={15} />
									</button>
								</>
							)}
						</div>
					</div>

					{/* Patrimônio Total */}
					<div className="p-4 rounded-2xl bg-surface border border-border shadow-sm">
						<div className="text-xs font-semibold text-muted uppercase tracking-wider flex items-center gap-1.5">
							<Coins size={14} className="text-amber-500" />
							Patrimônio Total
						</div>
						<div className="mt-2 flex items-baseline gap-2">
							<span className="text-2xl font-black text-main">
								C$ {Number(myTeam.total_wealth).toFixed(2)}
							</span>
						</div>
					</div>

					{/* Saldo Restante para Escalar */}
					<div className="p-4 rounded-2xl bg-surface border border-border shadow-sm">
						<div className="text-xs font-semibold text-muted uppercase tracking-wider flex items-center gap-1.5">
							<Coins size={14} className="text-[#635bff]" />
							Saldo em Caixa
						</div>
						<div className="mt-2 flex items-baseline gap-2">
							<span
								className={`text-2xl font-black ${
									draftRemainingBudget < 0 ? 'text-rose-500' : 'text-main'
								}`}
							>
								C$ {draftRemainingBudget.toFixed(2)}
							</span>
							<span className="text-xs text-muted">
								(Gasto: C$ {draftTotalSpent.toFixed(2)})
							</span>
						</div>
					</div>

					{/* Status do Mercado da Rodada */}
					<div className="p-4 rounded-2xl bg-surface border border-border shadow-sm flex flex-col justify-between">
						<div className="text-xs font-semibold text-muted uppercase tracking-wider">Status do Mercado</div>
						<div className="mt-2 flex items-center gap-2">
							{!roundConfig ? (
								<span className="px-3 py-1 rounded-full text-xs font-semibold bg-surface border border-border text-muted flex items-center gap-1.5">
									<RefreshCw size={13} className="animate-spin" />
									Carregando...
								</span>
							) : roundConfig.status === 'FINALIZED' ? (
								<span className="px-3 py-1 rounded-full text-xs font-black bg-blue-500/10 text-blue-500 border border-blue-500/20 flex items-center gap-1.5">
									<CheckCircle size={13} />
									Rodada Apurada
								</span>
							) : roundConfig.is_market_open ? (
								<span className="px-3 py-1 rounded-full text-xs font-black bg-emerald-500/10 text-emerald-500 border border-emerald-500/20 flex items-center gap-1.5 animate-pulse">
									<Unlock size={13} />
									Mercado Aberto
								</span>
							) : (
								<span className="px-3 py-1 rounded-full text-xs font-black bg-rose-500/10 text-rose-500 border border-rose-500/20 flex items-center gap-1.5">
									<Lock size={13} />
									Mercado Fechado
								</span>
							)}
						</div>
					</div>
				</div>
			)}

			{/* NAVEGAÇÃO DE ABAS */}
			<div className="flex border-b border-border gap-2 overflow-x-auto pb-1">
				<button
					type="button"
					onClick={() => setActiveTab('lineup')}
					className={`px-4 py-2.5 font-bold text-sm border-b-2 transition-colors whitespace-nowrap flex items-center gap-2 ${
						activeTab === 'lineup'
							? 'border-[#635bff] text-[#635bff]'
							: 'border-transparent text-muted hover:text-main'
					}`}
				>
					<Shield size={16} />
					Minha Escalação
				</button>

				<button
					type="button"
					onClick={() => setActiveTab('market')}
					className={`px-4 py-2.5 font-bold text-sm border-b-2 transition-colors whitespace-nowrap flex items-center gap-2 ${
						activeTab === 'market'
							? 'border-[#635bff] text-[#635bff]'
							: 'border-transparent text-muted hover:text-main'
					}`}
				>
					<Users size={16} />
					Mercado de Atletas
				</button>

				<button
					type="button"
					onClick={() => setActiveTab('round_ranking')}
					className={`px-4 py-2.5 font-bold text-sm border-b-2 transition-colors whitespace-nowrap flex items-center gap-2 ${
						activeTab === 'round_ranking'
							? 'border-[#635bff] text-[#635bff]'
							: 'border-transparent text-muted hover:text-main'
					}`}
				>
					<Trophy size={16} />
					Ranking da Rodada
				</button>

				<button
					type="button"
					onClick={() => setActiveTab('season_ranking')}
					className={`px-4 py-2.5 font-bold text-sm border-b-2 transition-colors whitespace-nowrap flex items-center gap-2 ${
						activeTab === 'season_ranking'
							? 'border-[#635bff] text-[#635bff]'
							: 'border-transparent text-muted hover:text-main'
					}`}
				>
					<Trophy size={16} className="text-amber-500" />
					Ranking Geral
				</button>

				{isAdmin && (
					<button
						type="button"
						onClick={() => setActiveTab('admin')}
						className={`px-4 py-2.5 font-bold text-sm border-b-2 transition-colors whitespace-nowrap flex items-center gap-2 ${
							activeTab === 'admin'
								? 'border-[#635bff] text-[#635bff]'
								: 'border-transparent text-muted hover:text-main'
						}`}
					>
						<Settings size={16} />
						Painel Admin
					</button>
				)}
			</div>

			{/* ================= ABA 1: MINHA ESCALAÇÃO ================= */}
			{activeTab === 'lineup' && (
				<div className="space-y-6">
					<div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
						<div>
							<h2 className="text-lg font-bold text-main">
								Formação da Rodada ({roundConfig?.total_slots || 5} Vagas)
							</h2>
							<p className="text-xs text-muted">
								Selecione os atletas respeitando as posições e o teto de patrimônio.
							</p>
						</div>

						{roundConfig?.is_market_open && roundConfig?.status === 'OPEN' && (
							<button
								type="button"
								onClick={handleSaveLineup}
								disabled={saveLineupMutation.isPending}
								className="px-5 py-2.5 rounded-xl bg-[#635bff] text-white font-bold text-sm hover:bg-[#533afd] transition-all shadow-sm shadow-[#635bff]/25 flex items-center gap-2"
							>
								<CheckCircle size={16} />
								{saveLineupMutation.isPending ? 'Salvando...' : 'Confirmar Escalação'}
							</button>
						)}
					</div>

					{/* GRID DOS SLOTS DE ESCALAÇÃO */}
					<div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
						{slotsList.map(({ slotIndex, label, rule }) => {
							const scaledPlayer = draftLineup[slotIndex];

							return (
								<div
									key={slotIndex}
									className={`p-4 rounded-2xl border transition-all flex flex-col justify-between min-h-[160px] ${
										scaledPlayer
											? 'bg-surface border-border shadow-sm'
											: 'bg-surface/50 border-dashed border-border hover:border-[#635bff]/50'
									}`}
								>
									<div>
										<div className="flex items-center justify-between gap-2 mb-2">
											<span className="text-xs font-bold uppercase tracking-wider text-[#635bff] bg-[#635bff]/10 px-2 py-0.5 rounded-md">
												{label}
											</span>
											{scaledPlayer && roundConfig?.is_market_open && (
												<button
													type="button"
													onClick={() => {
														const next = { ...draftLineup };
														delete next[slotIndex];
														setDraftLineup(next);
													}}
													className="text-muted hover:text-rose-500 p-1 transition-colors"
													title="Remover atleta da vaga"
												>
													<Minus size={14} />
												</button>
											)}
										</div>

										{scaledPlayer ? (
											<div className="space-y-1">
												<div className="font-black text-main text-sm truncate">
													{scaledPlayer.player_nickname || scaledPlayer.player_name}
												</div>
												<div className="text-xs text-muted truncate">
													{scaledPlayer.player_name}
												</div>
												<div className="flex items-center gap-2 pt-2">
													<span className="text-xs font-bold text-main">
														C$ {Number(scaledPlayer.current_price).toFixed(2)}
													</span>
													{scaledPlayer.last_round_points !== undefined && (
														<span className="text-xs font-semibold text-emerald-500">
															{Number(scaledPlayer.last_round_points).toFixed(1)} pts
														</span>
													)}
												</div>
											</div>
										) : (
											<div className="py-6 text-center text-muted">
												<p className="text-xs">Vaga Disponível</p>
												<span className="text-[11px] opacity-75">
													Exige: {rule.target_value}
												</span>
											</div>
										)}
									</div>

									{roundConfig?.is_market_open && roundConfig?.status === 'OPEN' && (
										<button
											type="button"
											onClick={() => {
												setIsPickingPlayerForSlot(slotIndex);
												setSearchPlayer('');
											}}
											className="mt-3 w-full py-1.5 rounded-lg bg-background border border-border text-xs font-bold text-main hover:bg-[#635bff] hover:text-white hover:border-[#635bff] transition-colors flex items-center justify-center gap-1.5"
										>
											{scaledPlayer ? <Pencil size={12} /> : <Plus size={12} />}
											{scaledPlayer ? 'Trocar Atleta' : 'Escalar'}
										</button>
									)}
								</div>
							);
						})}
					</div>

					{/* DETALHES DE PONTUAÇÃO SE A RODADA JÁ FOI APURADA */}
					{savedLineup && savedLineup.is_finalized && (
						<div className="p-6 rounded-2xl bg-surface border border-border space-y-4">
							<div className="flex items-center justify-between border-b border-border pb-3">
								<h3 className="font-bold text-main">Resumo do Desempenho na Rodada</h3>
								<div className="text-lg font-black text-emerald-500">
									+{Number(savedLineup.points_scored).toFixed(1)} pts
								</div>
							</div>

							<div className="overflow-x-auto">
								<table className="w-full text-left text-sm">
									<thead>
										<tr className="border-b border-border text-muted text-xs uppercase">
											<th className="py-2">Vaga</th>
											<th className="py-2">Atleta</th>
											<th className="py-2 text-right">Preço Pago</th>
											<th className="py-2 text-right">Pontos</th>
											<th className="py-2 text-right">Variação</th>
										</tr>
									</thead>
									<tbody className="divide-y divide-border">
										{savedLineup.players.map((lp) => (
											<tr key={lp.id_lineup_player} className="hover:bg-background/50">
												<td className="py-2.5 font-bold text-xs text-[#635bff]">{lp.slot_label}</td>
												<td className="py-2.5 font-semibold text-main">
													{lp.player_nickname || lp.player_name}
												</td>
												<td className="py-2.5 text-right text-muted">
													C$ {Number(lp.purchase_price).toFixed(2)}
												</td>
												<td className="py-2.5 text-right font-bold text-main">
													{Number(lp.points_earned).toFixed(1)}
												</td>
												<td className="py-2.5 text-right font-semibold">
													{Number(lp.price_variation) >= 0 ? (
														<span className="text-emerald-500 flex items-center justify-end gap-0.5">
															<TrendingUp size={12} />
															+C$ {Number(lp.price_variation).toFixed(2)}
														</span>
													) : (
														<span className="text-rose-500 flex items-center justify-end gap-0.5">
															<TrendingDown size={12} />
															-C$ {Math.abs(Number(lp.price_variation)).toFixed(2)}
														</span>
													)}
												</td>
											</tr>
										))}
									</tbody>
								</table>
							</div>
						</div>
					)}
				</div>
			)}

			{/* ================= ABA 2: MERCADO DE ATLETAS ================= */}
			{activeTab === 'market' && (
				<div className="space-y-4">
					<div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
						<div className="relative flex-1 max-w-md">
							<Search className="absolute left-3 top-2.5 text-muted" size={16} />
							<input
								type="text"
								value={searchPlayer}
								onChange={(e) => setSearchPlayer(e.target.value)}
								placeholder="Buscar por nome ou apelido..."
								className="w-full pl-9 pr-4 py-2 bg-surface border border-border rounded-xl text-sm text-main focus:outline-none focus:ring-2 focus:ring-[#635bff]"
							/>
						</div>

						<div className="w-48">
							<Select
								value={positionFilter}
								onChange={(e) => setPositionFilter(e.target.value)}
							>
								<option value="ALL">Todas as Posições</option>
								<option value="goleiro">Goleiros</option>
								<option value="defensor">Defensores</option>
								<option value="meia">Meias / Alas</option>
								<option value="atacante">Atacantes / Pivôs</option>
							</Select>
						</div>
					</div>

					<div className="overflow-x-auto rounded-2xl bg-surface border border-border shadow-sm">
						<table className="w-full text-left text-sm">
							<thead>
								<tr className="border-b border-border text-muted text-xs uppercase bg-surface/50">
									<th className="py-3 px-4">Atleta</th>
									<th className="py-3 px-4">Posição</th>
									<th className="py-3 px-4">Pote</th>
									<th className="py-3 px-4 text-right">Preço Atual</th>
									<th className="py-3 px-4 text-right">Última Variação</th>
									<th className="py-3 px-4 text-right">Última Pontuação</th>
									<th className="py-3 px-4 text-center">Status</th>
								</tr>
							</thead>
							<tbody className="divide-y divide-border">
								{marketPlayers
									.filter((p) => {
										if (positionFilter !== 'ALL') {
											if (!matchesPosition(p.position, positionFilter)) {
												return false;
											}
										}
										if (searchPlayer) {
											const s = searchPlayer.toLowerCase();
											return (
												p.player_name.toLowerCase().includes(s) ||
												(p.player_nickname || '').toLowerCase().includes(s)
											);
										}
										return true;
									})
									.map((p) => (
										<tr key={p.id_fantasy_player} className="hover:bg-background/50 transition-colors">
											<td className="py-3 px-4">
												<div className="font-bold text-main">{p.player_nickname || p.player_name}</div>
												<div className="text-xs text-muted">{p.player_name}</div>
											</td>
											<td className="py-3 px-4 text-muted text-xs font-semibold">
												{p.position || '-'}
											</td>
											<td className="py-3 px-4 text-xs">
												{p.pot ? (
													<span className="px-2 py-0.5 rounded-md bg-[#635bff]/10 text-[#635bff] font-bold">
														Pote {p.pot}
													</span>
												) : (
													'-'
												)}
											</td>
											<td className="py-3 px-4 text-right font-black text-main">
												C$ {Number(p.current_price).toFixed(2)}
											</td>
											<td className="py-3 px-4 text-right font-bold text-xs">
												{Number(p.last_variation) > 0 ? (
													<span className="text-emerald-500 flex items-center justify-end gap-0.5">
														<TrendingUp size={13} />
														+C$ {Number(p.last_variation).toFixed(2)}
													</span>
												) : Number(p.last_variation) < 0 ? (
													<span className="text-rose-500 flex items-center justify-end gap-0.5">
														<TrendingDown size={13} />
														-C$ {Math.abs(Number(p.last_variation)).toFixed(2)}
													</span>
												) : (
													<span className="text-muted">C$ 0.00</span>
												)}
											</td>
											<td className="py-3 px-4 text-right font-bold text-main">
												{Number(p.last_round_points).toFixed(1)} pts
											</td>
											<td className="py-3 px-4 text-center">
												<span className="px-2.5 py-1 rounded-full text-[11px] font-bold bg-emerald-500/10 text-emerald-500 border border-emerald-500/20">
													Provável
												</span>
											</td>
										</tr>
									))}
							</tbody>
						</table>
					</div>
				</div>
			)}

			{/* ================= ABA 3: RANKING DA RODADA ================= */}
			{activeTab === 'round_ranking' && (
				<div className="space-y-4">
					<div className="overflow-x-auto rounded-2xl bg-surface border border-border shadow-sm">
						<table className="w-full text-left text-sm">
							<thead>
								<tr className="border-b border-border text-muted text-xs uppercase bg-surface/50">
									<th className="py-3 px-4 w-16 text-center">Pos</th>
									<th className="py-3 px-4">Time</th>
									<th className="py-3 px-4">Dono</th>
									<th className="py-3 px-4 text-right">Pontos na Rodada</th>
									<th className="py-3 px-4 text-right">Patrimônio</th>
									<th className="py-3 px-4 text-center">Escalação</th>
								</tr>
							</thead>
							<tbody className="divide-y divide-border">
								{roundRankingData?.rankings.map((entry) => (
									<tr
										key={entry.team_id}
										className={`hover:bg-background/50 transition-colors ${
											entry.user_id === user?.id_user ? 'bg-[#635bff]/5' : ''
										}`}
									>
										<td className="py-3 px-4 text-center font-black">
											{entry.position === 1 ? (
												<span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-amber-500/10 text-amber-500 text-xs font-black">
													1º
												</span>
											) : entry.position === 2 ? (
												<span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-slate-300/20 text-slate-400 text-xs font-black">
													2º
												</span>
											) : entry.position === 3 ? (
												<span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-amber-700/10 text-amber-700 text-xs font-black">
													3º
												</span>
											) : (
												<span className="text-muted text-xs">{entry.position}º</span>
											)}
										</td>
										<td className="py-3 px-4 font-bold text-main">
											{entry.team_name}
											{entry.user_id === user?.id_user && (
												<span className="ml-2 px-1.5 py-0.5 rounded text-[10px] bg-[#635bff] text-white">
													Você
												</span>
											)}
										</td>
										<td className="py-3 px-4 text-muted text-xs">{entry.user_name}</td>
										<td className="py-3 px-4 text-right font-black text-main">
											{Number(entry.points).toFixed(1)} pts
										</td>
										<td className="py-3 px-4 text-right font-bold text-muted">
											C$ {Number(entry.total_wealth).toFixed(2)}
										</td>
										<td className="py-3 px-4 text-center">
											{entry.has_lineup ? (
												<button
													type="button"
													onClick={() =>
														setInspectingTeam({
															teamId: entry.team_id,
															teamName: entry.team_name,
															userName: entry.user_name,
														})
													}
													className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-bold bg-[#635bff]/10 text-[#635bff] hover:bg-[#635bff] hover:text-white transition-all shadow-xs cursor-pointer"
													title="Ver escalação deste time"
												>
													<Eye size={13} />
													Ver Time
												</button>
											) : (
												<span className="px-2 py-0.5 rounded-full text-[11px] font-medium bg-surface text-muted border border-border/50">
													Não escalou
												</span>
											)}
										</td>
									</tr>
								))}
							</tbody>
						</table>
					</div>
				</div>
			)}

			{/* ================= ABA 4: RANKING GERAL ================= */}
			{activeTab === 'season_ranking' && (
				<div className="space-y-4">
					<div className="overflow-x-auto rounded-2xl bg-surface border border-border shadow-sm">
						<table className="w-full text-left text-sm">
							<thead>
								<tr className="border-b border-border text-muted text-xs uppercase bg-surface/50">
									<th className="py-3 px-4 w-16 text-center">Pos</th>
									<th className="py-3 px-4">Time</th>
									<th className="py-3 px-4">Dono</th>
									<th className="py-3 px-4 text-right">Pontos Totais</th>
									<th className="py-3 px-4 text-right">Patrimônio Acumulado</th>
									<th className="py-3 px-4 text-center">Escalação</th>
								</tr>
							</thead>
							<tbody className="divide-y divide-border">
								{seasonRankingData?.rankings.map((entry) => (
									<tr
										key={entry.team_id}
										className={`hover:bg-background/50 transition-colors ${
											entry.user_id === user?.id_user ? 'bg-[#635bff]/5' : ''
										}`}
									>
										<td className="py-3 px-4 text-center font-black">
											{entry.position === 1 ? (
												<span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-amber-500 text-white text-xs font-black shadow-sm">
													1º
												</span>
											) : (
												<span className="text-muted text-xs">{entry.position}º</span>
											)}
										</td>
										<td className="py-3 px-4 font-bold text-main">
											{entry.team_name}
											{entry.user_id === user?.id_user && (
												<span className="ml-2 px-1.5 py-0.5 rounded text-[10px] bg-[#635bff] text-white">
													Você
												</span>
											)}
										</td>
										<td className="py-3 px-4 text-muted text-xs">{entry.user_name}</td>
										<td className="py-3 px-4 text-right font-black text-main text-base">
											{Number(entry.points).toFixed(1)} pts
										</td>
										<td className="py-3 px-4 text-right font-bold text-amber-500">
											C$ {Number(entry.total_wealth).toFixed(2)}
										</td>
										<td className="py-3 px-4 text-center">
											<button
												type="button"
												onClick={() =>
													setInspectingTeam({
														teamId: entry.team_id,
														teamName: entry.team_name,
														userName: entry.user_name,
													})
												}
												className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold bg-surface border border-border text-muted hover:text-main hover:border-[#635bff]/40 transition-all cursor-pointer"
												title="Ver time deste participante na rodada selecionada"
											>
												<Eye size={13} />
												Ver Time
											</button>
										</td>
									</tr>
								))}
							</tbody>
						</table>
					</div>
				</div>
			)}

			{/* ================= ABA 5: PAINEL ADMIN ================= */}
			{activeTab === 'admin' && isAdmin && (
				<div className="space-y-6 max-w-4xl">
					{/* Controle do Mercado */}
					<div className="p-6 rounded-2xl bg-surface border border-border shadow-sm space-y-4">
						<h3 className="font-bold text-main text-base">Operação da Rodada</h3>
						<p className="text-xs text-muted">
							Abra ou feche o mercado para a rodada atual e execute a apuração automática após o lançamento da súmula.
						</p>

						<div className="flex flex-wrap items-center gap-3 pt-2">
							{roundConfig?.is_market_open ? (
								<button
									type="button"
									onClick={() => toggleMarketMutation.mutate(false)}
									disabled={toggleMarketMutation.isPending}
									className="px-4 py-2 rounded-xl bg-rose-500 text-white font-bold text-xs hover:bg-rose-600 transition-colors flex items-center gap-2"
								>
									<Lock size={14} />
									Fechar Mercado Agora
								</button>
							) : (
								<button
									type="button"
									onClick={() => toggleMarketMutation.mutate(true)}
									disabled={toggleMarketMutation.isPending}
									className="px-4 py-2 rounded-xl bg-emerald-500 text-white font-bold text-xs hover:bg-emerald-600 transition-colors flex items-center gap-2"
								>
									<Unlock size={14} />
									Reabrir Mercado
								</button>
							)}

							<button
								type="button"
								onClick={() => {
									if (confirm('Deseja apurar e liquidar esta rodada? Os pontos dos atletas serão processados e os preços atualizados.')) {
										calculateRoundMutation.mutate();
									}
								}}
								disabled={calculateRoundMutation.isPending}
								className="px-4 py-2 rounded-xl bg-[#635bff] text-white font-bold text-xs hover:bg-[#533afd] transition-colors flex items-center gap-2"
							>
								<RefreshCw className={calculateRoundMutation.isPending ? 'animate-spin' : ''} size={14} />
								{calculateRoundMutation.isPending ? 'Apurando...' : 'Apurar Rodada Oficial'}
							</button>
						</div>
					</div>

					{/* Configurações Gerais do Módulo */}
					{fantasySettings && (
						<div className="p-6 rounded-2xl bg-surface border border-border shadow-sm space-y-4">
							<h3 className="font-bold text-main text-base">Configurações Econômicas da Temporada</h3>
							<div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
								<div className="p-3 bg-background rounded-xl border border-border">
									<div className="text-muted">Orçamento Inicial</div>
									<div className="font-bold text-main text-sm mt-1">C$ {Number(fantasySettings.initial_budget).toFixed(2)}</div>
								</div>
								<div className="p-3 bg-background rounded-xl border border-border">
									<div className="text-muted">Preço Mínimo do Atleta</div>
									<div className="font-bold text-main text-sm mt-1">C$ {Number(fantasySettings.min_player_price).toFixed(2)}</div>
								</div>
								<div className="p-3 bg-background rounded-xl border border-border">
									<div className="text-muted">Variação Máxima por Rodada</div>
									<div className="font-bold text-main text-sm mt-1">± C$ {Number(fantasySettings.max_price_variation).toFixed(2)}</div>
								</div>
								<div className="p-3 bg-background rounded-xl border border-border">
									<div className="text-muted">Fator de Sensibilidade (K)</div>
									<div className="font-bold text-main text-sm mt-1">{Number(fantasySettings.appreciation_factor).toFixed(2)}</div>
								</div>
							</div>
						</div>
					)}
				</div>
			)}

			{/* MODAL DE SELEÇÃO DE ATLETA PARA VAGA */}
			{isPickingPlayerForSlot !== null && (
				<div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
					<div className="bg-surface border border-border rounded-2xl w-full max-w-xl max-h-[85vh] flex flex-col shadow-2xl">
						<div className="p-4 border-b border-border flex items-center justify-between">
							<div>
								<h3 className="font-bold text-main text-base">
									Selecionar Atleta ({slotsList[isPickingPlayerForSlot]?.label})
								</h3>
								<p className="text-xs text-muted">
									Exige posição: {slotsList[isPickingPlayerForSlot]?.rule.target_value}
								</p>
							</div>
							<button
								type="button"
								onClick={() => setIsPickingPlayerForSlot(null)}
								className="text-muted hover:text-main p-1.5 rounded-lg"
							>
								<X size={18} />
							</button>
						</div>

						<div className="p-4 border-b border-border">
							<div className="relative">
								<Search className="absolute left-3 top-2.5 text-muted" size={16} />
								<input
									type="text"
									value={searchPlayer}
									onChange={(e) => setSearchPlayer(e.target.value)}
									placeholder="Buscar atleta pelo nome ou apelido..."
									className="w-full pl-9 pr-4 py-2 bg-background border border-border rounded-xl text-sm text-main focus:outline-none focus:ring-2 focus:ring-[#635bff]"
								/>
							</div>
						</div>

						<div className="p-4 overflow-y-auto space-y-2 flex-1">
							{eligiblePlayersForSlot.length === 0 ? (
								<div className="text-center py-8 text-muted text-sm">
									Nenhum atleta encontrado para os critérios desta vaga.
								</div>
							) : (
								eligiblePlayersForSlot.map((p) => {
									const cost = Number(p.current_price);
									const canAfford = draftRemainingBudget + (draftLineup[isPickingPlayerForSlot]?.current_price ? Number(draftLineup[isPickingPlayerForSlot].current_price) : 0) >= cost;

									return (
										<div
											key={p.id_fantasy_player}
											className={`p-3 rounded-xl border flex items-center justify-between transition-colors ${
												canAfford
													? 'bg-background border-border hover:border-[#635bff]'
													: 'opacity-50 bg-background/50 border-border cursor-not-allowed'
											}`}
										>
											<div>
												<div className="font-bold text-sm text-main">
													{p.player_nickname || p.player_name}
												</div>
												<div className="text-xs text-muted flex items-center gap-2">
													<span>{p.position || 'Geral'}</span>
													{p.pot && <span>• Pote {p.pot}</span>}
													<span>• Média: {Number(p.last_round_points).toFixed(1)} pts</span>
												</div>
											</div>

											<div className="flex items-center gap-3">
												<span className="font-black text-sm text-main">
													C$ {cost.toFixed(2)}
												</span>
												<button
													type="button"
													disabled={!canAfford}
													onClick={() => {
														setDraftLineup({
															...draftLineup,
															[isPickingPlayerForSlot]: p,
														});
														setIsPickingPlayerForSlot(null);
													}}
													className="px-3 py-1.5 rounded-lg bg-[#635bff] text-white font-bold text-xs hover:bg-[#533afd] transition-colors disabled:opacity-50"
												>
													Escolher
												</button>
											</div>
										</div>
									);
								})
							)}
						</div>
					</div>
				</div>
			)}

			{/* MODAL DE VISUALIZAÇÃO DE TIME DE OUTRO PARTICIPANTE */}
			{inspectingTeam !== null && (
				<div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
					<div className="bg-surface border border-border rounded-2xl w-full max-w-2xl max-h-[85vh] flex flex-col shadow-2xl">
						{/* Header */}
						<div className="p-4 border-b border-border flex items-center justify-between">
							<div>
								<div className="flex items-center gap-2">
									<h3 className="font-bold text-main text-base">
										{inspectingTeam.teamName}
									</h3>
									{inspectingTeam.teamId === myTeam?.id_fantasy_team && (
										<span className="px-1.5 py-0.5 rounded text-[10px] bg-[#635bff] text-white font-bold">
											Seu Time
										</span>
									)}
								</div>
								<p className="text-xs text-muted">
									Treinador(a): <strong className="text-main">{inspectingTeam.userName}</strong> • {currentRound?.round_number ? `Rodada ${currentRound.round_number}` : 'Rodada'}
								</p>
							</div>
							<button
								type="button"
								onClick={() => setInspectingTeam(null)}
								className="text-muted hover:text-main p-1.5 rounded-lg transition-colors cursor-pointer"
								title="Fechar"
							>
								<X size={18} />
							</button>
						</div>

						{/* Content */}
						<div className="p-5 overflow-y-auto space-y-4 flex-1">
							{isLoadingInspectedLineup ? (
								<div className="py-12 flex flex-col items-center justify-center gap-2 text-muted">
									<RefreshCw className="animate-spin text-[#635bff]" size={24} />
									<span className="text-xs">Carregando escalação...</span>
								</div>
							) : inspectedLineupError ? (
								<div className="py-10 px-4 text-center space-y-3 bg-surface/50 border border-border rounded-2xl">
									<div className="w-12 h-12 rounded-full bg-amber-500/10 text-amber-500 mx-auto flex items-center justify-center">
										<Lock size={22} />
									</div>
									<h4 className="font-bold text-main text-sm">Escalação em Sigilo</h4>
									<p className="text-xs text-muted max-w-sm mx-auto leading-relaxed">
										{inspectedLineupError instanceof Error
											? inspectedLineupError.message
											: 'A escalação de outros participantes fica oculta enquanto o mercado da rodada estiver aberto.'}
									</p>
								</div>
							) : !inspectedLineup ? (
								<div className="py-12 text-center space-y-2">
									<p className="text-sm font-bold text-main">Nenhuma escalação enviada</p>
									<p className="text-xs text-muted">Este participante não confirmou atletas para esta rodada.</p>
								</div>
							) : (
								<div className="space-y-4">
									{/* Resumo da Escalação */}
									<div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
										<div className="p-3 rounded-xl bg-background border border-border">
											<span className="text-[11px] text-muted block">Pontos na Rodada</span>
											<span className="text-base font-black text-emerald-500">
												+{Number(inspectedLineup.points_scored).toFixed(1)} pts
											</span>
										</div>
										<div className="p-3 rounded-xl bg-background border border-border">
											<span className="text-[11px] text-muted block">Gasto Total</span>
											<span className="text-base font-black text-main">
												C$ {Number(inspectedLineup.total_spent).toFixed(2)}
											</span>
										</div>
										<div className="p-3 rounded-xl bg-background border border-border">
											<span className="text-[11px] text-muted block">Saldo Restante</span>
											<span className="text-base font-black text-muted">
												C$ {Number(inspectedLineup.cash_remaining).toFixed(2)}
											</span>
										</div>
										<div className="p-3 rounded-xl bg-background border border-border">
											<span className="text-[11px] text-muted block">Variação Patrimonial</span>
											<span className={`text-base font-black ${
												Number(inspectedLineup.wealth_variation) >= 0 ? 'text-emerald-500' : 'text-rose-500'
											}`}>
												{Number(inspectedLineup.wealth_variation) >= 0 ? '+' : ''}
												C$ {Number(inspectedLineup.wealth_variation).toFixed(2)}
											</span>
										</div>
									</div>

									{/* Lista dos Atletas */}
									<div className="rounded-xl border border-border overflow-hidden">
										<table className="w-full text-left text-sm">
											<thead>
												<tr className="border-b border-border text-muted text-xs uppercase bg-surface/50">
													<th className="py-2.5 px-3">Vaga</th>
													<th className="py-2.5 px-3">Atleta</th>
													<th className="py-2.5 px-3 text-right">Preço Pago</th>
													<th className="py-2.5 px-3 text-right">Pontos</th>
													<th className="py-2.5 px-3 text-right">Variação</th>
												</tr>
											</thead>
											<tbody className="divide-y divide-border">
												{inspectedLineup.players.map((lp) => (
													<tr key={lp.id_lineup_player} className="hover:bg-background/50">
														<td className="py-2.5 px-3 font-bold text-xs text-[#635bff]">
															{lp.slot_label}
														</td>
														<td className="py-2.5 px-3">
															<div className="font-bold text-main text-xs">
																{lp.player_nickname || lp.player_name}
															</div>
															{lp.player_nickname && (
																<div className="text-[11px] text-muted">
																	{lp.player_name}
																</div>
															)}
														</td>
														<td className="py-2.5 px-3 text-right text-muted text-xs">
															C$ {Number(lp.purchase_price).toFixed(2)}
														</td>
														<td className="py-2.5 px-3 text-right font-black text-main text-xs">
															{Number(lp.points_earned).toFixed(1)} pts
														</td>
														<td className="py-2.5 px-3 text-right font-semibold text-xs">
															{Number(lp.price_variation) >= 0 ? (
																<span className="text-emerald-500 inline-flex items-center justify-end gap-0.5">
																	<TrendingUp size={12} />
																	+C$ {Number(lp.price_variation).toFixed(2)}
																</span>
															) : (
																<span className="text-rose-500 inline-flex items-center justify-end gap-0.5">
																	<TrendingDown size={12} />
																	-C$ {Math.abs(Number(lp.price_variation)).toFixed(2)}
																</span>
															)}
														</td>
													</tr>
												))}
											</tbody>
										</table>
									</div>
								</div>
							)}
						</div>

						{/* Footer */}
						<div className="p-4 border-t border-border flex justify-end">
							<button
								type="button"
								onClick={() => setInspectingTeam(null)}
								className="px-4 py-2 rounded-xl bg-background border border-border text-xs font-bold text-main hover:bg-surface transition-colors cursor-pointer"
							>
								Fechar
							</button>
						</div>
					</div>
				</div>
			)}
		</div>
	);
}
