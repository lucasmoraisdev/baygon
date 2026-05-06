'use client';

import { Button } from '@/components/Button';
import { FormField } from '@/components/FormField';
import { Input } from '@/components/Input';
import { Loading } from '@/components/Loading';
import { Modal } from '@/components/Modal';
import { fetchAPI } from '@/lib/api';
import { useMutation, useQueries, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { useState } from 'react';

export default function SeasonDetail({ params }: { params: { id: string } }) {
	const queryClient = useQueryClient();
	const [isCreating, setIsCreating] = useState(false);
	const [date, setDate] = useState('');
	const [location, setLocation] = useState('Arena Baygon');
	const [referee, setReferee] = useState('');

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

	return (
		<div className="flex flex-col gap-6 animate-slide-down">
			<div className="flex items-center justify-between">
				<h1 className="text-3xl  text-main">
					Temporada #{season.number}
				</h1>
				<Button onClick={() => setIsCreating(true)} className="w-60!">
					Nova Rodada
				</Button>
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
		</div>
	);
}
