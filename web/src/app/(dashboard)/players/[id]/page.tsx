'use client';

import { Input } from '@/components/Input';
import { Loading } from '@/components/Loading';
import {
	MultiSeriesTimeChart,
	TimeSeriesPoint,
} from '@/components/MultiSeriesTimeChart';
import { StatCard } from '@/components/StatCard';
import SuspendModal from '@/components/SuspendModal';
import { useAuth } from '@/context/AuthContext';
import { fetchAPI } from '@/lib/api';
import { PlayerProfile, Season } from '@/types/types';
import { initials } from '@/utils/helpers';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
	ArrowLeft,
	Award,
	Ban,
	Calendar,
	CheckCircle2,
	DollarSign,
	FileText,
	Flame,
	Footprints,
	Handshake,
	Layers,
	Mail,
	Phone,
	Shield,
	ShieldAlert,
	Sparkles,
	Swords,
	Target,
	Trash2,
	Trophy,
	Unlock,
	Users,
	XCircle,
} from 'lucide-react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useMemo, useState } from 'react';

interface AwardCatalogItem {
	type: string;
	label: string;
	category: string;
	emoji: string;
	color: string;
	bgClass: string;
}

const AWARD_CATALOG: AwardCatalogItem[] = [
	{
		type: 'time_vencedor_rodada',
		label: 'Campeão da Rodada',
		category: 'Coletivo / Pizza',
		emoji: '🏆',
		color: '#f59e0b',
		bgClass: 'border-amber-500/35 bg-amber-500/10 text-amber-400',
	},
	{
		type: 'bola_cheia',
		label: 'MVP (Bola Cheia)',
		category: 'Destaque Individual',
		emoji: '⭐',
		color: '#eab308',
		bgClass: 'border-yellow-500/35 bg-yellow-500/10 text-yellow-400',
	},
	{
		type: 'gol_rodada',
		label: 'Gol da Rodada',
		category: 'Ofensivo',
		emoji: '⚽',
		color: '#3b82f6',
		bgClass: 'border-blue-500/35 bg-blue-500/10 text-blue-400',
	},
	{
		type: 'defesa_rodada',
		label: 'Defesa da Rodada',
		category: 'Defensivo',
		emoji: '🧤',
		color: '#10b981',
		bgClass: 'border-emerald-500/35 bg-emerald-500/10 text-emerald-400',
	},
	{
		type: 'drible_rodada',
		label: 'Drible da Rodada',
		category: 'Habilidade',
		emoji: '⚡',
		color: '#a855f7',
		bgClass: 'border-purple-500/35 bg-purple-500/10 text-purple-400',
	},
	{
		type: 'goleiro_menos_vazado',
		label: 'Goleiro Menos Vazado',
		category: 'Clean Sheet / Defesa',
		emoji: '🛡️',
		color: '#06b6d4',
		bgClass: 'border-cyan-500/35 bg-cyan-500/10 text-cyan-400',
	},
	{
		type: 'inacreditavel',
		label: 'Inacreditável',
		category: 'Lance Inusitado',
		emoji: '🤯',
		color: '#f97316',
		bgClass: 'border-orange-500/35 bg-orange-500/10 text-orange-400',
	},
	{
		type: 'roleta',
		label: 'Roleta',
		category: 'Especial',
		emoji: '🎰',
		color: '#ec4899',
		bgClass: 'border-pink-500/35 bg-pink-500/10 text-pink-400',
	},
	{
		type: 'bola_murcha',
		label: 'Bola Murcha',
		category: 'Corneta',
		emoji: '🥀',
		color: '#ef4444',
		bgClass: 'border-red-500/35 bg-red-500/10 text-red-400',
	},
];

const AWARD_BY_TYPE: Record<string, AwardCatalogItem> = Object.fromEntries(
	AWARD_CATALOG.map((item) => [item.type, item]),
);

const PE_LABEL: Record<string, string> = {
	D: 'Direito',
	E: 'Esquerdo',
	A: 'Ambidestro',
};

