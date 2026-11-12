'use client';

import { Button } from '@/components/Button';
import { FormField } from '@/components/FormField';
import { Loading } from '@/components/Loading';
import { Modal } from '@/components/Modal';
import { Select } from '@/components/Select';
import { useAuth } from '@/context/AuthContext';
import { fetchAPI } from '@/lib/api';
import { Player, Round, Season, Team } from '@/types/types';
import {
	useMutation,
	useQueries,
	useQuery,
	useQueryClient,
} from '@tanstack/react-query';
import { Award as AwardIcon, Trash2, Trophy } from 'lucide-react';
import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';

interface AwardItem {
	id_award: number;
	round_id: number;
	event_type: string;
	players: { id_player: number; nome: string; apelido?: string | null }[];
	teams: { id_team: number; name: string }[];
}

const AWARD_CATALOG: {
	event_type: string;
	label: string;
	target: 'player' | 'team';
}[] = [
	{ event_type: 'bola_cheia', label: '🌟 Bola Cheia (MVP)', target: 'player' },
	{ event_type: 'bola_murcha', label: '💩 Bola Murcha', target: 'player' },
	{ event_type: 'gol_rodada', label: '⚽ Gol da Rodada', target: 'player' },
	{ event_type: 'defesa_rodada', label: '🧤 Defesa da Rodada', target: 'player' },
	{ event_type: 'drible_rodada', label: '🌀 Drible da Rodada', target: 'player' },
	{ event_type: 'inacreditavel', label: '😱 Inacreditável', target: 'player' },
	{ event_type: 'goleiro_menos_vazado', label: '🥅 Goleiro Menos Vazado', target: 'player' },
	{ event_type: 'roleta', label: '🎰 Roleta', target: 'player' },
	{ event_type: 'time_vencedor_rodada', label: '🏆 Time Vencedor da Rodada', target: 'team' },
];

const AWARD_LABEL_MAP: Record<string, string> = Object.fromEntries(
	AWARD_CATALOG.map((c) => [c.event_type, c.label]),
);

