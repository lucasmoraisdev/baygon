'use client';

import { Button } from '@/components/Button';
import { FormField } from '@/components/FormField';
import { Input } from '@/components/Input';
import { Loading } from '@/components/Loading';
import { Modal } from '@/components/Modal';
import { Select } from '@/components/Select';
import { useAuth } from '@/context/AuthContext';
import { fetchAPI } from '@/lib/api';
import { Season } from '@/types/types';
import {
	useMutation,
	useQueries,
	useQuery,
	useQueryClient,
} from '@tanstack/react-query';
import { ShieldAlert } from 'lucide-react';
import Link from 'next/link';
import { useEffect, useMemo, useRef, useState } from 'react';

interface RuleItem {
	id_event_score_rule: number;
	season_id: number;
	event_type: string;
	context: 'match' | 'round' | 'season';
	points: number;
}

const EVENT_TYPE_LABELS: Record<string, string> = {
	gol: 'Gol',
	assistencia: 'Assistência',
	vitoria_mandante: 'Vitória do mandante',
	vitoria_visitante: 'Vitória do visitante',
	empate: 'Empate',
	gol_contra: 'Gol contra',
	cartao_amarelo: 'Cartão amarelo',
	cartao_vermelho: 'Cartão vermelho',
	ouro: 'Ouro',
	time_vencedor_rodada: 'Time vencedor da rodada',
	bola_cheia: 'Bola cheia',
	bola_murcha: 'Bola murcha',
	gol_rodada: 'Gol da rodada',
	defesa_rodada: 'Defesa da rodada',
	drible_rodada: 'Drible da rodada',
	inacreditavel: 'Inacreditável',
};

const EVENT_TYPE_OPTIONS = Object.entries(EVENT_TYPE_LABELS).map(
	([value, label]) => ({
		value,
		label: `${label} (${value})`,
	}),
);

function formatPoints(pts: number): string {
	if (pts > 0) return `+${pts}`;
	if (pts < 0) return `−${Math.abs(pts)}`;
	return '0';
}