export default function PlayerProfilePage() {
	const params = useParams();
	const router = useRouter();
	const { user } = useAuth();
	const queryClient = useQueryClient();
	const playerId = params.id as string;
	const isAdmin = Boolean(user?.is_admin || user?.role === 'admin');

	const [selectedSeasonId, setSelectedSeasonId] = useState<string>('all');
	const [granularity, setGranularity] = useState<'rounds' | 'seasons'>(
		'rounds',
	);
	const [showOnlyConqueredAwards, setShowOnlyConqueredAwards] =
		useState<boolean>(false);

	const [showAdminPanel, setShowAdminPanel] = useState(false);
	const [showSuspendModal, setShowSuspendModal] = useState(false);
	const [fineAmount, setFineAmount] = useState<string>('');
	const [observations, setObservations] = useState('');

	const {
		data: player,
		isLoading,
		isError,
	} = useQuery<PlayerProfile>({
		queryKey: ['player', playerId],
		queryFn: () => fetchAPI(`/players/${playerId}/profile`),
	});

	const { data: seasons = [] } = useQuery<Season[]>({
		queryKey: ['seasons'],
		queryFn: () => fetchAPI('/seasons/').catch(() => []),
	});

	// Quando uma temporada específica é selecionada (ou a ativa), busca também os dados ricos do ranking daquela temporada
	const { data: seasonRankingData } = useQuery<any>({
		queryKey: [
			'association-ranking',
			selectedSeasonId === 'all' ? 'current' : selectedSeasonId,
		],
		queryFn: () =>
			fetchAPI(
				selectedSeasonId === 'all'
					? '/rankings/association'
					: `/rankings/season/${selectedSeasonId}/association`,
			).catch(() => null),
	});

	const { data: playerStatus } = useQuery({
		queryKey: ['player-status', playerId],
		queryFn: () => fetchAPI(`/players/${playerId}/status`),
		enabled: isAdmin,
	});

	const { data: adminActionsHistory = [] } = useQuery<any[]>({
		queryKey: ['player-actions', playerId],
		queryFn: () => fetchAPI(`/players/${playerId}/admin/actions`),
		enabled: isAdmin,
	});

	const invalidate = () => {
		queryClient.invalidateQueries({ queryKey: ['player', playerId] });
		queryClient.invalidateQueries({
			queryKey: ['player-status', playerId],
		});
		queryClient.invalidateQueries({
			queryKey: ['player-actions', playerId],
		});
	};

	const adminMutation = useMutation({
		mutationFn: ({ action, body }: { action: string; body?: object }) =>
			fetchAPI(`/players/${playerId}/admin/${action}`, {
				method: 'POST',
				body: body ? JSON.stringify(body) : undefined,
			}),
		onSuccess: (_, { action }) => {
			invalidate();
			if (action === 'fine') setFineAmount('');
			if (action === 'observe') setObservations('');
			alert(`Ação "${action}" executada com sucesso!`);
		},
		onError: (err: any) => {
			alert(`Erro: ${err.message ?? 'Falha ao executar ação'}`);
		},
	});

	const suspendMutation = useMutation({
		mutationFn: ({ type, value }: { type: string; value: number }) =>
			fetchAPI(`/players/${playerId}/admin/suspend`, {
				method: 'POST',
				body: JSON.stringify({ suspension_type: type, value }),
			}),
		onSuccess: () => {
			invalidate();
			setShowSuspendModal(false);
			alert('Jogador suspenso com sucesso!');
		},
		onError: (err: any) => {
			alert(`Erro: ${err.message ?? 'Falha ao suspender'}`);
		},
	});

	const deletePlayerMutation = useMutation({
		mutationFn: () =>
			fetchAPI(`/players/${playerId}`, { method: 'DELETE' }),
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ['players'] });
			router.push('/players');
		},
		onError: (err: any) => {
			alert(
				`Erro ao excluir jogador: ${err.message ?? 'Falha ao excluir'}`,
			);
		},
	});

	// Lista consolidada de opções de temporada
	const seasonOptions = useMemo(() => {
		const map = new Map<
			number,
			{ id: number; label: string; isActive?: boolean }
		>();
		for (const s of seasons) {
			map.set(s.id_season, {
				id: s.id_season,
				label: `${s.number}ª Temporada${s.is_active ? ' (Ativa)' : ''}`,
				isActive: s.is_active,
			});
		}
		for (const ss of player?.season_stats ?? []) {
			if (!map.has(ss.season_id)) {
				map.set(ss.season_id, {
					id: ss.season_id,
					label: ss.season_name || `Temporada #${ss.season_id}`,
				});
			}
		}
		return Array.from(map.values()).sort((a, b) => b.id - a.id);
	}, [seasons, player?.season_stats]);

	// Linha do jogador no ranking da temporada selecionada (fallback / complemento de prêmios e estatísticas)
	const playerRankingRow = useMemo(() => {
		if (!seasonRankingData?.rows || !player) return null;
		return (
			seasonRankingData.rows.find(
				(r: any) => Number(r.player_id) === Number(player.id_player),
			) ?? null
		);
	}, [seasonRankingData, player]);

	// Dados filtrados conforme a temporada selecionada
	const activeStats = useMemo(() => {
		if (!player) {
			return {
				total_matches: 0,
				total_wins: 0,
				total_losses: 0,
				total_draws: 0,
				total_goals: 0,
				total_assists: 0,
				total_awards: 0,
				total_seasons: 0,
			};
		}

		if (selectedSeasonId === 'all') {
			return player.stats;
		}

		const sid = Number(selectedSeasonId);
		const sStat = player.season_stats.find(
			(s) => Number(s.season_id) === sid,
		);
		const awardsInSeason = player.awards.filter(
			(a) => a.season_id === undefined || Number(a.season_id) === sid,
		).length;

		// Se o ranking daquela temporada tiver números de vitórias/derrotas/empates mais completos, combina
		const wins =
			(sStat?.total_wins || 0) > 0
				? sStat!.total_wins
				: (playerRankingRow?.babas_conquistados ?? 0);
		const draws =
			(sStat?.total_draws || 0) > 0
				? sStat!.total_draws
				: (playerRankingRow?.empates ?? 0);
		const losses =
			(sStat?.total_losses || 0) > 0
				? sStat!.total_losses
				: (playerRankingRow?.babas_perdidos ?? 0);
		const matches =
			sStat?.total_matches || wins + draws + losses || 0;
		const goals =
			sStat?.total_goals ?? playerRankingRow?.artilharia ?? 0;
		const assists =
			sStat?.total_assists ?? playerRankingRow?.assistencias ?? 0;

		return {
			total_matches: matches,
			total_wins: wins,
			total_losses: losses,
			total_draws: draws,
			total_goals: goals,
			total_assists: assists,
			total_awards: awardsInSeason,
			total_seasons: 1,
		};
	}, [player, selectedSeasonId, playerRankingRow]);

	// Pontos da Série Temporal (por Rodada ou por Temporada)
	const timeSeriesPoints = useMemo<TimeSeriesPoint[]>(() => {
		if (!player) return [];

		const allRoundStats = player.round_stats ?? [];
		const filteredRounds =
			selectedSeasonId === 'all'
				? allRoundStats
				: allRoundStats.filter(
						(r) => Number(r.season_id) === Number(selectedSeasonId),
					);

		// Usar rodadas quando: (a) uma temporada específica foi selecionada e há rodadas, ou (b) granularidade é 'rounds' e há rodadas
		const useRounds =
			filteredRounds.length > 0 &&
			(selectedSeasonId !== 'all' || granularity === 'rounds');

		if (useRounds) {
			return filteredRounds.map((r) => {
				const dateStr = r.date
					? new Date(r.date).toLocaleDateString('pt-BR', {
							day: '2-digit',
							month: '2-digit',
						})
					: undefined;
				const shortSeason = r.season_name
					? r.season_name.replace(/Temporada/i, 'T').replace(/\s+/g, '')
					: `T${r.season_id}`;

				return {
					id: `round-${r.round_id}`,
					label:
						selectedSeasonId === 'all'
							? `${shortSeason}·R${r.round_number}`
							: `Rodada ${r.round_number}`,
					fullLabel: `Rodada #${r.round_number} — ${r.season_name || `Temporada ${r.season_id}`}`,
					subLabel: dateStr,
					values: {
						wins: r.total_wins,
						draws: r.total_draws,
						losses: r.total_losses,
						goals: r.total_goals,
						assists: r.total_assists,
						contributions: r.total_goals + r.total_assists,
						matches: r.total_matches,
					},
				};
			});
		}

		// Caso contrário, usar season_stats (filtradas ou todas)
		const filteredSeasons =
			selectedSeasonId === 'all'
				? player.season_stats
				: player.season_stats.filter(
						(s) => Number(s.season_id) === Number(selectedSeasonId),
					);

		if (filteredSeasons.length > 0) {
			return filteredSeasons.map((s) => {
				const isCurrentRankingSeason =
					seasonRankingData?.season_id &&
					Number(seasonRankingData.season_id) ===
						Number(s.season_id) &&
					playerRankingRow;

				const w =
					s.total_wins > 0
						? s.total_wins
						: isCurrentRankingSeason
							? (playerRankingRow.babas_conquistados ?? 0)
							: 0;
				const d =
					s.total_draws > 0
						? s.total_draws
						: isCurrentRankingSeason
							? (playerRankingRow.empates ?? 0)
							: 0;
				const l =
					s.total_losses > 0
						? s.total_losses
						: isCurrentRankingSeason
							? (playerRankingRow.babas_perdidos ?? 0)
							: 0;

				return {
					id: `season-${s.season_id}`,
					label: s.season_name
						? s.season_name.replace(/Temporada\s*/i, 'Temp ')
						: `Temp ${s.season_id}`,
					fullLabel: s.season_name || `Temporada #${s.season_id}`,
					subLabel: `${s.total_matches} partidas`,
					values: {
						wins: w,
						draws: d,
						losses: l,
						goals: s.total_goals,
						assists: s.total_assists,
						contributions: s.total_goals + s.total_assists,
						matches: s.total_matches,
					},
				};
			});
		}

		// Fallback se não houver season_stats mas houver dados gerais/ranking
		if (activeStats.total_matches > 0 || activeStats.total_goals > 0) {
			return [
				{
					id: 'summary-point',
					label:
						selectedSeasonId === 'all'
							? 'Geral'
							: `Temporada`,
					fullLabel:
						selectedSeasonId === 'all'
							? 'Acumulado Geral'
							: 'Temporada Selecionada',
					subLabel: `${activeStats.total_matches} partidas`,
					values: {
						wins: activeStats.total_wins,
						draws: activeStats.total_draws,
						losses: activeStats.total_losses,
						goals: activeStats.total_goals,
						assists: activeStats.total_assists,
						contributions:
							activeStats.total_goals + activeStats.total_assists,
						matches: activeStats.total_matches,
					},
				},
			];
		}

		return [];
	}, [
		player,
		selectedSeasonId,
		granularity,
		seasonRankingData,
		playerRankingRow,
		activeStats,
	]);

	// Consolidação de Prêmios Conquistados (combinando player.awards + dados do ranking quando aplicável)
	const awardsBreakdown = useMemo(() => {
		const counts: Record<string, number> = {};
		for (const item of AWARD_CATALOG) {
			counts[item.type] = 0;
		}

		const rawAwards = (player?.awards ?? []).filter((aw) =>
			selectedSeasonId === 'all' || aw.season_id === undefined
				? true
				: Number(aw.season_id) === Number(selectedSeasonId),
		);

		for (const aw of rawAwards) {
			const key = aw.event_type;
			counts[key] = (counts[key] ?? 0) + 1;
		}

		// Se na temporada selecionada o ranking tiver prêmios computados que ainda não vieram em player.awards, garante o maior valor
		if (
			playerRankingRow &&
			(selectedSeasonId !== 'all' || rawAwards.length === 0)
		) {
			const rankingAwardMap: Record<string, number> = {
				time_vencedor_rodada: playerRankingRow.pizza ?? 0,
				bola_cheia: playerRankingRow.bola_cheia ?? 0,
				bola_murcha: playerRankingRow.bola_murcha ?? 0,
				gol_rodada: playerRankingRow.premio_gol ?? 0,
				defesa_rodada: playerRankingRow.premio_defesa ?? 0,
				drible_rodada: playerRankingRow.premio_drible ?? 0,
				inacreditavel: playerRankingRow.premio_inacreditavel ?? 0,
				goleiro_menos_vazado: playerRankingRow.clean_sheets ?? 0,
				roleta: playerRankingRow.roleta ?? 0,
			};
			for (const [k, val] of Object.entries(rankingAwardMap)) {
				if (val > (counts[k] ?? 0)) {
					counts[k] = val;
				}
			}
		}

		const items = Object.entries(counts).map(([type, count]) => {
			const meta = AWARD_BY_TYPE[type] ?? {
				type,
				label: type,
				category: 'Prêmio',
				emoji: '🏅',
				color: '#3b82f6',
				bgClass: 'border-blue-500/35 bg-blue-500/10 text-blue-400',
			};
			return {
				...meta,
				count,
			};
		});

		items.sort((a, b) => b.count - a.count || a.label.localeCompare(b.label));
		const totalConquered = items.reduce((acc, i) => acc + i.count, 0);
		const maxCount = Math.max(...items.map((i) => i.count), 1);

		return {
			items,
			conqueredItems: items.filter((i) => i.count > 0),
			totalConquered,
			maxCount,
		};
	}, [player?.awards, selectedSeasonId, playerRankingRow]);

	const filteredTeams = useMemo(() => {
		const list = player?.teams ?? [];
		if (selectedSeasonId === 'all') return list;
		return list.filter(
			(t) =>
				t.season_id === undefined ||
				Number(t.season_id) === Number(selectedSeasonId),
		);
	}, [player?.teams, selectedSeasonId]);

	if (isLoading) return <Loading />;
	if (isError || !player)
		return (
			<div className="flex items-center gap-3 p-4 bg-surface border border-border rounded-xl">
				<button
					type="button"
					onClick={() => router.back()}
					className="w-9 h-9 rounded-lg bg-background border border-border text-muted hover:text-main flex items-center justify-center transition-colors cursor-pointer"
					title="Voltar"
				>
					<ArrowLeft className="w-4 h-4" />
				</button>
				<span className="text-sm text-red-400">
					{isError
						? 'Erro ao carregar perfil.'
						: 'Jogador não encontrado.'}
				</span>
			</div>
		);

	const totalMatches = activeStats.total_matches || 0;
	const winRate =
		totalMatches > 0
			? ((activeStats.total_wins / totalMatches) * 100).toFixed(1)
			: '0.0';
	const drawRate =
		totalMatches > 0
			? ((activeStats.total_draws / totalMatches) * 100).toFixed(1)
			: '0.0';
	const lossRate =
		totalMatches > 0
			? ((activeStats.total_losses / totalMatches) * 100).toFixed(1)
			: '0.0';
	const goalsPerMatch =
		totalMatches > 0
			? (activeStats.total_goals / totalMatches).toFixed(2)
			: '0.00';
	const assistsPerMatch =
		totalMatches > 0
			? (activeStats.total_assists / totalMatches).toFixed(2)
			: '0.00';
	const contribPerMatch =
		totalMatches > 0
			? (
					(activeStats.total_goals + activeStats.total_assists) /
					totalMatches
				).toFixed(2)
			: '0.00';

	// Cálculo dos arcos do Donut Chart de Prêmios
	const donutRadius = 62;
	const donutCircumference = 2 * Math.PI * donutRadius;
	let accumulatedPercent = 0;
	const donutSegments = awardsBreakdown.conqueredItems.map((item) => {
		const pct =
			awardsBreakdown.totalConquered > 0
				? item.count / awardsBreakdown.totalConquered
				: 0;
		const strokeDasharray = `${pct * donutCircumference} ${donutCircumference}`;
		const strokeDashoffset = -accumulatedPercent * donutCircumference;
		accumulatedPercent += pct;
		return {
			...item,
			pct: Math.round(pct * 100),
			strokeDasharray,
			strokeDashoffset,
		};
	});

	const displayedAwardCards = showOnlyConqueredAwards
		? awardsBreakdown.conqueredItems
		: awardsBreakdown.items;

	return (
		<div className="flex flex-col gap-6 animate-slide-down pb-8">
			{/* 1. Hero Header + Filtro de Temporada */}
			<div className="relative overflow-hidden bg-surface border border-border rounded-xl p-5 sm:p-6">
				<div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-primary via-blue-400/50 to-purple-500/40" />

				<div className="flex flex-col lg:flex-row lg:items-center justify-between gap-5">
					<div className="flex items-start sm:items-center gap-4 min-w-0">
						{/* Botão Voltar (apenas ícone) */}
						<button
							type="button"
							onClick={() => router.back()}
							title="Voltar"
							aria-label="Voltar"
							className="w-10 h-10 rounded-xl bg-background/80 border border-border text-muted hover:text-main hover:border-border-hover flex items-center justify-center shrink-0 transition-colors cursor-pointer"
						>
							<ArrowLeft className="w-4 h-4" />
						</button>

						{/* Avatar */}
						<div className="w-14 h-14 sm:w-16 sm:h-16 rounded-2xl bg-gradient-to-br from-primary/30 to-primary/5 border border-primary/35 text-primary text-xl sm:text-2xl font-bold flex items-center justify-center shrink-0 shadow-inner">
							{initials(player.nome)}
						</div>

						{/* Dados Principais */}
						<div className="flex flex-col gap-2 min-w-0">
							<div className="flex items-center gap-2.5 flex-wrap">
								<h1 className="text-xl sm:text-2xl font-bold text-main truncate">
									{player.nome}
								</h1>
								{player.apelido && (
									<span className="text-xs font-semibold text-primary bg-primary/15 border border-primary/25 px-2.5 py-0.5 rounded-lg">
										&ldquo;{player.apelido}&rdquo;
									</span>
								)}
								{playerStatus?.is_blocked && (
									<span className="text-[11px] font-semibold uppercase tracking-wider bg-red-500/15 text-red-400 border border-red-500/30 px-2.5 py-0.5 rounded-full">
										Bloqueado
									</span>
								)}
								{playerStatus?.suspension && (
									<span className="text-[11px] font-semibold uppercase tracking-wider bg-amber-500/15 text-amber-400 border border-amber-500/30 px-2.5 py-0.5 rounded-full">
										Suspenso
									</span>
								)}
							</div>

							{/* Badges Semânticas + Contatos */}
							<div className="flex items-center gap-2 flex-wrap">
								<span
									className={`text-[11px] font-semibold uppercase tracking-wider px-2.5 py-0.5 rounded-full border ${
										player.is_guest
											? 'bg-amber-500/15 text-amber-400 border-amber-500/30'
											: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30'
									}`}
								>
									{player.is_guest
										? 'Convidado'
										: 'Mensalista'}
								</span>

								{player.posicao && (
									<span className="inline-flex items-center gap-1 text-[11px] font-semibold uppercase tracking-wider bg-blue-500/15 text-blue-400 border border-blue-500/30 px-2.5 py-0.5 rounded-full">
										<Shield className="w-3 h-3" />
										{player.posicao}
									</span>
								)}

								{player.pe && (
									<span className="inline-flex items-center gap-1 text-[11px] font-semibold uppercase tracking-wider bg-purple-500/15 text-purple-400 border border-purple-500/30 px-2.5 py-0.5 rounded-full">
										<Footprints className="w-3 h-3" />
										Pé {PE_LABEL[player.pe] ?? player.pe}
									</span>
								)}

								{player.potes && (
									<span className="inline-flex items-center gap-1 text-[11px] font-semibold uppercase tracking-wider bg-cyan-500/15 text-cyan-400 border border-cyan-500/30 px-2.5 py-0.5 rounded-full">
										<Layers className="w-3 h-3" />
										Pote {player.potes}
									</span>
								)}

								{player.email && (
									<span className="inline-flex items-center gap-1.5 text-xs text-muted bg-background/50 border border-border/60 px-2.5 py-0.5 rounded-lg">
										<Mail className="w-3.5 h-3.5 text-muted/70" />
										{player.email}
									</span>
								)}
								{player.telefone && (
									<span className="inline-flex items-center gap-1.5 text-xs text-muted bg-background/50 border border-border/60 px-2.5 py-0.5 rounded-lg">
										<Phone className="w-3.5 h-3.5 text-muted/70" />
										{player.telefone}
									</span>
								)}
							</div>
						</div>
					</div>

					{/* Controles à Direita: Filtro de Temporada + Ações Admin */}
					<div className="flex flex-wrap items-center gap-2.5 self-start lg:self-center shrink-0">
						{/* Filtro de Temporada */}
						<div className="flex items-center gap-2 bg-background/80 border border-border rounded-xl px-3.5 py-2">
							<Calendar className="w-4 h-4 text-primary shrink-0" />
							<span className="text-xs font-semibold text-muted uppercase tracking-wider whitespace-nowrap">
								Temporada:
							</span>
							<select
								value={selectedSeasonId}
								onChange={(e) =>
									setSelectedSeasonId(e.target.value)
								}
								className="bg-transparent text-sm font-semibold text-main focus:outline-none cursor-pointer pr-1 min-w-[175px]"
							>
								<option
									value="all"
									className="bg-[#0f172a] text-main"
								>
									Todas as Temporadas
								</option>
								{seasonOptions.map((s) => (
									<option
										key={s.id}
										value={String(s.id)}
										className="bg-[#0f172a] text-main"
									>
										{s.label}
									</option>
								))}
							</select>
						</div>

						{isAdmin && (
							<>
								<button
									type="button"
									onClick={() =>
										setShowAdminPanel(!showAdminPanel)
									}
									className={`h-9 px-3.5 rounded-xl border text-xs font-medium flex items-center gap-1.5 transition-all cursor-pointer ${
										showAdminPanel
											? 'bg-primary/20 border-primary text-primary'
											: 'bg-background/70 border-border text-main hover:bg-white/5 hover:border-border-hover'
									}`}
								>
									<ShieldAlert className="w-4 h-4" />
									<span>Painel Admin</span>
								</button>

								<button
									type="button"
									disabled={deletePlayerMutation.isPending}
									onClick={() => {
										if (
											window.confirm(
												`Tem certeza que deseja excluir "${player.apelido || player.nome}"?`,
											)
										) {
											deletePlayerMutation.mutate();
										}
									}}
									title="Excluir Jogador"
									aria-label="Excluir Jogador"
									className="w-9 h-9 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 hover:bg-red-500/20 flex items-center justify-center transition-colors cursor-pointer disabled:opacity-50"
								>
									<Trash2 className="w-4 h-4" />
								</button>
							</>
						)}
					</div>
				</div>
			</div>

			{/* Painel Administrativo (quando aberto) */}
			{isAdmin && showAdminPanel && (
				<div className="bg-surface/80 border border-border rounded-xl p-5 flex flex-col gap-4 animate-slide-down">
					<div className="flex items-center justify-between border-b border-border pb-3">
						<div className="flex items-center gap-2">
							<ShieldAlert className="w-4 h-4 text-primary" />
							<h2 className="text-sm font-semibold text-main uppercase tracking-wider">
								Gerenciamento Administrativo
							</h2>
						</div>
						{playerStatus && (
							<div className="flex items-center gap-2 text-xs">
								<span className="text-muted">Acesso:</span>
								<span
									className={`font-semibold ${
										playerStatus.is_blocked
											? 'text-red-400'
											: 'text-emerald-400'
									}`}
								>
									{playerStatus.is_blocked
										? 'Bloqueado'
										: 'Liberado'}
								</span>
							</div>
						)}
					</div>

					<div className="grid grid-cols-1 md:grid-cols-3 gap-4">
						{/* Card 1: Suspensão e Bloqueio */}
						<div className="bg-background/60 border border-border rounded-xl p-4 flex flex-col justify-between gap-3">
							<div>
								<h3 className="text-xs font-semibold text-main uppercase tracking-wider mb-1">
									Disciplina & Acesso
								</h3>
								{playerStatus?.suspension ? (
									<div className="text-xs text-amber-400 bg-amber-500/10 border border-amber-500/20 rounded-lg p-2">
										{playerStatus.suspension.is_indefinite
											? 'Suspensão Indefinida ativa'
											: playerStatus.suspension
														.suspension_matches
												? `${playerStatus.suspension.suspension_matches} jogo(s) de suspensão restante(s)`
												: `Suspenso até ${new Date(playerStatus.suspension.suspended_until).toLocaleDateString('pt-BR')} (${playerStatus.suspension.days_remaining}d)`}
									</div>
								) : (
									<p className="text-xs text-muted">
										Nenhuma suspensão ativa no momento.
									</p>
								)}
							</div>

							<div className="flex flex-wrap gap-2">
								<button
									type="button"
									onClick={() => setShowSuspendModal(true)}
									disabled={adminMutation.isPending}
									className="h-8 px-3 rounded-lg bg-amber-500/15 border border-amber-500/30 text-amber-400 hover:bg-amber-500/25 text-xs font-medium flex items-center gap-1.5 transition-colors cursor-pointer"
								>
									<Ban className="w-3.5 h-3.5" />
									Suspender
								</button>

								{playerStatus?.suspension && (
									<button
										type="button"
										onClick={() =>
											adminMutation.mutate({
												action: 'unsuspend',
											})
										}
										disabled={adminMutation.isPending}
										className="h-8 px-3 rounded-lg bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/25 text-xs font-medium flex items-center gap-1.5 transition-colors cursor-pointer"
									>
										<Unlock className="w-3.5 h-3.5" />
										Liberar Susp.
									</button>
								)}

								{playerStatus?.is_blocked ? (
									<button
										type="button"
										onClick={() =>
											adminMutation.mutate({
												action: 'unblock',
											})
										}
										disabled={adminMutation.isPending}
										className="h-8 px-3 rounded-lg bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/25 text-xs font-medium flex items-center gap-1.5 transition-colors cursor-pointer"
									>
										<CheckCircle2 className="w-3.5 h-3.5" />
										Desbloquear
									</button>
								) : (
									<button
										type="button"
										onClick={() =>
											adminMutation.mutate({
												action: 'block',
											})
										}
										disabled={adminMutation.isPending}
										className="h-8 px-3 rounded-lg bg-red-500/15 border border-red-500/30 text-red-400 hover:bg-red-500/25 text-xs font-medium flex items-center gap-1.5 transition-colors cursor-pointer"
									>
										<XCircle className="w-3.5 h-3.5" />
										Bloquear
									</button>
								)}
							</div>
						</div>

						{/* Card 2: Multa Rápida */}
						<div className="bg-background/60 border border-border rounded-xl p-4 flex flex-col justify-between gap-3">
							<div>
								<h3 className="text-xs font-semibold text-main uppercase tracking-wider mb-1">
									Aplicar Multa (R$)
								</h3>
								<p className="text-xs text-muted">
									Registre penalidade financeira no histórico.
								</p>
							</div>
							<div className="flex items-center gap-2">
								<Input
									type="number"
									min="0"
									step="0.01"
									placeholder="0,00"
									value={fineAmount}
									onChange={(e) =>
										setFineAmount(e.target.value)
									}
									className="!py-1.5 !text-xs h-9"
								/>
								<button
									type="button"
									disabled={
										adminMutation.isPending ||
										!fineAmount ||
										Number(fineAmount) <= 0
									}
									onClick={() =>
										adminMutation.mutate({
											action: 'fine',
											body: {
												fine_amount:
													parseFloat(fineAmount) || 0,
											},
										})
									}
									className="h-9 px-3.5 rounded-lg bg-orange-500/15 border border-orange-500/30 text-orange-400 hover:bg-orange-500/25 text-xs font-medium flex items-center gap-1.5 shrink-0 transition-colors cursor-pointer disabled:opacity-40"
								>
									<DollarSign className="w-3.5 h-3.5" />
									Aplicar
								</button>
							</div>
						</div>

						{/* Card 3: Observação Rápida */}
						<div className="bg-background/60 border border-border rounded-xl p-4 flex flex-col justify-between gap-3">
							<div>
								<h3 className="text-xs font-semibold text-main uppercase tracking-wider mb-1">
									Nova Observação
								</h3>
								<p className="text-xs text-muted">
									Adicione nota administrativa ao atleta.
								</p>
							</div>
							<div className="flex items-center gap-2">
								<Input
									type="text"
									placeholder="Digite uma observação..."
									value={observations}
									onChange={(e) =>
										setObservations(e.target.value)
									}
									className="!py-1.5 !text-xs h-9"
								/>
								<button
									type="button"
									disabled={
										adminMutation.isPending ||
										!observations.trim()
									}
									onClick={() =>
										adminMutation.mutate({
											action: 'observe',
											body: { observations },
										})
									}
									className="h-9 px-3.5 rounded-lg bg-primary/15 border border-primary/30 text-primary hover:bg-primary/25 text-xs font-medium flex items-center gap-1.5 shrink-0 transition-colors cursor-pointer disabled:opacity-40"
								>
									<FileText className="w-3.5 h-3.5" />
									Salvar
								</button>
							</div>
						</div>
					</div>

					{adminActionsHistory.length > 0 && (
						<div className="bg-background/40 border border-border rounded-xl p-3.5">
							<h3 className="text-xs font-semibold text-muted uppercase tracking-wider mb-2">
								Últimas Ocorrências (
								{adminActionsHistory.length})
							</h3>
							<div className="max-h-40 overflow-y-auto divide-y divide-border/60">
								{adminActionsHistory.map((action, idx) => (
									<div
										key={idx}
										className="py-2 first:pt-0 last:pb-0 flex items-center justify-between gap-3 text-xs"
									>
										<div className="flex items-center gap-2 min-w-0">
											<span className="font-semibold text-main uppercase text-[11px] bg-white/5 px-2 py-0.5 rounded">
												{action.action_type}
											</span>
											{action.description && (
												<span className="text-muted truncate">
													{action.description}
												</span>
											)}
										</div>
										<span className="text-[11px] text-muted shrink-0">
											{new Date(
												action.created_at,
											).toLocaleDateString('pt-BR')}
										</span>
									</div>
								))}
							</div>
						</div>
					)}
				</div>
			)}

			{/* 2. Visão Geral de KPIs + Índice de Eficiência */}
			<div className="grid grid-cols-1 xl:grid-cols-12 gap-5">
				<div className="xl:col-span-8 grid grid-cols-2 sm:grid-cols-4 gap-3.5">
					<StatCard
						label="Partidas"
						value={activeStats.total_matches}
						subLabel={
							selectedSeasonId === 'all'
								? `${activeStats.total_seasons} temp.`
								: 'na temporada'
						}
						icon={<Swords className="w-4 h-4 text-slate-300" />}
					/>
					<StatCard
						label="Vitórias"
						value={activeStats.total_wins}
						subLabel={`${winRate}%`}
						color="green"
						icon={<Trophy className="w-4 h-4 text-emerald-400" />}
					/>
					<StatCard
						label="Empates"
						value={activeStats.total_draws}
						subLabel={`${drawRate}%`}
						color="yellow"
						icon={<Handshake className="w-4 h-4 text-yellow-400" />}
					/>
					<StatCard
						label="Derrotas"
						value={activeStats.total_losses}
						subLabel={`${lossRate}%`}
						color="red"
						icon={<XCircle className="w-4 h-4 text-red-400" />}
					/>
					<StatCard
						label="Gols"
						value={activeStats.total_goals}
						subLabel={`${goalsPerMatch}/jogo`}
						color="blue"
						icon={<Flame className="w-4 h-4 text-blue-400" />}
					/>
					<StatCard
						label="Assistências"
						value={activeStats.total_assists}
						subLabel={`${assistsPerMatch}/jogo`}
						color="purple"
						icon={<Sparkles className="w-4 h-4 text-purple-400" />}
					/>
					<StatCard
						label="Prêmios"
						value={awardsBreakdown.totalConquered}
						subLabel="conquistas"
						color="orange"
						icon={<Award className="w-4 h-4 text-orange-400" />}
					/>
					<StatCard
						label="Times"
						value={filteredTeams.length}
						subLabel={
							selectedSeasonId === 'all'
								? `${player.stats.total_seasons} temp.`
								: 'escalações'
						}
						icon={<Users className="w-4 h-4 text-cyan-400" />}
					/>
				</div>

				{/* Card de Eficiência e Aproveitamento */}
				<div className="xl:col-span-4 bg-surface border border-border rounded-xl p-5 flex flex-col justify-between gap-4">
					<div className="flex items-center justify-between">
						<span className="text-xs font-semibold uppercase tracking-wider text-muted flex items-center gap-1.5">
							<Target className="w-4 h-4 text-primary" />
							Índice de Aproveitamento
						</span>
						<span className="text-sm font-bold text-emerald-400 bg-emerald-500/10 border border-emerald-500/25 px-2.5 py-0.5 rounded-full">
							{winRate}% Vitórias
						</span>
					</div>

					{/* Barra de distribuição V / E / D */}
					<div>
						<div className="h-3 w-full rounded-full bg-background overflow-hidden flex border border-border/60">
							{totalMatches > 0 ? (
								<>
									<div
										style={{ width: `${winRate}%` }}
										className="bg-emerald-500 h-full transition-all duration-300"
										title={`Vitórias: ${winRate}%`}
									/>
									<div
										style={{ width: `${drawRate}%` }}
										className="bg-amber-500 h-full transition-all duration-300"
										title={`Empates: ${drawRate}%`}
									/>
									<div
										style={{ width: `${lossRate}%` }}
										className="bg-red-500 h-full transition-all duration-300"
										title={`Derrotas: ${lossRate}%`}
									/>
								</>
							) : (
								<div className="bg-white/10 w-full h-full" />
							)}
						</div>
						<div className="flex items-center justify-between text-xs text-muted mt-2">
							<span className="flex items-center gap-1.5">
								<span className="w-2.5 h-2.5 rounded-full bg-emerald-500 inline-block" />
								<strong className="text-main">
									{activeStats.total_wins}
								</strong>{' '}
								Vitórias
							</span>
							<span className="flex items-center gap-1.5">
								<span className="w-2.5 h-2.5 rounded-full bg-amber-500 inline-block" />
								<strong className="text-main">
									{activeStats.total_draws}
								</strong>{' '}
								Empates
							</span>
							<span className="flex items-center gap-1.5">
								<span className="w-2.5 h-2.5 rounded-full bg-red-500 inline-block" />
								<strong className="text-main">
									{activeStats.total_losses}
								</strong>{' '}
								Derrotas
							</span>
						</div>
					</div>

					{/* Médias Ofensivas por Partida */}
					<div className="grid grid-cols-3 gap-2.5 pt-3 border-t border-border/60 text-center">
						<div className="bg-background/60 rounded-xl p-2.5 border border-border/50">
							<span className="text-[11px] text-muted block">
								Gols / Jogo
							</span>
							<span className="text-base font-bold text-blue-400 mt-0.5 block">
								{goalsPerMatch}
							</span>
						</div>
						<div className="bg-background/60 rounded-xl p-2.5 border border-border/50">
							<span className="text-[11px] text-muted block">
								Assist / Jogo
							</span>
							<span className="text-base font-bold text-purple-400 mt-0.5 block">
								{assistsPerMatch}
							</span>
						</div>
						<div className="bg-background/60 rounded-xl p-2.5 border border-border/50">
							<span className="text-[11px] text-muted block">
								Partic. (G+A)/J
							</span>
							<span className="text-base font-bold text-cyan-400 mt-0.5 block">
								{contribPerMatch}
							</span>
						</div>
					</div>
				</div>
			</div>

			{/* Seletor de Granularidade Temporal quando "Todas as Temporadas" está ativo */}
			{selectedSeasonId === 'all' &&
				(player.round_stats?.length ?? 0) > 0 &&
				player.season_stats.length > 0 && (
					<div className="flex items-center justify-between bg-surface/60 border border-border rounded-xl px-4 py-2.5">
						<span className="text-xs text-muted">
							Visualização das Séries Temporais:
						</span>
						<div className="flex items-center gap-1 bg-background/80 p-1 rounded-lg border border-border">
							<button
								type="button"
								onClick={() => setGranularity('rounds')}
								className={`px-3 py-1 rounded-md text-xs font-medium transition-colors cursor-pointer ${
									granularity === 'rounds'
										? 'bg-primary text-white'
										: 'text-muted hover:text-main'
								}`}
							>
								Por Rodada ({player.round_stats?.length})
							</button>
							<button
								type="button"
								onClick={() => setGranularity('seasons')}
								className={`px-3 py-1 rounded-md text-xs font-medium transition-colors cursor-pointer ${
									granularity === 'seasons'
										? 'bg-primary text-white'
										: 'text-muted hover:text-main'
								}`}
							>
								Por Temporada ({player.season_stats.length})
							</button>
						</div>
					</div>
				)}

			{/* 3. Série Temporal 1: Vitórias, Empates e Derrotas */}
			<MultiSeriesTimeChart
				title="📈 Série Temporal — Vitórias, Empates e Derrotas"
				subtitle={
					selectedSeasonId === 'all'
						? 'Evolução histórica de resultados ao longo das rodadas/temporadas'
						: 'Desempenho de resultados por rodada na temporada selecionada'
				}
				points={timeSeriesPoints}
				series={[
					{
						key: 'wins',
						label: 'Vitórias',
						color: '#10b981',
						fillArea: true,
					},
					{
						key: 'draws',
						label: 'Empates',
						color: '#f59e0b',
						fillArea: false,
					},
					{
						key: 'losses',
						label: 'Derrotas',
						color: '#ef4444',
						fillArea: true,
					},
				]}
				emptyMessage="Nenhuma partida registrada neste período para gerar a série temporal de resultados."
				height={295}
			/>

			{/* 4. Série Temporal 2: Gols e Assistências */}
			<MultiSeriesTimeChart
				title="⚽ Série Temporal — Gols e Assistências"
				subtitle={
					selectedSeasonId === 'all'
						? 'Produção ofensiva e participações diretas em gols ao longo do tempo'
						: 'Evolução de gols e assistências por rodada na temporada selecionada'
				}
				points={timeSeriesPoints}
				series={[
					{
						key: 'goals',
						label: 'Gols',
						color: '#3b82f6',
						fillArea: true,
					},
					{
						key: 'assists',
						label: 'Assistências',
						color: '#a855f7',
						fillArea: true,
					},
					{
						key: 'contributions',
						label: 'Total (G+A)',
						color: '#06b6d4',
						dashed: true,
						fillArea: false,
					},
				]}
				emptyMessage="Nenhum gol ou assistência registrado neste período."
				height={295}
			/>

			{/* 5. Galeria de Prêmios Conquistados & Gráfico de Quantidade/Distribuição */}
			<div className="bg-surface border border-border rounded-xl p-5 sm:p-6 flex flex-col gap-6">
				<div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
					<div>
						<h2 className="text-lg font-semibold text-main flex items-center gap-2">
							<Award className="w-5 h-5 text-amber-400" />
							Galeria de Prêmios Conquistados & Distribuição
						</h2>
						<p className="text-xs text-muted mt-0.5">
							Proporção de troféus individuais e coletivos e
							galeria completa de conquistas
						</p>
					</div>

					<div className="flex items-center gap-1 bg-background/80 p-1 rounded-lg border border-border self-start sm:self-auto">
						<button
							type="button"
							onClick={() => setShowOnlyConqueredAwards(false)}
							className={`px-3 py-1 rounded-md text-xs font-medium transition-colors cursor-pointer ${
								!showOnlyConqueredAwards
									? 'bg-primary text-white shadow-sm'
									: 'text-muted hover:text-main'
							}`}
						>
							Todas Categorias ({awardsBreakdown.items.length})
						</button>
						<button
							type="button"
							onClick={() => setShowOnlyConqueredAwards(true)}
							className={`px-3 py-1 rounded-md text-xs font-medium transition-colors cursor-pointer ${
								showOnlyConqueredAwards
									? 'bg-primary text-white shadow-sm'
									: 'text-muted hover:text-main'
							}`}
						>
							Conquistados (
							{awardsBreakdown.conqueredItems.length})
						</button>
					</div>
				</div>

				<div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
					{/* Coluna Esquerda (5 cols): Gráfico Donut + Barras Horizontais de Quantidade */}
					<div className="lg:col-span-5 bg-background/50 border border-border/80 rounded-xl p-5 flex flex-col justify-between gap-5">
						<div className="flex items-center justify-between">
							<h3 className="text-xs font-semibold uppercase tracking-wider text-muted">
								Gráfico de Quantidade por Categoria
							</h3>
							<span className="text-xs font-bold text-amber-400 bg-amber-500/15 border border-amber-500/30 px-2.5 py-0.5 rounded-full">
								{awardsBreakdown.totalConquered} no total
							</span>
						</div>

						{awardsBreakdown.totalConquered === 0 ? (
							<div className="py-12 text-center text-sm text-muted flex flex-col items-center gap-2">
								<span className="text-3xl opacity-40">🏆</span>
								<span>
									Nenhum prêmio registrado neste período.
								</span>
							</div>
						) : (
							<>
								{/* Donut Chart Visual */}
								<div className="flex items-center justify-center gap-6 py-2 flex-wrap sm:flex-nowrap">
									<div className="relative w-36 h-36 flex items-center justify-center shrink-0">
										<svg
											viewBox="0 0 160 160"
											className="w-full h-full -rotate-90"
										>
											<circle
												cx="80"
												cy="80"
												r={donutRadius}
												fill="transparent"
												stroke="rgba(255,255,255,0.06)"
												strokeWidth="16"
											/>
											{donutSegments.map((seg) => (
												<circle
													key={seg.type}
													cx="80"
													cy="80"
													r={donutRadius}
													fill="transparent"
													stroke={seg.color}
													strokeWidth="16"
													strokeDasharray={
														seg.strokeDasharray
													}
													strokeDashoffset={
														seg.strokeDashoffset
													}
													strokeLinecap="butt"
													className="transition-all duration-500"
												>
													<title>{`${seg.label}: ${seg.count}x (${seg.pct}%)`}</title>
												</circle>
											))}
										</svg>
										<div className="absolute inset-0 flex flex-col items-center justify-center text-center">
											<span className="text-2xl font-bold text-main leading-none">
												{awardsBreakdown.totalConquered}
											</span>
											<span className="text-[10px] uppercase tracking-wider text-muted mt-1">
												Prêmios
											</span>
										</div>
									</div>

									{/* Top Legenda Rápida */}
									<div className="flex flex-col gap-2 flex-1 min-w-[140px]">
										{donutSegments
											.slice(0, 5)
											.map((seg) => (
												<div
													key={seg.type}
													className="flex items-center justify-between gap-2 text-xs"
												>
													<div className="flex items-center gap-2 min-w-0">
														<span
															className="w-2.5 h-2.5 rounded-full shrink-0"
															style={{
																backgroundColor:
																	seg.color,
															}}
														/>
														<span className="text-main truncate">
															{seg.label}
														</span>
													</div>
													<span className="text-muted font-semibold shrink-0">
														{seg.pct}%
													</span>
												</div>
											))}
									</div>
								</div>

								{/* Barras Horizontais de Quantidade */}
								<div className="flex flex-col gap-3 pt-3 border-t border-border/60">
									{awardsBreakdown.conqueredItems.map(
										(item) => {
											const widthPct = Math.max(
												Math.round(
													(item.count /
														awardsBreakdown.maxCount) *
														100,
												),
												8,
											);
											return (
												<div
													key={item.type}
													className="flex flex-col gap-1"
												>
													<div className="flex items-center justify-between text-xs">
														<span className="font-medium text-main flex items-center gap-1.5">
															<span>
																{item.emoji}
															</span>
															<span>
																{item.label}
															</span>
														</span>
														<span
															className="font-bold"
															style={{
																color: item.color,
															}}
														>
															{item.count}x
														</span>
													</div>
													<div className="h-2.5 w-full bg-surface rounded-full overflow-hidden border border-border/50">
														<div
															className="h-full rounded-full transition-all duration-500"
															style={{
																width: `${widthPct}%`,
																backgroundColor:
																	item.color,
															}}
														/>
													</div>
												</div>
											);
										},
									)}
								</div>
							</>
						)}
					</div>

					{/* Coluna Direita (7 cols): Galeria de Cards de Troféus */}
					<div className="lg:col-span-7 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3.5 content-start">
						{displayedAwardCards.length === 0 ? (
							<div className="col-span-full bg-background/40 border border-border/60 rounded-xl p-10 text-center text-sm text-muted">
								Nenhum prêmio conquistado neste filtro. Alterne
								para &ldquo;Todas Categorias&rdquo; para ver o
								quadro completo.
							</div>
						) : (
							displayedAwardCards.map((item) => {
								const isConquered = item.count > 0;
								const barWidth = isConquered
									? Math.max(
											Math.round(
												(item.count /
													awardsBreakdown.maxCount) *
													100,
											),
											12,
										)
									: 0;

								return (
									<div
										key={item.type}
										className={`rounded-xl p-4 border flex flex-col justify-between gap-3 transition-all duration-200 ${
											isConquered
												? 'bg-background/70 border-border hover:border-border-hover shadow-sm'
												: 'bg-background/25 border-border/40 opacity-55 hover:opacity-80'
										}`}
									>
										<div className="flex items-start justify-between gap-2">
											<div
												className={`w-10 h-10 rounded-xl border flex items-center justify-center text-xl shrink-0 ${
													isConquered
														? item.bgClass
														: 'border-border bg-surface text-muted'
												}`}
											>
												{item.emoji}
											</div>
											<span
												className={`text-xs font-bold px-2.5 py-1 rounded-full border ${
													isConquered
														? item.bgClass
														: 'border-border bg-surface text-muted'
												}`}
											>
												{item.count}x
											</span>
										</div>

										<div>
											<h4 className="text-sm font-semibold text-main leading-snug">
												{item.label}
											</h4>
											<span className="text-[11px] text-muted block mt-0.5">
												{item.category}
											</span>
										</div>

										<div className="h-1.5 w-full bg-surface rounded-full overflow-hidden">
											<div
												className="h-full rounded-full transition-all duration-500"
												style={{
													width: `${barWidth}%`,
													backgroundColor: item.color,
												}}
											/>
										</div>
									</div>
								);
							})
						)}
					</div>
				</div>
			</div>

			{/* 6. Tabela de Temporadas & Histórico de Times */}
			{(player.season_stats.length > 0 || filteredTeams.length > 0) && (
				<div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
					{player.season_stats.length > 0 && (
						<div className="lg:col-span-8 bg-surface border border-border rounded-xl p-5 sm:p-6">
							<div className="flex items-center justify-between mb-4">
								<div>
									<h2 className="text-base sm:text-lg font-semibold text-main">
										Resumo Consolidado por Temporada
									</h2>
									<p className="text-xs text-muted">
										Clique em uma temporada para filtrar os
										gráficos acima
									</p>
								</div>
								{selectedSeasonId !== 'all' && (
									<button
										type="button"
										onClick={() =>
											setSelectedSeasonId('all')
										}
										className="text-xs text-primary hover:underline cursor-pointer"
									>
										Ver todas as temporadas
									</button>
								)}
							</div>

							<div className="overflow-x-auto border border-border rounded-xl">
								<table className="w-full text-xs sm:text-sm border-collapse">
									<thead>
										<tr className="bg-white/5 border-b border-border text-muted">
											<th className="text-left py-3 px-3.5 font-medium">
												Temporada
											</th>
											<th className="text-center py-3 px-2.5 font-medium">
												J
											</th>
											<th className="text-center py-3 px-2.5 font-medium">
												V
											</th>
											<th className="text-center py-3 px-2.5 font-medium">
												E
											</th>
											<th className="text-center py-3 px-2.5 font-medium">
												D
											</th>
											<th className="text-center py-3 px-2.5 font-medium">
												Gols
											</th>
											<th className="text-center py-3 px-2.5 font-medium">
												Assist
											</th>
											<th className="text-right py-3 px-3.5 font-medium">
												Aprov.
											</th>
										</tr>
									</thead>
									<tbody className="divide-y divide-border/60">
										{player.season_stats.map((s) => {
											const isSelected =
												String(s.season_id) ===
												selectedSeasonId;
											const sWinPct =
												s.total_matches > 0
													? Math.round(
															(s.total_wins /
																s.total_matches) *
																100,
														)
													: 0;
											return (
												<tr
													key={s.season_id}
													onClick={() =>
														setSelectedSeasonId(
															isSelected
																? 'all'
																: String(
																		s.season_id,
																	),
														)
													}
													className={`cursor-pointer transition-colors ${
														isSelected
															? 'bg-primary/15'
															: 'hover:bg-white/[0.04]'
													}`}
												>
													<td className="py-2.5 px-3.5 font-semibold text-main">
														{s.season_name ||
															`Temporada #${s.season_id}`}
													</td>
													<td className="text-center py-2.5 px-2.5 text-muted font-medium">
														{s.total_matches}
													</td>
													<td className="text-center py-2.5 px-2.5 text-emerald-400 font-semibold">
														{s.total_wins}
													</td>
													<td className="text-center py-2.5 px-2.5 text-amber-400">
														{s.total_draws}
													</td>
													<td className="text-center py-2.5 px-2.5 text-red-400">
														{s.total_losses}
													</td>
													<td className="text-center py-2.5 px-2.5 text-blue-400 font-semibold">
														{s.total_goals}
													</td>
													<td className="text-center py-2.5 px-2.5 text-purple-400 font-semibold">
														{s.total_assists}
													</td>
													<td className="text-right py-2.5 px-3.5">
														<span className="text-xs font-semibold text-main bg-white/5 px-2 py-0.5 rounded-md">
															{sWinPct}%
														</span>
													</td>
												</tr>
											);
										})}
									</tbody>
								</table>
							</div>
						</div>
					)}

					{filteredTeams.length > 0 && (
						<div className="lg:col-span-4 bg-surface border border-border rounded-xl p-5 sm:p-6">
							<div className="flex items-center justify-between mb-4">
								<h2 className="text-base sm:text-lg font-semibold text-main flex items-center gap-2">
									<Users className="w-4 h-4 text-primary" />
									Times Escalados ({filteredTeams.length})
								</h2>
							</div>
							<div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-1 gap-2.5 max-h-80 overflow-y-auto pr-1">
								{filteredTeams.map((team) => (
									<Link
										key={team.id_team}
										href={`/teams/${team.id_team}`}
										className="group bg-background/60 border border-border rounded-xl px-3.5 py-2.5 flex items-center justify-between hover:border-primary transition-colors"
									>
										<div className="min-w-0">
											<span className="font-semibold text-main text-xs sm:text-sm block truncate group-hover:text-primary transition-colors">
												{team.name}
											</span>
											{(team.season_name ||
												team.round_number) && (
												<span className="text-[11px] text-muted block">
													{team.season_name}
													{team.round_number
														? ` · Rodada #${team.round_number}`
														: ''}
												</span>
											)}
										</div>
										<span className="text-xs text-muted group-hover:text-primary shrink-0 ml-2">
											&rarr;
										</span>
									</Link>
								))}
							</div>
						</div>
					)}
				</div>
			)}

			<SuspendModal
				isOpen={showSuspendModal}
				onClose={() => setShowSuspendModal(false)}
				onConfirm={(type, value) =>
					suspendMutation.mutate({ type, value })
				}
			/>
		</div>
	);
}
