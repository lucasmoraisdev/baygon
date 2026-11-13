'use client';

import { Loading } from '@/components/Loading';
import { Modal } from '@/components/Modal';
import SuspendModal from '@/components/SuspendModal';
import { useAuth } from '@/context/AuthContext';
import { fetchAPI } from '@/lib/api';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Ban, Pencil, Search, Trash2 } from 'lucide-react';
import Link from 'next/link';
import { useEffect, useMemo, useRef, useState } from 'react';

interface Player {
	id_player: number;
	nome: string;
	apelido?: string;
	email?: string;
	telefone?: string;
	posicao?: 'goleiro' | 'defensores' | 'meias' | 'atacantes';
	pe?: 'D' | 'E' | 'A';
	potes?: number;
	is_associate: boolean;
	is_guest: boolean;
	status?: 'Ativo' | 'Suspenso' | 'Bloqueado' | string;
}

const EMPTY_FORM = {
	nome: '',
	apelido: '',
	email: '',
	telefone: '',
	posicao: '' as Player['posicao'] | '',
	pe: 'D' as Player['pe'] | '',
	potes: 3 as number | '',
	is_guest: false,
};

const POSICAO_LABEL: Record<string, string> = {
	goleiro: 'Goleiro',
	defensores: 'Defensores',
	meias: 'Meias',
	atacantes: 'Atacantes',
};

