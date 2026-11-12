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
import { ShieldAlert, Trash2 } from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';

interface RuleItem {
	id_event_score_rule: number;
	season_id: number;
	event_type: string;
	context: 'match' | 'round' | 'season';
	points: number;
}

const EVENT_TYPE_OPTIONS = [
	{ value: 'gol', label: 'Gol (gol)' },
	{ value: 'assistencia', label: 'Assistência (assistencia)' },
	{ value: 'vitoria_mandante', label: 'Vitória Mandante (vitoria_mandante)' },
	{ value: 'vitoria_visitante', label: 'Vitória Visitante (vitoria_visitante)' },
	{ value: 'empate', label: 'Empate (empate)' },
	{ value: 'gol_contra', label: 'Gol Contra (gol_contra)' },
	{ value: 'cartao_amarelo', label: 'Cartão Amarelo (cartao_amarelo)' },
	{ value: 'cartao_vermelho', label: 'Cartão Vermelho (cartao_vermelho)' },
	{ value: 'ouro', label: 'Ouro (ouro)' },
	{ value: 'time_vencedor_rodada', label: 'Time Vencedor Rodada (time_vencedor_rodada)' },
	{ value: 'bola_cheia', label: 'Bola Cheia (bola_cheia)' },
	{ value: 'bola_murcha', label: 'Bola Murcha (bola_murcha)' },
	{ value: 'gol_rodada', label: 'Gol da Rodada (gol_rodada)' },
	{ value: 'defesa_rodada', label: 'Defesa da Rodada (defesa_rodada)' },
	{ value: 'drible_rodada', label: 'Drible da Rodada (drible_rodada)' },
	{ value: 'inacreditavel', label: 'Inacreditável (inacreditavel)' },
];

export default function RulesPage() {
	const { user, loading: authLoading } = useAuth();
	const isAdmin = Boolean(user?.is_admin || user?.role === 'admin');
	const queryClient = useQueryClient();

	const [selectedSeasonOverride, setSelectedSeasonOverride] = useState('');
	const [isModalOpen, setIsModalOpen] = useState(false);
	const [editingRule, setEditingRule] = useState<RuleItem | null>(null);
	const [form, setForm] = useState({
		event_type: 'gol',
		context: 'match' as 'match' | 'round' | 'season',
		points: 1,
	});

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

	const rulesQuery = useQuery<RuleItem[]>({
		queryKey: ['rules', 'season', selectedSeason],
		queryFn: () => fetchAPI(`/rules/season/${selectedSeason}`).catch(() => []),
		enabled: isAdmin && Boolean(selectedSeason),
	});

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

	const deleteMutation = useMutation({
		mutationFn: (id: number) =>
			fetchAPI(`/rules/${id}`, { method: 'DELETE' }),
		onSuccess: () => {
			queryClient.invalidateQueries({
				queryKey: ['rules', 'season', selectedSeason],
			});
		},
		onError: (err: Error) => alert(`Erro ao remover regra: ${err.message}`),
	});

	const seedDefaultsMutation = useMutation({
		mutationFn: () =>
			fetchAPI(`/rules/season/${selectedSeason}/seed-defaults`, {
				method: 'POST',
			}),
		onSuccess: () => {
			queryClient.invalidateQueries({
				queryKey: ['rules', 'season', selectedSeason],
			});
		},
		onError: (err: Error) =>
			alert(`Erro ao aplicar regras padrão: ${err.message}`),
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
		setIsModalOpen(true);
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

	return (
		<div className="flex flex-col gap-6 animate-slide-down">
			<div className="flex items-center justify-between flex-wrap gap-4">
				<div>
					<h1 className="text-3xl text-main">
						Configuração de Regras (Admin)
					</h1>
					<p className="text-sm text-muted mt-1">
						Defina os pontos por evento e premiação de cada
						temporada.
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
					<Button
						variant="ghost"
						onClick={() => seedDefaultsMutation.mutate()}
						disabled={
							!selectedSeason || seedDefaultsMutation.isPending
						}
						className="w-auto"
					>
						{seedDefaultsMutation.isPending
							? 'Aplicando...'
							: 'Aplicar Regras Padrão'}
					</Button>
					<Button
						onClick={openCreateModal}
						disabled={!selectedSeason}
						className="w-auto"
					>
						+ Nova Regra
					</Button>
				</div>
			</div>

			{rules.length === 0 ? (
				<div className="bg-surface border border-border rounded-xl p-6 text-muted text-sm">
					Nenhuma regra configurada para esta temporada ainda. Clique em
					&quot;Aplicar Regras Padrão&quot; ou &quot;+ Nova Regra&quot;.
				</div>
			) : (
				<div className="flex flex-col gap-3">
					{rules.map((r) => (
						<div
							key={r.id_event_score_rule}
							className="bg-surface border border-border rounded-xl p-4 flex items-center justify-between gap-4"
						>
							<div>
								<strong className="text-main text-sm block">
									{r.event_type}
								</strong>
								<span className="text-xs text-muted">
									Contexto: {r.context}
								</span>
							</div>
							<div className="flex items-center gap-3 shrink-0">
								<span
									className={`text-sm font-semibold ${
										r.points >= 0
											? 'text-primary'
											: 'text-red-400'
									}`}
								>
									{r.points > 0 ? `+${r.points}` : r.points}{' '}
									pts
								</span>
								<Button
									size="sm"
									variant="ghost"
									onClick={() => openEditModal(r)}
									className="w-auto"
								>
									Editar
								</Button>
								<button
									type="button"
									onClick={() =>
										deleteMutation.mutate(
											r.id_event_score_rule,
										)
									}
									className="p-1.5 text-red-400 hover:bg-red-500/10 rounded cursor-pointer"
									title="Excluir regra"
								>
									<Trash2 className="w-4 h-4" />
								</button>
							</div>
						</div>
					))}
				</div>
			)}

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
							<option value="match">Partida (match)</option>
							<option value="round">Rodada (round)</option>
							<option value="season">Temporada (season)</option>
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
		</div>
	);
}
