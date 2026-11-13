'use client';

import { Button } from '@/components/Button';
import { DatePicker } from '@/components/DatePicker';
import { FormField } from '@/components/FormField';
import { Input } from '@/components/Input';
import { Loading } from '@/components/Loading';
import { Modal } from '@/components/Modal';
import { useAuth } from '@/context/AuthContext';
import { fetchAPI } from '@/lib/api';
import { useMutation, useQueries, useQueryClient } from '@tanstack/react-query';
import {
	ArrowLeft,
	Calendar,
	MapPin,
	MoreVertical,
	Pencil,
	Plus,
	Power,
	Trophy,
	User,
} from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';

export default function SeasonDetail({ params }: { params: { id: string } }) {
	const router = useRouter();
	const queryClient = useQueryClient();
	const { user } = useAuth();
	const isAdmin = Boolean(user?.is_admin || user?.role === 'admin');

	const [isMenuOpen, setIsMenuOpen] = useState(false);
	const menuRef = useRef<HTMLDivElement>(null);

	const [isCreating, setIsCreating] = useState(false);
	const [date, setDate] = useState('');
	const [location, setLocation] = useState('Arena Baygon');
	const [referee, setReferee] = useState('');

	const [isEditOpen, setIsEditOpen] = useState(false);
	const [editInitialDate, setEditInitialDate] = useState('');
	const [editEndDate, setEditEndDate] = useState('');
	const [editIsActive, setEditIsActive] = useState(true);

	useEffect(() => {
		const handleClickOutside = (e: MouseEvent) => {
			if (
				menuRef.current &&
				!menuRef.current.contains(e.target as Node)
			) {
				setIsMenuOpen(false);
			}
		};
		if (isMenuOpen) {
			document.addEventListener('mousedown', handleClickOutside);
		}
		return () =>
			document.removeEventListener('mousedown', handleClickOutside);
	}, [isMenuOpen]);

	const [seasonQuery, roundsQuery] = useQueries({
		queries: [
			{
				queryKey: ['seasons', params.id],
				queryFn: () => fetchAPI(`/seasons/${params.id}`),
			},
			{
				queryKey: ['rounds', 'season', params.id],
				queryFn: () => fetchAPI(`/rounds/season/${params.id}`),
			},
		],
	});

	const createRoundMutation = useMutation({
		mutationFn: (body: object) =>
			fetchAPI('/rounds/', {
				method: 'POST',
				body: JSON.stringify(body),
			}),
		onSuccess: () => {
			queryClient.invalidateQueries({
				queryKey: ['rounds', 'season', params.id],
			});
			setIsCreating(false);
			setDate('');
			setLocation('Arena Baygon');
			setReferee('');
		},
	});

	const updateSeasonMutation = useMutation({
		mutationFn: (body: object) =>
			fetchAPI(`/seasons/${params.id}`, {
				method: 'PUT',
				body: JSON.stringify(body),
			}),
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ['seasons', params.id] });
			queryClient.invalidateQueries({ queryKey: ['seasons'] });
			setIsEditOpen(false);
		},
		onError: (err: Error) =>
			alert(`Erro ao atualizar temporada: ${err.message}`),
	});

	const handleCreate = (e: React.FormEvent) => {
		e.preventDefault();
		if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
			alert('Informe uma data válida com ano de 4 dígitos (DD/MM/AAAA).');
			return;
		}
		createRoundMutation.mutate({
			date: new Date(`${date}T12:00:00`).toISOString(),
			location,
			referee,
			round_number: (roundsQuery.data?.length ?? 0) + 1,
			season_id: parseInt(params.id, 10),
		});
	};

	if (seasonQuery.isLoading || roundsQuery.isLoading) return <Loading />;
	if (!seasonQuery.data)
		return <div className="text-muted p-4">Temporada não encontrada.</div>;

	const season = seasonQuery.data;
	const rounds: any[] = roundsQuery.data ?? [];

	const openEditModal = () => {
		setIsMenuOpen(false);
		setEditInitialDate(
			season.initial_date
				? new Date(season.initial_date).toISOString().slice(0, 10)
				: '',
		);
		setEditEndDate(
			season.end_date
				? new Date(season.end_date).toISOString().slice(0, 10)
				: '',
		);
		setEditIsActive(Boolean(season.is_active));
		setIsEditOpen(true);
	};

	const handleToggleActive = () => {
		setIsMenuOpen(false);
		const nextActive = !season.is_active;
		const msg = nextActive
			? `Deseja reativar a Temporada #${season.number}?`
			: `Deseja encerrar a Temporada #${season.number}?`;
		if (!window.confirm(msg)) return;
		updateSeasonMutation.mutate({
			is_active: nextActive,
			end_date: nextActive ? null : new Date().toISOString(),
		});
	};

	return (
		<div className="flex flex-col gap-6 animate-slide-down">
			{/* Header Compacto */}
			<div className="bg-surface border border-border rounded-xl p-4 sm:p-5 flex items-center justify-between gap-4">
				<div className="flex items-center gap-3 min-w-0">
					<button
						type="button"
						onClick={() => router.push('/seasons')}
						className="w-9 h-9 rounded-lg bg-background/60 border border-border text-muted hover:text-main hover:border-border-hover flex items-center justify-center shrink-0 transition-colors cursor-pointer"
						title="Voltar para Temporadas"
					>
						<ArrowLeft className="w-4 h-4" />
					</button>

					<div className="min-w-0">
						<div className="flex items-center gap-2.5 flex-wrap">
							<h1 className="text-xl sm:text-2xl font-bold text-main">
								Temporada #{season.number}
							</h1>
							<span
								className={`text-[11px] font-semibold px-2.5 py-0.5 rounded-full uppercase tracking-wider ${
									season.is_active
										? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
										: 'bg-zinc-500/15 text-zinc-400 border border-zinc-500/30'
								}`}
							>
								{season.is_active ? 'Ativa' : 'Encerrada'}
							</span>
							<span className="text-[11px] font-medium px-2 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/20">
								{rounds.length}{' '}
								{rounds.length === 1 ? 'rodada' : 'rodadas'}
							</span>
						</div>

						<div className="flex items-center gap-2 text-xs text-muted mt-1 flex-wrap">
							<span className="inline-flex items-center gap-1">
								<Calendar className="w-3.5 h-3.5 text-muted" />
								Início:{' '}
								{season.initial_date
									? new Date(
											season.initial_date,
										).toLocaleDateString('pt-BR')
									: '—'}
							</span>
							{season.end_date && (
								<span>
									· Término:{' '}
									{new Date(
										season.end_date,
									).toLocaleDateString('pt-BR')}
								</span>
							)}
						</div>
					</div>
				</div>

				{isAdmin && (
					<div className="flex items-center gap-2 shrink-0">
						{/* Botão ícone Nova Rodada fora */}
						<button
							type="button"
							onClick={() => setIsCreating(true)}
							title="Nova Rodada"
							aria-label="Nova Rodada"
							className="w-9 h-9 rounded-lg bg-primary text-white hover:bg-primary-hover flex items-center justify-center shadow-sm shadow-primary/20 transition-all cursor-pointer"
						>
							<Plus className="w-4 h-4" />
						</button>

						{/* Dropdown Editar / Encerrar Temporada */}
						<div ref={menuRef} className="relative">
							<button
								type="button"
								onClick={() => setIsMenuOpen((prev) => !prev)}
								title="Opções da Temporada"
								aria-label="Opções da Temporada"
								className={`w-9 h-9 rounded-lg border flex items-center justify-center transition-all cursor-pointer ${
									isMenuOpen
										? 'bg-white/10 border-primary text-main'
										: 'bg-background/60 border-border text-muted hover:text-main hover:border-border-hover'
								}`}
							>
								<MoreVertical className="w-4 h-4" />
							</button>

							{isMenuOpen && (
								<div className="absolute right-0 top-full mt-2 w-48 bg-[#0f172a] border border-white/15 rounded-xl p-1.5 shadow-[0_12px_32px_rgba(0,0,0,0.6)] z-50 animate-slide-down">
									<button
										type="button"
										onClick={openEditModal}
										className="w-full px-3 py-2 rounded-lg text-xs font-medium text-main hover:bg-white/5 flex items-center gap-2.5 transition-colors cursor-pointer text-left"
									>
										<Pencil className="w-3.5 h-3.5 text-primary shrink-0" />
										<span>Editar Temporada</span>
									</button>

									<div className="my-1 border-t border-border" />

									<button
										type="button"
										onClick={handleToggleActive}
										disabled={updateSeasonMutation.isPending}
										className={`w-full px-3 py-2 rounded-lg text-xs font-medium flex items-center gap-2.5 transition-colors cursor-pointer text-left disabled:opacity-50 ${
											season.is_active
												? 'text-red-400 hover:bg-red-500/10'
												: 'text-emerald-400 hover:bg-emerald-500/10'
										}`}
									>
										<Power className="w-3.5 h-3.5 shrink-0" />
										<span>
											{season.is_active
												? 'Encerrar Temporada'
												: 'Reativar Temporada'}
										</span>
									</button>
								</div>
							)}
						</div>
					</div>
				)}
			</div>

			{/* Grid de Rodadas */}
			{rounds.length === 0 ? (
				<div className="bg-surface border border-border rounded-xl p-8 text-center text-muted text-sm">
					Nenhuma rodada cadastrada nesta temporada.
					{isAdmin &&
						' Clique no botão "+" acima para criar a primeira rodada.'}
				</div>
			) : (
				<div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
					{rounds.map((r) => (
						<Link
							key={r.id_round}
							href={`/rounds/${r.id_round}`}
							className="group bg-surface border border-border rounded-xl p-4 flex flex-col justify-between hover:border-primary hover:shadow-md transition-all duration-200 cursor-pointer"
						>
							<div>
								<div className="flex items-center justify-between gap-2 mb-3">
									<span className="font-bold text-base text-main group-hover:text-primary transition-colors flex items-center gap-2">
										<Trophy className="w-4 h-4 text-primary/80" />
										Rodada #{r.round_number}
									</span>
								</div>

								<div className="flex flex-col gap-1.5 text-xs text-muted">
									<div className="flex items-center gap-1.5">
										<Calendar className="w-3.5 h-3.5 text-muted shrink-0" />
										<span>
											{new Date(
												r.date,
											).toLocaleDateString('pt-BR')}
										</span>
									</div>
									{r.location && (
										<div className="flex items-center gap-1.5">
											<MapPin className="w-3.5 h-3.5 text-muted shrink-0" />
											<span className="truncate">
												{r.location}
											</span>
										</div>
									)}
									{r.referee && (
										<div className="flex items-center gap-1.5">
											<User className="w-3.5 h-3.5 text-muted shrink-0" />
											<span className="truncate">
												Árbitro: {r.referee}
											</span>
										</div>
									)}
								</div>
							</div>

							<div className="mt-4 pt-2.5 border-t border-border/60 flex items-center justify-between text-xs text-muted group-hover:text-primary font-medium transition-colors">
								<span>Ver detalhes</span>
								<span>&rarr;</span>
							</div>
						</Link>
					))}
				</div>
			)}

			<Modal
				isOpen={isCreating}
				onClose={() => setIsCreating(false)}
				title="Nova Rodada"
			>
				<form onSubmit={handleCreate} className="flex flex-col gap-3">
					<FormField label="Data da Rodada">
						<DatePicker
							value={date}
							onChange={(e) => setDate(e.target.value)}
							required
						/>
					</FormField>
					<FormField label="Local">
						<Input
							type="text"
							value={location}
							onChange={(e) => setLocation(e.target.value)}
							placeholder="Ex: Arena Baygon"
							required
						/>
					</FormField>
					<FormField label="Árbitro">
						<Input
							type="text"
							value={referee}
							onChange={(e) => setReferee(e.target.value)}
							placeholder="Nome do árbitro"
							required
						/>
					</FormField>
					<div className="flex justify-end gap-2 mt-3">
						<Button
							type="button"
							size="sm"
							variant="ghost"
							className="!w-auto"
							onClick={() => setIsCreating(false)}
						>
							Cancelar
						</Button>
						<Button
							type="submit"
							size="sm"
							className="!w-auto"
							disabled={createRoundMutation.isPending}
						>
							{createRoundMutation.isPending
								? 'Criando...'
								: 'Criar Rodada'}
						</Button>
					</div>
				</form>
			</Modal>

			<Modal
				isOpen={isEditOpen}
				onClose={() => setIsEditOpen(false)}
				title={`Editar Temporada #${season.number}`}
			>
				<form
					onSubmit={(e) => {
						e.preventDefault();
						if (
							editInitialDate &&
							!/^\d{4}-\d{2}-\d{2}$/.test(editInitialDate)
						) {
							alert(
								'Data inicial inválida. Use um ano de 4 dígitos.',
							);
							return;
						}
						if (
							editEndDate &&
							!/^\d{4}-\d{2}-\d{2}$/.test(editEndDate)
						) {
							alert(
								'Data final inválida. Use um ano de 4 dígitos.',
							);
							return;
						}
						updateSeasonMutation.mutate({
							initial_date: editInitialDate
								? new Date(
										`${editInitialDate}T00:00:00`,
									).toISOString()
								: undefined,
							end_date: editEndDate
								? new Date(
										`${editEndDate}T23:59:59`,
									).toISOString()
								: null,
							is_active: editIsActive,
						});
					}}
					className="flex flex-col gap-3"
				>
					<FormField label="Data de Início">
						<DatePicker
							value={editInitialDate}
							onChange={(e) => setEditInitialDate(e.target.value)}
							required
						/>
					</FormField>
					<FormField label="Data de Término (opcional)">
						<DatePicker
							value={editEndDate}
							onChange={(e) => setEditEndDate(e.target.value)}
						/>
					</FormField>
					<label className="flex items-center gap-2 text-sm text-main cursor-pointer py-1">
						<input
							type="checkbox"
							checked={editIsActive}
							onChange={(e) => setEditIsActive(e.target.checked)}
							className="rounded border-border text-primary focus:ring-primary"
						/>
						Temporada ativa
					</label>
					<div className="flex justify-end gap-2 mt-2">
						<Button
							type="button"
							size="sm"
							variant="ghost"
							className="!w-auto"
							onClick={() => setIsEditOpen(false)}
						>
							Cancelar
						</Button>
						<Button
							type="submit"
							size="sm"
							className="!w-auto"
							disabled={updateSeasonMutation.isPending}
						>
							{updateSeasonMutation.isPending
								? 'Salvando...'
								: 'Salvar Alterações'}
						</Button>
					</div>
				</form>
			</Modal>
		</div>
	);
}