export default function RulesPage() {
	const { user, loading: authLoading } = useAuth();
	const isAdmin = Boolean(user?.is_admin || user?.role === 'admin');
	const queryClient = useQueryClient();

	const [selectedSeasonOverride, setSelectedSeasonOverride] = useState('');
	const [isModalOpen, setIsModalOpen] = useState(false);
	const [isCopyModalOpen, setIsCopyModalOpen] = useState(false);
	const [copySourceType, setCopySourceType] = useState<'defaults' | 'season'>(
		'defaults',
	);
	const [copySourceSeasonId, setCopySourceSeasonId] = useState('');
	const [copyOverwrite, setCopyOverwrite] = useState(false);

	const [openMenuRuleId, setOpenMenuRuleId] = useState<number | null>(null);
	const menuRef = useRef<HTMLDivElement>(null);

	const [editingRule, setEditingRule] = useState<RuleItem | null>(null);
	const [form, setForm] = useState({
		event_type: 'gol',
		context: 'match' as 'match' | 'round' | 'season',
		points: 1,
	});

	useEffect(() => {
		const handleClickOutside = (e: MouseEvent) => {
			if (
				menuRef.current &&
				!menuRef.current.contains(e.target as Node)
			) {
				setOpenMenuRuleId(null);
			}
		};
		if (openMenuRuleId !== null) {
			document.addEventListener('mousedown', handleClickOutside);
		}
		return () =>
			document.removeEventListener('mousedown', handleClickOutside);
	}, [openMenuRuleId]);

	const [seasonsQuery, currentSeasonQuery] = useQueries({
		queries: [
			{
				queryKey: ['seasons'],
				queryFn: () => fetchAPI('/seasons/'),
				enabled: isAdmin,
			},
			{
				queryKey: ['seasons', 'current'],
				queryFn: async () => {
					try {
						return await fetchAPI('/seasons/current');
					} catch {
						return null;
					}
				},
				enabled: isAdmin,
			},
		],
	});

	const seasons: Season[] = seasonsQuery.data ?? [];
	const selectedSeason =
		selectedSeasonOverride ||
		currentSeasonQuery.data?.id_season?.toString() ||
		seasons[0]?.id_season?.toString() ||
		'';

	const currentSelectedSeasonObj = useMemo(
		() =>
			seasons.find((s) => String(s.id_season) === String(selectedSeason)),
		[seasons, selectedSeason],
	);

	// Identify previous season (by number or order) to show "Alterada: era X na Temporada Y"
	const previousSeasonObj = useMemo(() => {
		if (!currentSelectedSeasonObj) return null;
		const sorted = [...seasons].sort((a, b) => b.number - a.number);
		return (
			sorted.find((s) => s.number < currentSelectedSeasonObj.number) ??
			null
		);
	}, [seasons, currentSelectedSeasonObj]);

	const rulesQuery = useQuery<RuleItem[]>({
		queryKey: ['rules', 'season', selectedSeason],
		queryFn: () =>
			fetchAPI(`/rules/season/${selectedSeason}`).catch(() => []),
		enabled: isAdmin && Boolean(selectedSeason),
	});

	const prevSeasonRulesQuery = useQuery<RuleItem[]>({
		queryKey: ['rules', 'season', String(previousSeasonObj?.id_season ?? '')],
		queryFn: () =>
			fetchAPI(`/rules/season/${previousSeasonObj!.id_season}`).catch(
				() => [],
			),
		enabled: isAdmin && Boolean(previousSeasonObj?.id_season),
	});

	const prevRulesMap = useMemo(() => {
		const m = new Map<string, number>();
		for (const r of prevSeasonRulesQuery.data ?? []) {
			m.set(`${r.context}:${r.event_type}`, r.points);
		}
		return m;
	}, [prevSeasonRulesQuery.data]);

	const saveMutation = useMutation({
		mutationFn: async () => {
			if (editingRule) {
				return fetchAPI(`/rules/${editingRule.id_event_score_rule}`, {
					method: 'PUT',
					body: JSON.stringify(form),
				});
			}
			return fetchAPI('/rules/', {
				method: 'POST',
				body: JSON.stringify({
					...form,
					season_id: parseInt(selectedSeason, 10),
				}),
			});
		},
		onSuccess: () => {
			queryClient.invalidateQueries({
				queryKey: ['rules', 'season', selectedSeason],
			});
			setIsModalOpen(false);
			setEditingRule(null);
		},
		onError: (err: Error) => alert(`Erro ao salvar regra: ${err.message}`),
	});

	const quickZeroMutation = useMutation({
		mutationFn: (r: RuleItem) =>
			fetchAPI(`/rules/${r.id_event_score_rule}`, {
				method: 'PUT',
				body: JSON.stringify({
					event_type: r.event_type,
					context: r.context,
					points: 0,
				}),
			}),
		onSuccess: () => {
			queryClient.invalidateQueries({
				queryKey: ['rules', 'season', selectedSeason],
			});
			setOpenMenuRuleId(null);
		},
		onError: (err: Error) =>
			alert(`Erro ao atualizar regra: ${err.message}`),
	});

	const deleteMutation = useMutation({
		mutationFn: (id: number) =>
			fetchAPI(`/rules/${id}`, { method: 'DELETE' }),
		onSuccess: () => {
			queryClient.invalidateQueries({
				queryKey: ['rules', 'season', selectedSeason],
			});
			setOpenMenuRuleId(null);
		},
		onError: (err: Error) => alert(`Erro ao remover regra: ${err.message}`),
	});

	const copyOrSeedMutation = useMutation({
		mutationFn: async () => {
			if (copySourceType === 'defaults') {
				return fetchAPI(`/rules/season/${selectedSeason}/seed-defaults`, {
					method: 'POST',
				});
			}
			if (!copySourceSeasonId) {
				throw new Error('Selecione a temporada de origem.');
			}
			const sourceRules: RuleItem[] = await fetchAPI(
				`/rules/season/${copySourceSeasonId}`,
			);
			if (!sourceRules || sourceRules.length === 0) {
				throw new Error(
					'A temporada selecionada não possui regras cadastradas.',
				);
			}
			const currentRules = rulesQuery.data ?? [];
			const existingMap = new Map<string, RuleItem>();
			for (const r of currentRules) {
				existingMap.set(`${r.context}:${r.event_type}`, r);
			}

			for (const src of sourceRules) {
				const key = `${src.context}:${src.event_type}`;
				const existing = existingMap.get(key);
				if (existing) {
					if (copyOverwrite && existing.points !== src.points) {
						await fetchAPI(`/rules/${existing.id_event_score_rule}`, {
							method: 'PUT',
							body: JSON.stringify({
								event_type: src.event_type,
								context: src.context,
								points: src.points,
							}),
						});
					}
				} else {
					await fetchAPI('/rules/', {
						method: 'POST',
						body: JSON.stringify({
							season_id: parseInt(selectedSeason, 10),
							event_type: src.event_type,
							context: src.context,
							points: src.points,
						}),
					});
				}
			}
		},
		onSuccess: () => {
			queryClient.invalidateQueries({
				queryKey: ['rules', 'season', selectedSeason],
			});
			setIsCopyModalOpen(false);
		},
		onError: (err: Error) =>
			alert(`Erro ao copiar/aplicar regras: ${err.message}`),
	});

	const openCreateModal = () => {
		setEditingRule(null);
		setForm({ event_type: 'gol', context: 'match', points: 1 });
		setIsModalOpen(true);
	};

	const openEditModal = (r: RuleItem) => {
		setEditingRule(r);
		setForm({
			event_type: r.event_type,
			context: r.context,
			points: r.points,
		});
		setOpenMenuRuleId(null);
		setIsModalOpen(true);
	};

	const openCopyModal = () => {
		const otherSeasons = seasons.filter(
			(s) => String(s.id_season) !== String(selectedSeason),
		);
		if (otherSeasons.length > 0) {
			setCopySourceSeasonId(String(otherSeasons[0].id_season));
		}
		setCopySourceType('defaults');
		setCopyOverwrite(false);
		setIsCopyModalOpen(true);
	};

	if (authLoading) return <Loading />;

	if (!isAdmin) {
		return (
			<div className="bg-surface border border-red-500/30 rounded-xl p-8 flex flex-col items-center text-center gap-4 max-w-lg mx-auto mt-12">
				<ShieldAlert className="w-12 h-12 text-red-400" />
				<h1 className="text-2xl font-bold text-main">Acesso Restrito</h1>
				<p className="text-sm text-muted">
					Esta página é exclusiva para administradores do sistema.
				</p>
				<Link href="/" className="w-48">
					<Button variant="ghost">Voltar ao Dashboard</Button>
				</Link>
			</div>
		);
	}

	if (seasonsQuery.isLoading || rulesQuery.isLoading) return <Loading />;

	const rules = rulesQuery.data ?? [];
	const matchRules = rules.filter((r) => r.context === 'match');
	const roundRules = rules.filter((r) => r.context === 'round');
	const seasonRules = rules.filter((r) => r.context === 'season');

	const renderRuleRow = (r: RuleItem) => {
		const friendlyLabel = EVENT_TYPE_LABELS[r.event_type] || r.event_type;
		const prevKey = `${r.context}:${r.event_type}`;
		const hasPrev = prevRulesMap.has(prevKey);
		const prevPoints = prevRulesMap.get(prevKey);
		const isChangedFromPrev =
			hasPrev &&
			prevPoints !== undefined &&
			prevPoints !== r.points &&
			previousSeasonObj;

		const pillClass =
			r.points > 0
				? 'bg-emerald-500/[0.14] text-[#4ade80]'
				: r.points < 0
					? 'bg-red-500/[0.14] text-[#f87171]'
					: 'bg-white/[0.07] text-[#94a3b8]';

		return (
			<div
				key={r.id_event_score_rule}
				className="grid grid-cols-[1fr_auto_auto] sm:grid-cols-[1fr_110px_130px] gap-4 items-center px-5 py-3 border-t border-white/[0.06] hover:bg-white/[0.025] transition-colors"
			>
				<div className="min-w-0">
					<div className="font-semibold text-sm text-[#e6edf7] flex items-center flex-wrap gap-2">
						<span>{friendlyLabel}</span>
						{isChangedFromPrev && (
							<span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-yellow-400/[0.14] text-[#facc15]">
								Alterada: era {formatPoints(prevPoints!)} na
								Temporada {previousSeasonObj.number}
							</span>
						)}
					</div>
					<code className="font-mono text-xs text-[#64748b]">
						{r.event_type}
					</code>
				</div>

				<span
					className={`justify-self-start font-bold px-3 py-1 rounded-full text-sm whitespace-nowrap ${pillClass}`}
				>
					{formatPoints(r.points)} pts
				</span>

				<div className="flex items-center gap-2 justify-end sm:justify-start relative">
					<button
						type="button"
						onClick={() => openEditModal(r)}
						className="min-h-[36px] px-3.5 rounded-lg border border-white/[0.14] bg-transparent hover:bg-white/[0.05] text-[#e6edf7] font-medium text-[13px] cursor-pointer whitespace-nowrap transition-colors"
					>
						Editar
					</button>

					<div
						className="relative"
						ref={
							openMenuRuleId === r.id_event_score_rule
								? menuRef
								: undefined
						}
					>
						<button
							type="button"
							aria-label="Mais ações"
							title="Mais ações"
							onClick={() =>
								setOpenMenuRuleId((prev) =>
									prev === r.id_event_score_rule
										? null
										: r.id_event_score_rule,
								)
							}
							className="min-h-[36px] w-9 p-0 rounded-lg border border-white/[0.14] bg-transparent hover:bg-white/[0.05] text-[#e6edf7] text-lg leading-none cursor-pointer flex items-center justify-center transition-colors"
						>
							⋯
						</button>

						{openMenuRuleId === r.id_event_score_rule && (
							<div className="absolute right-0 mt-1.5 w-44 rounded-xl bg-[#0d1526] border border-white/10 shadow-2xl py-1.5 z-30">
								<button
									type="button"
									onClick={() => openEditModal(r)}
									className="w-full px-3.5 py-2 text-left text-xs text-[#e6edf7] hover:bg-white/[0.06] transition-colors cursor-pointer"
								>
									Editar pontuação
								</button>
								{r.points !== 0 && (
									<button
										type="button"
										onClick={() =>
											quickZeroMutation.mutate(r)
										}
										className="w-full px-3.5 py-2 text-left text-xs text-[#94a3b8] hover:text-[#e6edf7] hover:bg-white/[0.06] transition-colors cursor-pointer"
									>
										Zerar pontos (0 pts)
									</button>
								)}
								<div className="my-1 border-t border-white/[0.07]" />
								<button
									type="button"
									onClick={() => {
										if (
											window.confirm(
												`Tem certeza que deseja excluir a regra "${friendlyLabel}"?`,
											)
										) {
											deleteMutation.mutate(
												r.id_event_score_rule,
											);
										}
									}}
									className="w-full px-3.5 py-2 text-left text-xs text-[#f87171] hover:bg-red-500/10 transition-colors cursor-pointer"
								>
									Excluir regra
								</button>
							</div>
						)}
					</div>
				</div>
			</div>
		);
	};

	const otherSeasons = seasons.filter(
		(s) => String(s.id_season) !== String(selectedSeason),
	);

	return (
		<div className="max-w-[900px] w-full mx-auto flex flex-col gap-5 text-[#e6edf7] animate-slide-down">
			{/* Top Header */}
			<div className="flex flex-wrap gap-4 justify-between items-start">
				<div>
					<h1 className="m-0 text-[28px] font-bold tracking-[-0.01em] text-[#e6edf7]">
						Regras de pontuação
					</h1>
					<div className="text-[#94a3b8] text-sm mt-1">
						Pontos por evento. Cada temporada tem o seu conjunto de
						regras.
					</div>
				</div>
				<button
					type="button"
					onClick={openCreateModal}
					disabled={!selectedSeason}
					className="min-h-[44px] px-[18px] rounded-[10px] font-semibold text-sm bg-[#2563eb] hover:bg-blue-500 disabled:opacity-45 text-white border-0 cursor-pointer whitespace-nowrap transition-colors"
				>
					+ Nova regra
				</button>
			</div>

			{/* Season Bar */}
			<div className="flex flex-wrap gap-3 items-center justify-between bg-blue-500/[0.08] border border-blue-500/[0.22] rounded-xl px-4 py-3">
				<div className="flex items-center gap-3 flex-wrap">
					<select
						aria-label="Selecionar temporada"
						value={selectedSeason}
						onChange={(e) =>
							setSelectedSeasonOverride(e.target.value)
						}
						className="min-h-[40px] px-3.5 rounded-[10px] border border-white/[0.14] bg-[#0b1220] text-[#e6edf7] font-semibold text-sm outline-none focus:border-blue-500 cursor-pointer"
					>
						{seasons.map((s) => (
							<option
								key={s.id_season}
								value={s.id_season}
								className="bg-[#0b1220] text-[#e6edf7]"
							>
								Temporada {s.number}
							</option>
						))}
					</select>

					{currentSelectedSeasonObj?.is_active ? (
						<span className="text-xs font-semibold px-2.5 py-[3px] rounded-full bg-emerald-500/[0.14] text-[#4ade80]">
							Atual
						</span>
					) : (
						<span className="text-xs font-semibold px-2.5 py-[3px] rounded-full bg-white/[0.07] text-[#94a3b8]">
							Encerrada
						</span>
					)}

					<span className="text-[13px] text-[#94a3b8]">
						{rules.length}{' '}
						{rules.length === 1 ? 'regra' : 'regras'} · alterar aqui
						não muda outras temporadas
					</span>
				</div>

				<button
					type="button"
					disabled={!selectedSeason}
					onClick={openCopyModal}
					className="min-h-[40px] px-3.5 rounded-lg border border-white/[0.14] bg-transparent hover:bg-white/[0.05] text-[#e6edf7] font-medium text-[13px] cursor-pointer whitespace-nowrap transition-colors"
				>
					Copiar de outra temporada…
				</button>
			</div>

			{rules.length === 0 ? (
				<div className="bg-[#111a2e] border border-white/[0.07] rounded-[16px] p-8 text-center flex flex-col items-center gap-3">
					<div className="text-sm text-[#94a3b8]">
						Nenhuma regra configurada para esta temporada ainda.
					</div>
					<div className="flex flex-wrap gap-2.5 justify-center">
						<button
							type="button"
							onClick={openCopyModal}
							className="min-h-[40px] px-4 rounded-lg border border-white/[0.14] bg-white/[0.03] hover:bg-white/[0.06] text-[#e6edf7] font-medium text-sm cursor-pointer transition-colors"
						>
							Copiar de outra temporada / Padrão…
						</button>
						<button
							type="button"
							onClick={openCreateModal}
							className="min-h-[40px] px-4 rounded-lg bg-[#2563eb] hover:bg-blue-500 text-white font-semibold text-sm cursor-pointer transition-colors"
						>
							+ Nova regra
						</button>
					</div>
				</div>
			) : (
				<>
					{/* Por partida */}
					<section className="bg-[#111a2e] border border-white/[0.07] rounded-[16px] overflow-hidden">
						<div className="px-5 py-4 flex justify-between items-baseline">
							<h2 className="m-0 text-base font-semibold text-[#e6edf7]">
								Por partida
							</h2>
							<span className="text-[13px] text-[#94a3b8]">
								{matchRules.length}{' '}
								{matchRules.length === 1 ? 'regra' : 'regras'}
							</span>
						</div>
						{matchRules.length === 0 ? (
							<div className="px-5 py-4 border-t border-white/[0.06] text-[13px] text-[#94a3b8]">
								Nenhuma regra por partida cadastrada.
							</div>
						) : (
							matchRules.map(renderRuleRow)
						)}
					</section>

					{/* Por rodada */}
					<section className="bg-[#111a2e] border border-white/[0.07] rounded-[16px] overflow-hidden">
						<div className="px-5 py-4 flex justify-between items-baseline">
							<h2 className="m-0 text-base font-semibold text-[#e6edf7]">
								Por rodada
							</h2>
							<span className="text-[13px] text-[#94a3b8]">
								{roundRules.length}{' '}
								{roundRules.length === 1 ? 'regra' : 'regras'}
							</span>
						</div>
						{roundRules.length === 0 ? (
							<div className="px-5 py-4 border-t border-white/[0.06] text-[13px] text-[#94a3b8]">
								Nenhuma regra por rodada cadastrada.
							</div>
						) : (
							roundRules.map(renderRuleRow)
						)}
					</section>

					{/* Por temporada (se houver) */}
					{seasonRules.length > 0 && (
						<section className="bg-[#111a2e] border border-white/[0.07] rounded-[16px] overflow-hidden">
							<div className="px-5 py-4 flex justify-between items-baseline">
								<h2 className="m-0 text-base font-semibold text-[#e6edf7]">
									Por temporada
								</h2>
								<span className="text-[13px] text-[#94a3b8]">
									{seasonRules.length}{' '}
									{seasonRules.length === 1
										? 'regra'
										: 'regras'}
								</span>
							</div>
							{seasonRules.map(renderRuleRow)}
						</section>
					)}
				</>
			)}

			{/* Modal: Criar / Editar Regra */}
			<Modal
				isOpen={isModalOpen}
				onClose={() => setIsModalOpen(false)}
				title={editingRule ? 'Editar Regra' : 'Nova Regra de Pontuação'}
			>
				<form
					onSubmit={(e) => {
						e.preventDefault();
						saveMutation.mutate();
					}}
					className="flex flex-col gap-3"
				>
					<FormField label="Evento">
						<Select
							value={form.event_type}
							onChange={(e) =>
								setForm({ ...form, event_type: e.target.value })
							}
						>
							{EVENT_TYPE_OPTIONS.map((opt) => (
								<option key={opt.value} value={opt.value}>
									{opt.label}
								</option>
							))}
						</Select>
					</FormField>

					<FormField label="Contexto">
						<Select
							value={form.context}
							onChange={(e) =>
								setForm({
									...form,
									context: e.target.value as
										| 'match'
										| 'round'
										| 'season',
								})
							}
						>
							<option value="match">Por partida (match)</option>
							<option value="round">Por rodada (round)</option>
							<option value="season">
								Por temporada (season)
							</option>
						</Select>
					</FormField>

					<FormField label="Pontos (pode ser negativo)">
						<Input
							type="number"
							value={form.points}
							onChange={(e) =>
								setForm({
									...form,
									points: parseInt(e.target.value, 10) || 0,
								})
							}
							required
						/>
					</FormField>

					<div className="flex gap-3 mt-2">
						<Button
							type="submit"
							disabled={saveMutation.isPending}
						>
							{saveMutation.isPending
								? 'Salvando...'
								: 'Salvar'}
						</Button>
						<Button
							type="button"
							variant="ghost"
							onClick={() => setIsModalOpen(false)}
						>
							Cancelar
						</Button>
					</div>
				</form>
			</Modal>

			{/* Modal: Copiar de outra temporada / Aplicar regras padrão */}
			<Modal
				isOpen={isCopyModalOpen}
				onClose={() => setIsCopyModalOpen(false)}
				title="Copiar regras de pontuação"
			>
				<div className="flex flex-col gap-4">
					<p className="text-xs text-[#94a3b8]">
						Escolha se deseja aplicar as regras padrão do sistema ou
						copiar o conjunto de regras de outra temporada para a{' '}
						<strong className="text-[#e6edf7]">
							Temporada {currentSelectedSeasonObj?.number}
						</strong>
						.
					</p>

					<div className="flex flex-col gap-2">
						<label
							className={`flex items-start gap-3 p-3 rounded-xl border cursor-pointer transition-colors ${
								copySourceType === 'defaults'
									? 'border-blue-500/50 bg-blue-500/10'
									: 'border-white/10 bg-white/[0.02] hover:bg-white/[0.04]'
							}`}
						>
							<input
								type="radio"
								name="copySourceType"
								checked={copySourceType === 'defaults'}
								onChange={() => setCopySourceType('defaults')}
								className="mt-1"
							/>
							<div>
								<div className="text-sm font-semibold text-[#e6edf7]">
									Aplicar regras padrão do sistema
								</div>
								<div className="text-xs text-[#94a3b8]">
									Cria todas as regras padrão de partida e
									rodada sem duplicar regras já existentes.
								</div>
							</div>
						</label>

						<label
							className={`flex items-start gap-3 p-3 rounded-xl border cursor-pointer transition-colors ${
								copySourceType === 'season'
									? 'border-blue-500/50 bg-blue-500/10'
									: 'border-white/10 bg-white/[0.02] hover:bg-white/[0.04]'
							} ${otherSeasons.length === 0 ? 'opacity-50 cursor-not-allowed' : ''}`}
						>
							<input
								type="radio"
								name="copySourceType"
								disabled={otherSeasons.length === 0}
								checked={copySourceType === 'season'}
								onChange={() => setCopySourceType('season')}
								className="mt-1"
							/>
							<div className="flex-1">
								<div className="text-sm font-semibold text-[#e6edf7]">
									Copiar de outra temporada
								</div>
								<div className="text-xs text-[#94a3b8] mb-2">
									Importa as regras e pontuações configuradas
									em uma temporada anterior.
								</div>
								{copySourceType === 'season' &&
									otherSeasons.length > 0 && (
										<div className="flex flex-col gap-2.5 mt-2">
											<Select
												value={copySourceSeasonId}
												onChange={(e) =>
													setCopySourceSeasonId(
														e.target.value,
													)
												}
											>
												{otherSeasons.map((s) => (
													<option
														key={s.id_season}
														value={s.id_season}
													>
														Temporada {s.number}{' '}
														{s.is_active
															? '(Atual)'
															: ''}
													</option>
												))}
											</Select>
											<label className="flex items-center gap-2 text-xs text-[#94a3b8] cursor-pointer">
												<input
													type="checkbox"
													checked={copyOverwrite}
													onChange={(e) =>
														setCopyOverwrite(
															e.target.checked,
														)
													}
												/>
												Sobrescrever pontuações das
												regras que já existem nesta
												temporada
											</label>
										</div>
									)}
							</div>
						</label>
					</div>

					<div className="flex gap-3 mt-1">
						<Button
							type="button"
							disabled={copyOrSeedMutation.isPending}
							onClick={() => copyOrSeedMutation.mutate()}
						>
							{copyOrSeedMutation.isPending
								? 'Aplicando...'
								: copySourceType === 'defaults'
									? 'Aplicar Regras Padrão'
									: 'Copiar Regras'}
						</Button>
						<Button
							type="button"
							variant="ghost"
							onClick={() => setIsCopyModalOpen(false)}
						>
							Cancelar
						</Button>
					</div>
				</div>
			</Modal>
		</div>
	);
}