export default function PlayersPage() {
	const { user } = useAuth();
	const isAdmin = Boolean(user?.is_admin || user?.role === 'admin');
	const queryClient = useQueryClient();

	const [form, setForm] = useState(EMPTY_FORM);
	const [editingId, setEditingId] = useState<number | null>(null);
	const [isFormOpen, setIsFormOpen] = useState(false);
	const [suspendModalOpen, setSuspendModalOpen] = useState(false);
	const [playerToSuspend, setPlayerToSuspend] = useState<number | null>(null);

	const [search, setSearch] = useState('');
	const [potFilter, setPotFilter] = useState<string>('all');
	const [typeFilter, setTypeFilter] = useState<string>('all');

	const [openMenuId, setOpenMenuId] = useState<number | null>(null);
	const menuContainerRef = useRef<HTMLDivElement>(null);

	useEffect(() => {
		const handleClickOutside = (e: MouseEvent) => {
			if (
				menuContainerRef.current &&
				!menuContainerRef.current.contains(e.target as Node)
			) {
				setOpenMenuId(null);
			}
		};
		if (openMenuId !== null) {
			document.addEventListener('mousedown', handleClickOutside);
		}
		return () =>
			document.removeEventListener('mousedown', handleClickOutside);
	}, [openMenuId]);

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

	const deleteMutation = useMutation({
		mutationFn: (id: number) =>
			fetchAPI(`/players/${id}`, { method: 'DELETE' }),
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ['players'] });
		},
		onError: (err: any) => {
			alert(
				`Erro ao excluir jogador: ${err.message ?? 'Falha ao excluir'}`,
			);
		},
	});

	const handleDelete = (player: Player) => {
		setOpenMenuId(null);
		if (
			window.confirm(
				`Tem certeza que deseja excluir o jogador "${player.apelido || player.nome}"?`,
			)
		) {
			deleteMutation.mutate(player.id_player);
		}
	};

	const filteredPlayers = useMemo(() => {
		const q = search.toLowerCase().trim();
		return players.filter((p) => {
			if (
				q &&
				!p.nome.toLowerCase().includes(q) &&
				!(p.apelido ?? '').toLowerCase().includes(q) &&
				!(p.email ?? '').toLowerCase().includes(q)
			) {
				return false;
			}
			if (potFilter !== 'all') {
				if (String(p.potes ?? '') !== potFilter) return false;
			}
			if (typeFilter === 'guest' && !p.is_guest) return false;
			if (typeFilter === 'associate' && p.is_guest) return false;
			return true;
		});
	}, [players, search, potFilter, typeFilter]);

	const handleEdit = (player: Player) => {
		setOpenMenuId(null);
		setEditingId(player.id_player);
		setForm({
			nome: player.nome,
			apelido: player.apelido ?? '',
			email: player.email ?? '',
			telefone: player.telefone ?? '',
			posicao: player.posicao ?? '',
			pe: player.pe ?? 'D',
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
			potes: form.potes ? parseInt(String(form.potes), 10) : null,
			is_associate: !form.is_guest,
			is_guest: form.is_guest,
		});
	};

	const closeForm = () => {
		setIsFormOpen(false);
		setEditingId(null);
		setForm(EMPTY_FORM);
	};

	if (isLoading) return <Loading />;
	if (isError)
		return (
			<div className="text-red-500 p-4">Erro ao carregar jogadores.</div>
		);

	return (
		<div
			ref={menuContainerRef}
			className="flex flex-col animate-slide-down text-[#e6edf7]"
		>
			{/* Header Principal */}
			<div className="flex items-center justify-between gap-4 flex-wrap">
				<div className="flex items-baseline gap-3">
					<h1 className="m-0 text-[28px] font-bold tracking-[-0.01em] text-[#e6edf7]">
						Jogadores
					</h1>
					<span className="text-[13px] text-[#94a3b8]">
						{filteredPlayers.length}{' '}
						{filteredPlayers.length === 1 ? 'jogador' : 'jogadores'}
						{filteredPlayers.length !== players.length
							? ` (de ${players.length})`
							: ''}
					</span>
				</div>

				{isAdmin && (
					<button
						type="button"
						onClick={() => {
							setEditingId(null);
							setForm(EMPTY_FORM);
							setIsFormOpen(true);
						}}
						className="min-h-[44px] px-5 rounded-[10px] border-0 bg-[#2563eb] hover:bg-blue-500 text-white font-semibold text-sm cursor-pointer transition-colors"
					>
						+ Novo jogador
					</button>
				)}
			</div>

			{/* Barra de Busca e Filtros Segmentados */}
			<div className="flex flex-wrap gap-3 my-6 mb-4 items-center">
				{/* Input de Busca */}
				<div className="flex-1 min-w-[240px] flex items-center gap-2.5 min-h-[44px] px-3.5 rounded-[10px] border border-white/10 bg-[#111a2e] text-[#94a3b8] focus-within:border-primary transition-colors">
					<Search className="w-4 h-4 shrink-0 text-[#94a3b8]" />
					<input
						type="text"
						placeholder="Buscar por nome ou apelido…"
						value={search}
						onChange={(e) => setSearch(e.target.value)}
						className="w-full bg-transparent border-0 text-sm text-[#e6edf7] placeholder:text-[#94a3b8] focus:outline-none"
					/>
				</div>

				{/* Segmented Control: Tipo */}
				<div className="inline-flex bg-[#111a2e] border border-white/[0.07] rounded-[10px] p-[3px]">
					{[
						{ key: 'all', label: 'Todos' },
						{ key: 'associate', label: 'Mensalistas' },
						{ key: 'guest', label: 'Convidados' },
					].map((opt) => {
						const isOn = typeFilter === opt.key;
						return (
							<button
								key={opt.key}
								type="button"
								onClick={() => setTypeFilter(opt.key)}
								className={`px-3.5 py-[7px] rounded-[7px] text-sm font-medium transition-colors cursor-pointer ${isOn
										? 'bg-blue-500/20 text-[#bfdbfe]'
										: 'text-[#94a3b8] hover:text-slate-200'
									}`}
							>
								{opt.label}
							</button>
						);
					})}
				</div>

				{/* Segmented Control: Potes */}
				<div className="inline-flex bg-[#111a2e] border border-white/[0.07] rounded-[10px] p-[3px]">
					<button
						type="button"
						onClick={() => setPotFilter('all')}
						className={`px-3.5 py-[7px] rounded-[7px] text-sm font-medium transition-colors cursor-pointer ${potFilter === 'all'
								? 'bg-blue-500/20 text-[#bfdbfe]'
								: 'text-[#94a3b8] hover:text-slate-200'
							}`}
					>
						Potes
					</button>
					{[1, 2, 3, 4, 5].map((p) => {
						const val = String(p);
						const isOn = potFilter === val;
						return (
							<button
								key={p}
								type="button"
								onClick={() =>
									setPotFilter(isOn ? 'all' : val)
								}
								className={`px-3.5 py-[7px] rounded-[7px] text-sm font-medium transition-colors cursor-pointer ${isOn
										? 'bg-blue-500/20 text-[#bfdbfe]'
										: 'text-[#94a3b8] hover:text-slate-200'
									}`}
							>
								{p}
							</button>
						);
					})}
				</div>
			</div>

			{/* Tabela / Lista de Jogadores */}
			<section className="bg-[#111a2e] border border-white/[0.07] rounded-[16px]">
				{/* Cabeçalho das Colunas */}
				<div className="hidden md:grid md:grid-cols-[2fr_2fr_1.6fr_1fr_130px] gap-4 items-center px-5 py-3 text-xs font-semibold text-[#94a3b8] tracking-[0.04em] uppercase">
					<span>JOGADOR</span>
					<span>CONTATO</span>
					<span>PERFIL</span>
					<span>STATUS</span>
					<span></span>
				</div>

				{filteredPlayers.length === 0 ? (
					<div className="px-5 py-10 border-t border-white/[0.06] text-center text-sm text-[#94a3b8]">
						Nenhum jogador encontrado com os filtros selecionados.
					</div>
				) : (
					filteredPlayers.map((player) => {
						const statusText = player.status || 'Ativo';
						const isInactive =
							statusText === 'Suspenso' ||
							statusText === 'Bloqueado';

						// Cor do avatar seguindo a estética do wireframe
						const avatarStyle = isInactive
							? 'bg-[#7c2d12] text-[#fed7aa]'
							: player.is_guest
								? 'bg-[#14532d] text-[#bbf7d0]'
								: 'bg-[#1e3a8a] text-[#bfdbfe]';

						const displayTitle = player.apelido || player.nome;
						const displaySub = player.apelido
							? player.nome
							: 'Mensalista / Atleta';
						const initialChar = displayTitle
							.charAt(0)
							.toUpperCase();

						return (
							<div
								key={player.id_player}
								className={`grid grid-cols-1 md:grid-cols-[2fr_2fr_1.6fr_1fr_130px] gap-4 items-center px-5 py-3.5 border-t border-white/[0.06] hover:bg-white/[0.025] transition-colors ${isInactive ? 'opacity-65 hover:opacity-95' : ''
									}`}
							>
								{/* Coluna 1: Jogador */}
								<div className="flex gap-3 items-center min-w-0">
									<div
										className={`w-10 h-10 rounded-full flex items-center justify-center font-bold shrink-0 ${avatarStyle}`}
									>
										{initialChar}
									</div>
									<div className="min-w-0">
										<div className="font-semibold text-[#e6edf7] truncate">
											{displayTitle}
										</div>
										<div className="text-[13px] text-[#94a3b8] truncate">
											{displaySub}
										</div>
									</div>
								</div>

								{/* Coluna 2: Contato */}
								<div className="min-w-0">
									<div className="text-[#e6edf7] text-sm truncate">
										{player.email || '—'}
									</div>
									<div className="text-[13px] text-[#94a3b8] truncate">
										{player.telefone || '—'}
									</div>
								</div>

								{/* Coluna 3: Perfil (Chips) */}
								<div className="flex gap-1.5 flex-wrap">
									<span className="text-xs font-medium px-[9px] py-[3px] rounded-full bg-white/[0.06] text-[#cbd5e1] whitespace-nowrap">
										{player.is_guest
											? 'Convidado'
											: 'Mensalista'}
									</span>
									{player.pe && (
										<span className="text-xs font-medium px-[9px] py-[3px] rounded-full bg-white/[0.06] text-[#cbd5e1] whitespace-nowrap">
											{player.pe}
										</span>
									)}
									{player.potes && (
										<span className="text-xs font-medium px-[9px] py-[3px] rounded-full bg-white/[0.06] text-[#cbd5e1] whitespace-nowrap">
											Pote {player.potes}
										</span>
									)}
									{player.posicao && (
										<span className="text-xs font-medium px-[9px] py-[3px] rounded-full bg-white/[0.06] text-[#cbd5e1] whitespace-nowrap">
											{POSICAO_LABEL[player.posicao] ??
												player.posicao}
										</span>
									)}
								</div>

								{/* Coluna 4: Status */}
								<div>
									<span
										className={`inline-flex items-center gap-1.5 font-medium text-sm ${isInactive
												? 'text-[#f87171]'
												: 'text-[#4ade80]'
											}`}
									>
										<span className="w-[7px] h-[7px] rounded-full bg-current" />
										{statusText}
									</span>
								</div>

								{/* Coluna 5: Ações */}
								<div className="flex gap-2 justify-end items-center relative">
									<Link
										href={`/players/${player.id_player}`}
										className="min-h-[36px] px-3.5 rounded-lg border border-white/[0.14] bg-transparent hover:bg-white/5 text-[#e6edf7] font-medium text-[13px] inline-flex items-center justify-center transition-colors"
									>
										Perfil
									</Link>

									{isAdmin && (
										<div className="relative">
											<button
												type="button"
												onClick={() =>
													setOpenMenuId(
														openMenuId ===
															player.id_player
															? null
															: player.id_player,
													)
												}
												aria-label="Mais ações"
												title="Mais ações"
												className="min-h-[36px] w-9 p-0 rounded-lg border border-white/[0.14] bg-transparent hover:bg-white/5 text-[#e6edf7] text-lg leading-none flex items-center justify-center cursor-pointer transition-colors"
											>
												⋯
											</button>

											{openMenuId ===
												player.id_player && (
													<div className="absolute right-0 top-full mt-1.5 w-40 bg-[#0b1220] border border-white/15 rounded-xl p-1.5 shadow-[0_14px_34px_rgba(0,0,0,0.65)] z-50 animate-slide-down">
														<button
															type="button"
															onClick={() =>
																handleEdit(player)
															}
															className="w-full px-3 py-2 rounded-lg text-xs font-medium text-[#e6edf7] hover:bg-white/5 flex items-center gap-2.5 transition-colors cursor-pointer text-left"
														>
															<Pencil className="w-3.5 h-3.5 text-blue-400 shrink-0" />
															<span>Editar</span>
														</button>

														<button
															type="button"
															onClick={() => {
																setOpenMenuId(null);
																setPlayerToSuspend(
																	player.id_player,
																);
																setSuspendModalOpen(
																	true,
																);
															}}
															className="w-full px-3 py-2 rounded-lg text-xs font-medium text-amber-400 hover:bg-amber-500/10 flex items-center gap-2.5 transition-colors cursor-pointer text-left"
														>
															<Ban className="w-3.5 h-3.5 shrink-0" />
															<span>Suspender</span>
														</button>

														<div className="my-1 border-t border-white/[0.07]" />

														<button
															type="button"
															onClick={() =>
																handleDelete(player)
															}
															disabled={
																deleteMutation.isPending
															}
															className="w-full px-3 py-2 rounded-lg text-xs font-medium text-[#f87171] hover:bg-red-500/10 flex items-center gap-2.5 transition-colors cursor-pointer text-left disabled:opacity-50"
														>
															<Trash2 className="w-3.5 h-3.5 shrink-0" />
															<span>Excluir</span>
														</button>
													</div>
												)}
										</div>
									)}
								</div>
							</div>
						);
					})
				)}
			</section>

			{isAdmin && (
				<div className="text-[13px] text-[#94a3b8] mt-3">
					Editar, suspender e excluir ficam no menu ⋯ de cada linha.
				</div>
			)}

			{/* Modal de Criação / Edição de Jogador (seguindo Modal.dc.html) */}
			<Modal
				isOpen={isFormOpen}
				onClose={closeForm}
				title={editingId ? 'Editar jogador' : 'Novo jogador'}
				maxWidth="max-w-[600px]"
			>
				<form
					onSubmit={handleSave}
					className="flex flex-col gap-[22px]"
				>
					{/* Seção 1: DADOS PESSOAIS */}
					<div className="flex flex-col gap-3.5">
						<h3 className="m-0 text-xs tracking-[0.08em] text-[#64748b] font-semibold uppercase">
							DADOS PESSOAIS
						</h3>

						<div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
							<div>
								<label className="block text-[13px] text-[#94a3b8] mb-1.5">
									Nome *
								</label>
								<input
									type="text"
									required
									placeholder="Ex: Lucas Morais"
									value={form.nome}
									onChange={(e) =>
										setForm({
											...form,
											nome: e.target.value,
										})
									}
									className="box-border min-h-[44px] px-3.5 rounded-[10px] border border-white/[0.12] bg-[#0b1220] text-[#e6edf7] placeholder:text-[#64748b] text-sm w-full focus:outline-none focus:border-primary transition-colors"
								/>
							</div>

							<div>
								<label className="block text-[13px] text-[#94a3b8] mb-1.5">
									Apelido
								</label>
								<input
									type="text"
									placeholder="Ex: Lucão"
									value={form.apelido}
									onChange={(e) =>
										setForm({
											...form,
											apelido: e.target.value,
										})
									}
									className="box-border min-h-[44px] px-3.5 rounded-[10px] border border-white/[0.12] bg-[#0b1220] text-[#e6edf7] placeholder:text-[#64748b] text-sm w-full focus:outline-none focus:border-primary transition-colors"
								/>
							</div>

							<div>
								<label className="block text-[13px] text-[#94a3b8] mb-1.5">
									Email
								</label>
								<input
									type="email"
									placeholder="Ex: lucas@example.com"
									value={form.email}
									onChange={(e) =>
										setForm({
											...form,
											email: e.target.value,
										})
									}
									className="box-border min-h-[44px] px-3.5 rounded-[10px] border border-white/[0.12] bg-[#0b1220] text-[#e6edf7] placeholder:text-[#64748b] text-sm w-full focus:outline-none focus:border-primary transition-colors"
								/>
							</div>

							<div>
								<label className="block text-[13px] text-[#94a3b8] mb-1.5">
									Telefone
								</label>
								<input
									type="tel"
									placeholder="Ex: (11) 98765-4321"
									value={form.telefone}
									onChange={(e) =>
										setForm({
											...form,
											telefone: e.target.value,
										})
									}
									className="box-border min-h-[44px] px-3.5 rounded-[10px] border border-white/[0.12] bg-[#0b1220] text-[#e6edf7] placeholder:text-[#64748b] text-sm w-full focus:outline-none focus:border-primary transition-colors"
								/>
							</div>
						</div>
					</div>

					{/* Seção 2: PERFIL DE JOGO */}
					<div className="flex flex-col gap-3.5">
						<h3 className="m-0 text-xs tracking-[0.08em] text-[#64748b] font-semibold uppercase">
							PERFIL DE JOGO
						</h3>

						<div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
							<div>
								<label className="block text-[13px] text-[#94a3b8] mb-1.5">
									Posição
								</label>
								<select
									value={form.posicao}
									onChange={(e) =>
										setForm({
											...form,
											posicao: e.target.value as
												| Player['posicao']
												| '',
										})
									}
									className="box-border min-h-[44px] px-3.5 rounded-[10px] border border-white/[0.12] bg-[#0b1220] text-[#e6edf7] text-sm w-full focus:outline-none focus:border-primary transition-colors cursor-pointer"
								>
									<option
										value=""
										className="bg-[#0b1220] text-[#64748b]"
									>
										Selecione…
									</option>
									<option
										value="goleiro"
										className="bg-[#0b1220] text-[#e6edf7]"
									>
										Goleiro
									</option>
									<option
										value="defensores"
										className="bg-[#0b1220] text-[#e6edf7]"
									>
										Defensores
									</option>
									<option
										value="meias"
										className="bg-[#0b1220] text-[#e6edf7]"
									>
										Meias
									</option>
									<option
										value="atacantes"
										className="bg-[#0b1220] text-[#e6edf7]"
									>
										Atacantes
									</option>
								</select>
							</div>

							<div>
								<label className="block text-[13px] text-[#94a3b8] mb-1.5">
									Pé predominante
								</label>
								<div className="flex bg-[#0b1220] border border-white/[0.12] rounded-[10px] p-[3px]">
									{[
										{ key: 'D', label: 'Direito' },
										{ key: 'E', label: 'Esquerdo' },
										{ key: 'A', label: 'Ambos' },
									].map((opt) => {
										const isOn = form.pe === opt.key;
										return (
											<button
												key={opt.key}
												type="button"
												onClick={() =>
													setForm({
														...form,
														pe: opt.key as Player['pe'],
													})
												}
												className={`flex-1 text-center py-[9px] rounded-[7px] text-sm font-medium transition-colors cursor-pointer ${isOn
														? 'bg-blue-500/20 text-[#bfdbfe]'
														: 'text-[#94a3b8] hover:text-slate-200'
													}`}
											>
												{opt.label}
											</button>
										);
									})}
								</div>
							</div>
						</div>

						{/* Pote (Segmented Control 1 a 5) */}
						<div>
							<label className="block text-[13px] text-[#94a3b8] mb-1.5">
								Pote
							</label>
							<div className="flex bg-[#0b1220] border border-white/[0.12] rounded-[10px] p-[3px]">
								{[1, 2, 3, 4, 5].map((n) => {
									const isOn = Number(form.potes) === n;
									return (
										<button
											key={n}
											type="button"
											onClick={() =>
												setForm({
													...form,
													potes: isOn ? '' : n,
												})
											}
											className={`flex-1 text-center py-[9px] rounded-[7px] text-sm font-medium transition-colors cursor-pointer ${isOn
													? 'bg-blue-500/20 text-[#bfdbfe]'
													: 'text-[#94a3b8] hover:text-slate-200'
												}`}
										>
											{n}
										</button>
									);
								})}
							</div>
						</div>

						{/* Tipo (Segmented Control Mensalista / Convidado) */}
						<div>
							<label className="block text-[13px] text-[#94a3b8] mb-1.5">
								Tipo
							</label>
							<div className="flex bg-[#0b1220] border border-white/[0.12] rounded-[10px] p-[3px]">
								<button
									type="button"
									onClick={() =>
										setForm({ ...form, is_guest: false })
									}
									className={`flex-1 text-center py-[9px] rounded-[7px] text-sm font-medium transition-colors cursor-pointer ${!form.is_guest
											? 'bg-blue-500/20 text-[#bfdbfe]'
											: 'text-[#94a3b8] hover:text-slate-200'
										}`}
								>
									Mensalista
								</button>
								<button
									type="button"
									onClick={() =>
										setForm({ ...form, is_guest: true })
									}
									className={`flex-1 text-center py-[9px] rounded-[7px] text-sm font-medium transition-colors cursor-pointer ${form.is_guest
											? 'bg-blue-500/20 text-[#bfdbfe]'
											: 'text-[#94a3b8] hover:text-slate-200'
										}`}
								>
									Convidado
								</button>
							</div>
						</div>
					</div>

					{/* Rodapé do Modal */}
					<div className="flex gap-3 justify-end pt-5 border-t border-white/[0.06]">
						<button
							type="button"
							onClick={closeForm}
							className="min-h-[44px] px-5 rounded-[10px] border border-white/[0.14] bg-transparent hover:bg-white/5 text-[#e6edf7] font-medium text-sm cursor-pointer transition-colors"
						>
							Cancelar
						</button>
						<button
							type="submit"
							disabled={saveMutation.isPending}
							className="min-h-[44px] px-6 rounded-[10px] border-0 bg-[#2563eb] hover:bg-blue-500 text-white font-semibold text-sm cursor-pointer transition-colors disabled:opacity-50"
						>
							{saveMutation.isPending
								? 'Salvando...'
								: 'Salvar jogador'}
						</button>
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