export default function AwardsPage() {
	const { user } = useAuth();
	const isAdmin = Boolean(user?.is_admin || user?.role === 'admin');
	const queryClient = useQueryClient();

	const [selectedSeasonOverride, setSelectedSeasonOverride] = useState('');
	const [selectedRoundOverride, setSelectedRoundOverride] = useState('');
	const [isBatchOpen, setIsBatchOpen] = useState(false);
	const [recalculateScores, setRecalculateScores] = useState(false);
	const [batchSelections, setBatchSelections] = useState<
		Record<string, string>
	>({});

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

	const roundsQuery = useQuery<Round[]>({
		queryKey: ['rounds', 'season', selectedSeason],
		queryFn: () => fetchAPI(`/rounds/season/${selectedSeason}`),
		enabled: Boolean(selectedSeason),
		select: (data) =>
			[...data].sort((a, b) => b.round_number - a.round_number),
	});

	const rounds = roundsQuery.data ?? [];
	const selectedRoundId =
		selectedRoundOverride || rounds[0]?.id_round?.toString() || '';

	const [awardsQuery, roundTeamsQuery] = useQueries({
		queries: [
			{
				queryKey: ['awards', 'round', selectedRoundId],
				queryFn: () =>
					fetchAPI(`/awards/round/${selectedRoundId}`).catch(() => []),
				enabled: Boolean(selectedRoundId),
			},
			{
				queryKey: ['teams', 'round', selectedRoundId],
				queryFn: () =>
					fetchAPI(`/teams/round/${selectedRoundId}`).catch(() => []),
				enabled: Boolean(selectedRoundId),
			},
		],
	});

	const awards: AwardItem[] = awardsQuery.data ?? [];
	const roundTeams: (Team & { players?: Player[] })[] =
		roundTeamsQuery.data ?? [];

	const roundPlayers = useMemo(() => {
		const map = new Map<number, Player>();
		for (const t of roundTeams) {
			for (const p of t.players ?? []) {
				map.set(p.id_player, p);
			}
		}
		return map.size > 0 ? Array.from(map.values()) : allPlayers;
	}, [roundTeams, allPlayers]);

	useEffect(() => {
		setSelectedRoundOverride('');
	}, [selectedSeasonOverride]);

	const openBatchModal = () => {
		const initial: Record<string, string> = {};
		for (const item of AWARD_CATALOG) {
			const existing = awards.find(
				(a) => a.event_type === item.event_type,
			);
			if (existing) {
				if (item.target === 'team' && existing.teams.length > 0) {
					initial[item.event_type] =
						existing.teams[0].id_team.toString();
				} else if (
					item.target === 'player' &&
					existing.players.length > 0
				) {
					initial[item.event_type] =
						existing.players[0].id_player.toString();
				}
			}
		}
		setBatchSelections(initial);
		setIsBatchOpen(true);
	};

	const saveBatchMutation = useMutation({
		mutationFn: () => {
			const payload = {
				recalculate_scores: recalculateScores,
				awards: AWARD_CATALOG.map((item) => {
					const val = batchSelections[item.event_type];
					const id = val ? parseInt(val, 10) : null;
					return {
						event_type: item.event_type,
						player_ids: item.target === 'player' && id ? [id] : [],
						team_ids: item.target === 'team' && id ? [id] : [],
					};
				}),
			};
			return fetchAPI(`/awards/round/${selectedRoundId}/batch`, {
				method: 'POST',
				body: JSON.stringify(payload),
			});
		},
		onSuccess: () => {
			queryClient.invalidateQueries({
				queryKey: ['awards', 'round', selectedRoundId],
			});
			queryClient.invalidateQueries({ queryKey: ['rankings'] });
			setIsBatchOpen(false);
		},
		onError: (err: Error) =>
			alert(`Erro ao salvar prêmios: ${err.message}`),
	});

	const deleteAwardMutation = useMutation({
		mutationFn: (awardId: number) =>
			fetchAPI(`/awards/${awardId}`, { method: 'DELETE' }),
		onSuccess: () => {
			queryClient.invalidateQueries({
				queryKey: ['awards', 'round', selectedRoundId],
			});
		},
		onError: (err: Error) =>
			alert(`Erro ao remover prêmio: ${err.message}`),
	});

	if (seasonsQuery.isLoading || currentSeasonQuery.isLoading)
		return <Loading />;

	return (
		<div className="flex flex-col gap-6 animate-slide-down pb-12">
			<div className="flex items-center justify-between flex-wrap gap-4">
				<div>
					<h1 className="text-3xl text-main">
						Galeria de Prêmios &amp; Votação
					</h1>
					<p className="text-sm text-muted mt-1">
						Conquistas individuais e do time vencedor por rodada.
					</p>
				</div>

				<div className="flex items-center gap-3 flex-wrap">
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

					<Select
						value={selectedRoundId}
						onChange={(e) =>
							setSelectedRoundOverride(e.target.value)
						}
						className="w-auto"
						disabled={rounds.length === 0}
					>
						{rounds.length === 0 ? (
							<option value="">Sem rodadas</option>
						) : (
							rounds.map((r) => (
								<option key={r.id_round} value={r.id_round}>
									Rodada {r.round_number} (
									{new Date(r.date).toLocaleDateString(
										'pt-BR',
									)}
									)
								</option>
							))
						)}
					</Select>

					{isAdmin && selectedRoundId && (
						<Button
							onClick={openBatchModal}
							className="w-auto flex items-center gap-2"
						>
							<Trophy className="w-4 h-4" />
							Lançar / Editar Prêmios
						</Button>
					)}
				</div>
			</div>

			{awardsQuery.isLoading ? (
				<Loading />
			) : !selectedRoundId ? (
				<div className="bg-surface border border-border rounded-xl p-6 text-muted text-sm">
					Nenhuma rodada encontrada nesta temporada.
				</div>
			) : awards.length === 0 ? (
				<div className="bg-surface border border-border rounded-xl p-6 text-muted text-sm">
					Nenhum prêmio registrado para esta rodada ainda.
				</div>
			) : (
				<div className="grid grid-cols-[repeat(auto-fill,minmax(260px,1fr))] gap-4">
					{awards.map((a) => (
						<div
							key={a.id_award}
							className="bg-surface border border-border rounded-xl p-5 flex flex-col justify-between gap-3"
						>
							<div>
								<div className="flex items-center justify-between gap-2 mb-3">
									<span className="text-xs text-primary font-semibold bg-primary/10 px-2.5 py-1 rounded-full inline-flex items-center gap-1">
										<AwardIcon className="w-3.5 h-3.5" />
										Prêmio #{a.id_award}
									</span>
									{isAdmin && (
										<button
											type="button"
											onClick={() =>
												deleteAwardMutation.mutate(
													a.id_award,
												)
											}
											className="p-1 text-red-400 hover:bg-red-500/10 rounded cursor-pointer"
											title="Remover prêmio"
										>
											<Trash2 className="w-4 h-4" />
										</button>
									)}
								</div>

								<h2 className="text-base font-semibold text-main mb-2">
									{AWARD_LABEL_MAP[a.event_type] ??
										a.event_type}
								</h2>

								<div className="flex flex-wrap gap-1.5">
									{a.players?.map((p) => (
										<Link
											key={p.id_player}
											href={`/players/${p.id_player}`}
											className="text-xs bg-white/5 border border-border hover:border-primary px-2.5 py-1 rounded-full text-main"
										>
											{p.apelido || p.nome}
										</Link>
									))}
									{a.teams?.map((t) => (
										<Link
											key={t.id_team}
											href={`/teams/${t.id_team}`}
											className="text-xs bg-yellow-500/10 border border-yellow-500/30 hover:border-yellow-400 px-2.5 py-1 rounded-full text-yellow-300"
										>
											{t.name}
										</Link>
									))}
									{(!a.players || a.players.length === 0) &&
										(!a.teams || a.teams.length === 0) && (
											<span className="text-xs text-muted italic">
												Sem ganhador vinculado
											</span>
										)}
								</div>
							</div>
						</div>
					))}
				</div>
			)}

			{/* Modal Lançamento em Lote */}
			<Modal
				isOpen={isBatchOpen}
				onClose={() => setIsBatchOpen(false)}
				title="Prêmios Pós-Rodada"
			>
				<form
					onSubmit={(e) => {
						e.preventDefault();
						saveBatchMutation.mutate();
					}}
					className="flex flex-col gap-3 max-h-[70vh] overflow-y-auto pr-1"
				>
					{AWARD_CATALOG.map((item) => (
						<FormField key={item.event_type} label={item.label}>
							<Select
								value={batchSelections[item.event_type] ?? ''}
								onChange={(e) =>
									setBatchSelections({
										...batchSelections,
										[item.event_type]: e.target.value,
									})
								}
							>
								<option value="">— Não definido —</option>
								{item.target === 'team'
									? roundTeams.map((t) => (
											<option
												key={t.id_team}
												value={t.id_team}
											>
												{t.name}
											</option>
										))
									: roundPlayers.map((p) => (
											<option
												key={p.id_player}
												value={p.id_player}
											>
												{p.apelido || p.nome}
											</option>
										))}
							</Select>
						</FormField>
					))}

					<label className="flex items-center gap-2 text-xs text-main cursor-pointer pt-1">
						<input
							type="checkbox"
							checked={recalculateScores}
							onChange={(e) =>
								setRecalculateScores(e.target.checked)
							}
						/>
						Recalcular pontuações da rodada pelas regras da
						temporada
					</label>

					<div className="flex gap-3 mt-2">
						<Button
							type="submit"
							disabled={saveBatchMutation.isPending}
						>
							{saveBatchMutation.isPending
								? 'Salvando...'
								: 'Salvar Prêmios'}
						</Button>
						<Button
							type="button"
							variant="ghost"
							onClick={() => setIsBatchOpen(false)}
						>
							Cancelar
						</Button>
					</div>
				</form>
			</Modal>
		</div>
	);
}
