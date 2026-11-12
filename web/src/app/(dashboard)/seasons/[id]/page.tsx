'use client';

import { Button } from '@/components/Button';
import { FormField } from '@/components/FormField';
import { Input } from '@/components/Input';
import { Loading } from '@/components/Loading';
import { Modal } from '@/components/Modal';
import { useAuth } from '@/context/AuthContext';
import { fetchAPI } from '@/lib/api';
import { useMutation, useQueries, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { useState } from 'react';

export default function SeasonDetail({ params }: { params: { id: string } }) {
	const queryClient = useQueryClient();
	const { user } = useAuth();
	const isAdmin = Boolean(user?.is_admin || user?.role === 'admin');

	const [isCreating, setIsCreating] = useState(false);
	const [date, setDate] = useState('');
	const [location, setLocation] = useState('Arena Baygon');
	const [referee, setReferee] = useState('');

	const [isEditOpen, setIsEditOpen] = useState(false);
	const [editInitialDate, setEditInitialDate] = useState('');
	const [editEndDate, setEditEndDate] = useState('');
	const [editIsActive, setEditIsActive] = useState(true);

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
			setLocation('');
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
		createRoundMutation.mutate({
			date: new Date(date).toISOString(),
			location,
			referee,
			round_number: (roundsQuery.data?.length ?? 0) + 1,
			season_id: parseInt(params.id),
		});
	};

	if (seasonQuery.isLoading || roundsQuery.isLoading) return <Loading />;
	if (!seasonQuery.data)
		return <div className="text-muted p-4">Temporada não encontrada.</div>;

	const season = seasonQuery.data;
	const rounds: any[] = roundsQuery.data ?? [];

	const openEditModal = () => {
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
			<div className="flex items-center justify-between flex-wrap gap-4">
				<div>
					<div className="flex items-center gap-3">
						<h1 className="text-3xl text-main">
							Temporada #{season.number}
						</h1>
						<span
							className={`text-xs font-semibold px-2.5 py-0.5 rounded-full ${
								season.is_active
									? 'bg-green-500/20 text-green-400'
									: 'bg-zinc-500/20 text-zinc-400'
							}`}
						>
							{season.is_active ? 'Ativa' : 'Encerrada'}
						</span>
					</div>
					<p className="text-xs text-muted mt-1">
						Início:{' '}
						{season.initial_date
							? new Date(season.initial_date).toLocaleDateString('pt-BR')
							: '—'}
						{season.end_date &&
							` · Término: ${new Date(season.end_date).toLocaleDateString('pt-BR')}`}
					</p>
				</div>
				{isAdmin && (
					<div className="flex flex-wrap gap-2">
						<Button
							variant="ghost"
							onClick={openEditModal}
							className="w-auto"
						>
							Editar Temporada
						</Button>
						<Button
							variant={season.is_active ? 'danger' : 'ghost'}
							onClick={handleToggleActive}
							disabled={updateSeasonMutation.isPending}
							className="w-auto"
						>
							{season.is_active
								? 'Encerrar Temporada'
								: 'Reativar Temporada'}
						</Button>
						<Button
							onClick={() => setIsCreating(true)}
							className="w-auto"
						>
							Nova Rodada
						</Button>
					</div>
				)}
			</div>

			<div className="grid grid-cols-[repeat(auto-fill,minmax(240px,1fr))] gap-4">
				{rounds.map((r) => (
					<Link
						key={r.id_round}
						href={`/rounds/${r.id_round}`}
						className="bg-surface border border-border rounded-xl p-5 hover:border-primary transition-colors"
					>
						<h2 className="text-lg font-semibold mb-2">
							Rodada {r.round_number}
						</h2>
						<p className="text-muted text-sm">
							<strong>Data:</strong>{' '}
							{new Date(r.date).toLocaleDateString('pt-BR')}
						</p>
						<p className="text-muted text-sm">
							<strong>Local:</strong> {r.location}
						</p>
					</Link>
				))}
			</div>

			<Modal
				isOpen={isCreating}
				onClose={() => setIsCreating(false)}
				title="Nova Rodada"
			>
				<form onSubmit={handleCreate} className="flex flex-col gap-2">
					<FormField label="Data">
						<Input
							type="date"
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
					<div className="flex gap-3 mt-2">
						<Button
							type="submit"
							disabled={createRoundMutation.isPending}
						>
							{createRoundMutation.isPending
								? 'Criando...'
								: 'Criar'}
						</Button>
						<Button
							type="button"
							variant="ghost"
							onClick={() => setIsCreating(false)}
						>
							Cancelar
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
						updateSeasonMutation.mutate({
							initial_date: editInitialDate
								? new Date(`${editInitialDate}T00:00:00`).toISOString()
								: undefined,
							end_date: editEndDate
								? new Date(`${editEndDate}T23:59:59`).toISOString()
								: null,
							is_active: editIsActive,
						});
					}}
					className="flex flex-col gap-3"
				>
					<FormField label="Data de Início">
						<Input
							type="date"
							value={editInitialDate}
							onChange={(e) => setEditInitialDate(e.target.value)}
							required
						/>
					</FormField>
					<FormField label="Data de Término (opcional)">
						<Input
							type="date"
							value={editEndDate}
							onChange={(e) => setEditEndDate(e.target.value)}
						/>
					</FormField>
					<label className="flex items-center gap-2 text-sm text-main cursor-pointer">
						<input
							type="checkbox"
							checked={editIsActive}
							onChange={(e) => setEditIsActive(e.target.checked)}
						/>
						Temporada ativa
					</label>
					<div className="flex gap-3 mt-2">
						<Button
							type="submit"
							disabled={updateSeasonMutation.isPending}
						>
							{updateSeasonMutation.isPending
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
