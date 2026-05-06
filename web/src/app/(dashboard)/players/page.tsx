'use client';

import { Button } from '@/components/Button';
import { FormField } from '@/components/FormField';
import { Input } from '@/components/Input';
import { Loading } from '@/components/Loading';
import { Modal } from '@/components/Modal';
import { Select } from '@/components/Select';
import SuspendModal from '@/components/SuspendModal';
import { useAuth } from '@/context/AuthContext';
import { fetchAPI } from '@/lib/api';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { useRef, useState } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';

interface Player {
	id_player: number;
	nome: string;
	apelido?: string;
	email?: string;
	telefone?: string;
	posicao?: 'goleiro' | 'pivo' | 'ala' | 'fixo';
	pe?: 'D' | 'E' | 'A';
	potes?: number;
	is_associate: boolean;
	is_guest: boolean;
}

const EMPTY_FORM = {
	nome: '',
	apelido: '',
	email: '',
	telefone: '',
	posicao: '' as Player['posicao'] | '',
	pe: '' as Player['pe'] | '',
	potes: '' as number | '',
	is_guest: false,
};

const PE_LABEL: Record<string, string> = {
	D: 'Direito',
	E: 'Esquerdo',
	A: 'Ambidestro',
};

export default function PlayersPage() {
	const { user } = useAuth();
	const isAdmin = user?.role === 'admin';
	const queryClient = useQueryClient();

	const [form, setForm] = useState(EMPTY_FORM);
	const [editingId, setEditingId] = useState<number | null>(null);
	const [isFormOpen, setIsFormOpen] = useState(false);
	const [suspendModalOpen, setSuspendModalOpen] = useState(false);
	const [playerToSuspend, setPlayerToSuspend] = useState<number | null>(null);

	const {
		data: players = [],
		isLoading,
		isError,
	} = useQuery<Player[]>({
		queryKey: ['players'],
		queryFn: () => fetchAPI('/players/'),
	});

	const saveMutation = useMutation({
		mutationFn: (body: object) => {
			const url = editingId ? `/players/${editingId}` : '/players/';
			const method = editingId ? 'PUT' : 'POST';
			return fetchAPI(url, { method, body: JSON.stringify(body) });
		},
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ['players'] });
			setIsFormOpen(false);
			setEditingId(null);
			setForm(EMPTY_FORM);
		},
		onError: (err: any) => {
			alert(
				`Erro ao salvar jogador: ${err.message ?? 'Erro desconhecido'}`,
			);
		},
	});

	const suspendMutation = useMutation({
		mutationFn: ({
			id,
			type,
			value,
		}: {
			id: number;
			type: string;
			value: number;
		}) =>
			fetchAPI(`/players/${id}/admin/suspend`, {
				method: 'POST',
				body: JSON.stringify({ suspension_type: type, value }),
			}),
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ['players'] });
			setSuspendModalOpen(false);
			setPlayerToSuspend(null);
			alert('Jogador suspenso com sucesso!');
		},
		onError: (err: any) => {
			alert(`Erro: ${err.message ?? 'Falha ao suspender'}`);
		},
	});

	const handleEdit = (player: Player) => {
		setEditingId(player.id_player);
		setForm({
			nome: player.nome,
			apelido: player.apelido ?? '',
			email: player.email ?? '',
			telefone: player.telefone ?? '',
			posicao: player.posicao ?? '',
			pe: player.pe ?? '',
			potes: player.potes ?? '',
			is_guest: player.is_guest,
		});
		setIsFormOpen(true);
	};

	const handleSave = (e: React.FormEvent) => {
		e.preventDefault();
		saveMutation.mutate({
			nome: form.nome,
			apelido: form.apelido || null,
			email: form.email || null,
			telefone: form.telefone || null,
			posicao: form.posicao || null,
			pe: form.pe || null,
			potes: form.potes ? parseInt(String(form.potes)) : null,
			is_associate: !form.is_guest,
			is_guest: form.is_guest,
		});
	};

	const closeForm = () => {
		setIsFormOpen(false);
		setEditingId(null);
		setForm(EMPTY_FORM);
	};

	const listRef = useRef<HTMLDivElement>(null);
	const virtualizer = useVirtualizer({
		count: players.length,
		getScrollElement: () => listRef.current,
		estimateSize: () => 90,
		overscan: 5,
	});

	if (isLoading) return <Loading />;
	if (isError)
		return (
			<div className="text-red-500 p-4">Erro ao carregar jogadores.</div>
		);

	return (
		<div className="flex flex-col gap-6 animate-slide-down">
			<div className="flex items-center justify-between">
				<h1 className="text-3xl text-main">
					Jogadores ({players.length})
				</h1>
				{isAdmin && (
					<Button
						onClick={() => {
							setEditingId(null);
							setForm(EMPTY_FORM);
							setIsFormOpen(true);
						}}
						className="w-60!"
					>
						Novo Jogador
					</Button>
				)}
			</div>

			{players.length === 0 ? (
				<div className="bg-surface border border-border rounded-xl p-6 text-muted text-sm">
					Nenhum jogador registrado.
				</div>
			) : (
				<div ref={listRef} className="overflow-y-auto max-h-[70vh]">
					<div style={{ height: virtualizer.getTotalSize(), position: 'relative' }}>
						{virtualizer.getVirtualItems().map((vItem) => {
							const player = players[vItem.index];
							return (
								<div
									key={player.id_player}
									data-index={vItem.index}
									ref={virtualizer.measureElement}
									style={{ position: 'absolute', top: 0, left: 0, width: '100%', transform: `translateY(${vItem.start}px)` }}
									className="pb-3"
								>
								<div className="bg-surface border border-border rounded-xl p-4 flex items-center gap-4">
							<div className="w-10 h-10 rounded-full bg-primary/20 text-primary font-bold flex items-center justify-center shrink-0">
								{player.nome.charAt(0).toUpperCase()}
							</div>
							<div className="flex flex-col gap-1 flex-1 min-w-0">
								<strong className="text-main">
									{player.apelido || player.nome}
								</strong>
								{player.apelido && (
									<span className="text-xs text-muted">
										Nome: {player.nome}
									</span>
								)}
								{player.email && (
									<span className="text-xs text-muted">
										{player.email}
									</span>
								)}
								{player.telefone && (
									<span className="text-xs text-muted">
										Tel: {player.telefone}
									</span>
								)}
								<div className="flex gap-2 flex-wrap mt-1">
									{player.posicao && (
										<span className="text-xs bg-blue-500/20 text-blue-400 px-2 py-0.5 rounded-full">
											{player.posicao
												.charAt(0)
												.toUpperCase() +
												player.posicao.slice(1)}
										</span>
									)}
									{player.pe && (
										<span className="text-xs bg-green-500/20 text-green-400 px-2 py-0.5 rounded-full">
											Pé: {PE_LABEL[player.pe]}
										</span>
									)}
									{player.potes && (
										<span className="text-xs bg-orange-500/20 text-orange-400 px-2 py-0.5 rounded-full">
											Pote {player.potes}
										</span>
									)}
									<span
										className={`text-xs px-2 py-0.5 rounded-full ${player.is_guest ? 'bg-yellow-500/20 text-yellow-400' : 'bg-primary/20 text-primary'}`}
									>
										{player.is_guest
											? 'Convidado'
											: 'Mensalista'}
									</span>
								</div>
							</div>
							<div className="flex items-center gap-2 shrink-0">
								{isAdmin && (
									<>
										<Button
											size="sm"
											variant="ghost"
											onClick={() => handleEdit(player)}
										>
											Editar
										</Button>
										<Button
											size="sm"
											variant="danger"
											onClick={() => {
												setPlayerToSuspend(
													player.id_player,
												);
												setSuspendModalOpen(true);
											}}
										>
											Suspender
										</Button>
									</>
								)}
								<Link
									href={`/players/${player.id_player}`}
									className="px-3 py-1.5 text-sm bg-transparent border border-border text-main hover:bg-white/5 rounded-lg font-medium cursor-pointer transition-all duration-200"
								>
									Perfil
								</Link>
							</div>
						</div>
					</div>
					);
				})}
				</div>
			</div>
			)}

			<Modal
				isOpen={isFormOpen}
				onClose={closeForm}
				title={editingId ? 'Editar Jogador' : 'Novo Jogador'}
			>
				<form onSubmit={handleSave} className="flex flex-col gap-2">
					<FormField label="Nome *">
						<Input
							type="text"
							value={form.nome}
							onChange={(e) =>
								setForm({ ...form, nome: e.target.value })
							}
							required
							placeholder="Ex: Lucas Morais"
						/>
					</FormField>
					<FormField label="Apelido">
						<Input
							type="text"
							value={form.apelido}
							onChange={(e) =>
								setForm({ ...form, apelido: e.target.value })
							}
							placeholder="Ex: Lucão"
						/>
					</FormField>
					<FormField label="Email">
						<Input
							type="email"
							value={form.email}
							onChange={(e) =>
								setForm({ ...form, email: e.target.value })
							}
							placeholder="Ex: lucas@example.com"
						/>
					</FormField>
					<FormField label="Telefone">
						<Input
							type="tel"
							value={form.telefone}
							onChange={(e) =>
								setForm({ ...form, telefone: e.target.value })
							}
							placeholder="Ex: (11) 98765-4321"
						/>
					</FormField>
					<FormField label="Posição">
						<Select
							value={form.posicao}
							onChange={(e) =>
								setForm({
									...form,
									posicao: e.target.value as
										| Player['posicao']
										| '',
								})
							}
						>
							<option value="">Selecione uma posição...</option>
							<option value="goleiro">Goleiro</option>
							<option value="pivo">Pívô</option>
							<option value="ala">Ala</option>
							<option value="fixo">Fixo</option>
						</Select>
					</FormField>
					<FormField label="Pé Predominante">
						<Select
							value={form.pe}
							onChange={(e) =>
								setForm({
									...form,
									pe: e.target.value as Player['pe'] | '',
								})
							}
						>
							<option value="">Selecione um pé...</option>
							<option value="D">Direito</option>
							<option value="E">Esquerdo</option>
							<option value="A">Ambidestro</option>
						</Select>
					</FormField>
					<FormField label="Potes (1-5)">
						<Select
							value={form.potes}
							onChange={(e) =>
								setForm({
									...form,
									potes: e.target.value
										? parseInt(e.target.value)
										: '',
								})
							}
						>
							<option value="">Selecione um pote...</option>
							{[1, 2, 3, 4, 5].map((n) => (
								<option key={n} value={n}>
									{n}
								</option>
							))}
						</Select>
					</FormField>
					<label className="flex items-center gap-2 text-sm text-muted cursor-pointer">
						<input
							type="checkbox"
							checked={form.is_guest}
							onChange={(e) =>
								setForm({ ...form, is_guest: e.target.checked })
							}
						/>
						É convidado? (Se não, será mensalista)
					</label>
					<div className="flex gap-3 mt-2">
						<Button type="submit" disabled={saveMutation.isPending}>
							{saveMutation.isPending ? 'Salvando...' : 'Salvar'}
						</Button>
						<Button
							type="button"
							variant="ghost"
							onClick={closeForm}
						>
							Cancelar
						</Button>
					</div>
				</form>
			</Modal>

			<SuspendModal
				isOpen={suspendModalOpen}
				onClose={() => {
					setSuspendModalOpen(false);
					setPlayerToSuspend(null);
				}}
				onConfirm={(type, value) => {
					if (playerToSuspend)
						suspendMutation.mutate({
							id: playerToSuspend,
							type,
							value,
						});
				}}
			/>
		</div>
	);
}
