'use client';

import { Button } from '@/components/Button';
import { FormField } from '@/components/FormField';
import { Input } from '@/components/Input';
import { Loading } from '@/components/Loading';
import { Modal } from '@/components/Modal';
import { Select } from '@/components/Select';
import { useAuth } from '@/context/AuthContext';
import { fetchAPI } from '@/lib/api';
import {
	useMutation,
	useQueries,
	useQueryClient,
} from '@tanstack/react-query';
import {
	Check,
	Copy,
	Link2,
	Mail,
	ShieldAlert,
	Trash2,
	Unlink,
	UserPlus,
} from 'lucide-react';
import Link from 'next/link';
import { useMemo, useState } from 'react';

interface LinkedPlayer {
	id_player: number;
	nome: string;
	apelido?: string | null;
	user_id?: number | null;
}

interface UserItem {
	id_user: number;
	name: string;
	email: string;
	username: string;
	phone_number: string;
	is_admin: boolean;
	is_active: boolean;
	setup_token?: string | null;
	role: string;
	players?: LinkedPlayer[];
}

interface InviteResult {
	id_user: number;
	username: string;
	email: string;
	invite_link: string;
	temporary_password?: string | null;
}

export default function AdminUsersPage() {
	const { user, loading: authLoading } = useAuth();
	const isAdmin = Boolean(user?.is_admin || user?.role === 'admin');
	const queryClient = useQueryClient();

	const [search, setSearch] = useState('');
	const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'pending' | 'admin'>('all');

	const [isInviteOpen, setIsInviteOpen] = useState(false);
	const [inviteForm, setInviteForm] = useState({
		name: '',
		email: '',
		username: '',
		phone_number: '',
		is_admin: false,
		player_id: '',
	});

	const [editingUser, setEditingUser] = useState<UserItem | null>(null);
	const [editForm, setEditForm] = useState({
		name: '',
		email: '',
		username: '',
		phone_number: '',
		is_admin: false,
		is_active: true,
	});

	const [linkingUser, setLinkingUser] = useState<UserItem | null>(null);
	const [selectedPlayerId, setSelectedPlayerId] = useState('');

	const [inviteInfo, setInviteInfo] = useState<InviteResult | null>(null);
	const [copiedField, setCopiedField] = useState<string | null>(null);

	const [usersQuery, playersQuery] = useQueries({
		queries: [
			{
				queryKey: ['users'],
				queryFn: () => fetchAPI('/users/'),
				enabled: isAdmin,
			},
			{
				queryKey: ['players'],
				queryFn: () => fetchAPI('/players/').catch(() => []),
				enabled: isAdmin,
			},
		],
	});

	const users: UserItem[] = usersQuery.data ?? [];
	const players: LinkedPlayer[] = playersQuery.data ?? [];

	const unlinkedPlayers = useMemo(
		() => players.filter((p) => !p.user_id),
		[players],
	);

	const filteredUsers = useMemo(() => {
		const q = search.toLowerCase().trim();
		return users.filter((u) => {
			if (statusFilter === 'active' && !u.is_active) return false;
			if (statusFilter === 'pending' && u.is_active) return false;
			if (statusFilter === 'admin' && !u.is_admin) return false;
			if (!q) return true;
			return (
				u.name.toLowerCase().includes(q) ||
				u.username.toLowerCase().includes(q) ||
				u.email.toLowerCase().includes(q)
			);
		});
	}, [users, search, statusFilter]);

	const invalidateUsersAndPlayers = () => {
		queryClient.invalidateQueries({ queryKey: ['users'] });
		queryClient.invalidateQueries({ queryKey: ['players'] });
	};

	const normalizeInviteLink = (rawLink: string) => {
		if (typeof window === 'undefined') return rawLink;
		try {
			const url = new URL(rawLink);
			const token = url.searchParams.get('setup_token');
			if (token) {
				return `${window.location.origin}/complete-registration?setup_token=${encodeURIComponent(token)}`;
			}
		} catch {
			// fallback
		}
		return rawLink;
	};

	const copyText = async (key: string, text: string) => {
		await navigator.clipboard.writeText(text);
		setCopiedField(key);
		setTimeout(() => setCopiedField(null), 2000);
	};

	const inviteMutation = useMutation({
		mutationFn: async () => {
			const created: InviteResult = await fetchAPI('/users/', {
				method: 'POST',
				body: JSON.stringify({
					name: inviteForm.name.trim(),
					email: inviteForm.email.trim(),
					username: inviteForm.username.trim(),
					phone_number: inviteForm.phone_number.trim(),
					is_admin: inviteForm.is_admin,
				}),
			});
			if (inviteForm.player_id) {
				await fetchAPI(
					`/users/${created.id_user}/link-player/${inviteForm.player_id}`,
					{ method: 'POST' },
				);
			}
			return created;
		},
		onSuccess: (created) => {
			invalidateUsersAndPlayers();
			setIsInviteOpen(false);
			setInviteForm({
				name: '',
				email: '',
				username: '',
				phone_number: '',
				is_admin: false,
				player_id: '',
			});
			setInviteInfo({
				...created,
				invite_link: normalizeInviteLink(created.invite_link),
			});
		},
		onError: (err: Error) =>
			alert(`Erro ao convidar usuário: ${err.message}`),
	});

	const resendMutation = useMutation({
		mutationFn: (userId: number) =>
			fetchAPI(`/users/${userId}/resend-invite`, { method: 'POST' }),
		onSuccess: (res: InviteResult) => {
			invalidateUsersAndPlayers();
			setInviteInfo({
				...res,
				invite_link: normalizeInviteLink(res.invite_link),
			});
		},
		onError: (err: Error) =>
			alert(`Erro ao reenviar convite: ${err.message}`),
	});

	const updateMutation = useMutation({
		mutationFn: () => {
			if (!editingUser) throw new Error('Nenhum usuário selecionado.');
			return fetchAPI(`/users/${editingUser.id_user}`, {
				method: 'PUT',
				body: JSON.stringify(editForm),
			});
		},
		onSuccess: () => {
			invalidateUsersAndPlayers();
			setEditingUser(null);
		},
		onError: (err: Error) =>
			alert(`Erro ao atualizar usuário: ${err.message}`),
	});

	const deleteMutation = useMutation({
		mutationFn: (userId: number) =>
			fetchAPI(`/users/${userId}`, { method: 'DELETE' }),
		onSuccess: invalidateUsersAndPlayers,
		onError: (err: Error) =>
			alert(`Erro ao remover usuário: ${err.message}`),
	});

	const linkPlayerMutation = useMutation({
		mutationFn: () => {
			if (!linkingUser || !selectedPlayerId)
				throw new Error('Selecione um jogador.');
			return fetchAPI(
				`/users/${linkingUser.id_user}/link-player/${selectedPlayerId}`,
				{ method: 'POST' },
			);
		},
		onSuccess: () => {
			invalidateUsersAndPlayers();
			setLinkingUser(null);
			setSelectedPlayerId('');
		},
		onError: (err: Error) =>
			alert(`Erro ao vincular jogador: ${err.message}`),
	});

	const unlinkPlayerMutation = useMutation({
		mutationFn: ({
			userId,
			playerId,
		}: {
			userId: number;
			playerId: number;
		}) =>
			fetchAPI(`/users/${userId}/unlink-player/${playerId}`, {
				method: 'DELETE',
			}),
		onSuccess: invalidateUsersAndPlayers,
		onError: (err: Error) =>
			alert(`Erro ao desvincular jogador: ${err.message}`),
	});

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

	if (usersQuery.isLoading || playersQuery.isLoading) return <Loading />;

	return (
		<div className="flex flex-col gap-6 animate-slide-down pb-12">
			<div className="flex items-center justify-between flex-wrap gap-4">
				<div>
					<h1 className="text-3xl text-main">
						Gestão de Usuários (Admin)
					</h1>
					<p className="text-sm text-muted mt-1">
						Convide novos usuários, gerencie permissões e vincule
						contas aos jogadores do baba.
					</p>
				</div>

				<Button
					onClick={() => setIsInviteOpen(true)}
					className="w-auto flex items-center gap-2"
				>
					<UserPlus className="w-4 h-4" />
					Convidar Usuário
				</Button>
			</div>

			{/* Filtros */}
			<div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
				<Input
					value={search}
					onChange={(e) => setSearch(e.target.value)}
					placeholder="Buscar por nome, username ou e-mail..."
				/>
				<Select
					value={statusFilter}
					onChange={(e) =>
						setStatusFilter(e.target.value as typeof statusFilter)
					}
				>
					<option value="all">Todos ({users.length})</option>
					<option value="active">
						Ativos ({users.filter((u) => u.is_active).length})
					</option>
					<option value="pending">
						Pendentes ({users.filter((u) => !u.is_active).length})
					</option>
					<option value="admin">
						Administradores ({users.filter((u) => u.is_admin).length})
					</option>
				</Select>
			</div>

			{/* Lista de Usuários */}
			{filteredUsers.length === 0 ? (
				<div className="bg-surface border border-border rounded-xl p-8 text-center text-sm text-muted">
					Nenhum usuário encontrado.
				</div>
			) : (
				<div className="flex flex-col gap-3">
					{filteredUsers.map((u) => (
						<div
							key={u.id_user}
							className="bg-surface border border-border rounded-xl p-4 flex flex-col md:flex-row md:items-center justify-between gap-4"
						>
							<div className="flex flex-col gap-1">
								<div className="flex items-center gap-2 flex-wrap">
									<strong className="text-base text-main">
										{u.name}
									</strong>
									<span className="text-xs text-muted">
										@{u.username}
									</span>
									<span
										className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${
											u.is_admin
												? 'bg-primary/20 text-primary'
												: 'bg-white/10 text-muted'
										}`}
									>
										{u.is_admin ? 'Admin' : 'Usuário'}
									</span>
									<span
										className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${
											u.is_active
												? 'bg-green-500/15 text-green-400'
												: 'bg-yellow-500/15 text-yellow-300'
										}`}
									>
										{u.is_active
											? 'Ativo'
											: 'Aguardando Cadastro'}
									</span>
								</div>
								<p className="text-xs text-muted">
									{u.email} · {u.phone_number}
								</p>

								{/* Jogadores vinculados */}
								<div className="flex items-center gap-2 flex-wrap mt-1">
									<span className="text-xs text-muted">
										Jogador vinculado:
									</span>
									{u.players && u.players.length > 0 ? (
										u.players.map((pl) => (
											<span
												key={pl.id_player}
												className="inline-flex items-center gap-1.5 text-xs bg-primary/10 border border-primary/30 text-main px-2.5 py-0.5 rounded-full"
											>
												<Link
													href={`/players/${pl.id_player}`}
													className="hover:underline"
												>
													{pl.apelido || pl.nome}
												</Link>
												<button
													type="button"
													onClick={() =>
														unlinkPlayerMutation.mutate(
															{
																userId: u.id_user,
																playerId:
																	pl.id_player,
															},
														)
													}
													className="text-red-400 hover:text-red-300 cursor-pointer"
													title="Desvincular jogador"
												>
													<Unlink className="w-3 h-3" />
												</button>
											</span>
										))
									) : (
										<span className="text-xs text-muted italic">
											Nenhum
										</span>
									)}
									<button
										type="button"
										onClick={() => {
											setLinkingUser(u);
											setSelectedPlayerId('');
										}}
										className="text-xs text-primary hover:underline inline-flex items-center gap-1 cursor-pointer"
									>
										<Link2 className="w-3 h-3" />
										Vincular
									</button>
								</div>
							</div>

							<div className="flex items-center gap-2 shrink-0 flex-wrap">
								{!u.is_active && (
									<Button
										size="sm"
										variant="ghost"
										onClick={() =>
											resendMutation.mutate(u.id_user)
										}
										disabled={resendMutation.isPending}
										className="w-auto flex items-center gap-1"
									>
										<Mail className="w-3.5 h-3.5" />
										Reenviar Convite
									</Button>
								)}
								<Button
									size="sm"
									variant="ghost"
									onClick={() => {
										setEditingUser(u);
										setEditForm({
											name: u.name,
											email: u.email,
											username: u.username,
											phone_number: u.phone_number,
											is_admin: u.is_admin,
											is_active: u.is_active,
										});
									}}
									className="w-auto"
								>
									Editar
								</Button>
								{u.id_user !== user?.id_user && (
									<button
										type="button"
										onClick={() => {
											if (
												confirm(
													`Deseja remover o usuário "${u.username}"?`,
												)
											) {
												deleteMutation.mutate(
													u.id_user,
												);
											}
										}}
										className="p-2 text-red-400 hover:bg-red-500/10 rounded cursor-pointer"
										title="Excluir usuário"
									>
										<Trash2 className="w-4 h-4" />
									</button>
								)}
							</div>
						</div>
					))}
				</div>
			)}

			{/* Modal Convidar Usuário */}
			<Modal
				isOpen={isInviteOpen}
				onClose={() => setIsInviteOpen(false)}
				title="Convidar Novo Usuário"
			>
				<form
					onSubmit={(e) => {
						e.preventDefault();
						inviteMutation.mutate();
					}}
					className="flex flex-col gap-3"
				>
					<FormField label="Nome completo">
						<Input
							value={inviteForm.name}
							onChange={(e) =>
								setInviteForm({
									...inviteForm,
									name: e.target.value,
								})
							}
							required
						/>
					</FormField>
					<FormField label="E-mail">
						<Input
							type="email"
							value={inviteForm.email}
							onChange={(e) =>
								setInviteForm({
									...inviteForm,
									email: e.target.value,
								})
							}
							required
						/>
					</FormField>
					<div className="grid grid-cols-2 gap-3">
						<FormField label="Username">
							<Input
								value={inviteForm.username}
								onChange={(e) =>
									setInviteForm({
										...inviteForm,
										username: e.target.value,
									})
								}
								required
							/>
						</FormField>
						<FormField label="Telefone">
							<Input
								value={inviteForm.phone_number}
								onChange={(e) =>
									setInviteForm({
										...inviteForm,
										phone_number: e.target.value,
									})
								}
								required
							/>
						</FormField>
					</div>

					<FormField label="Vincular a Jogador (opcional)">
						<Select
							value={inviteForm.player_id}
							onChange={(e) =>
								setInviteForm({
									...inviteForm,
									player_id: e.target.value,
								})
							}
						>
							<option value="">Não vincular agora</option>
							{unlinkedPlayers.map((p) => (
								<option key={p.id_player} value={p.id_player}>
									{p.apelido || p.nome}
								</option>
							))}
						</Select>
					</FormField>

					<label className="flex items-center gap-2 text-sm text-main cursor-pointer">
						<input
							type="checkbox"
							checked={inviteForm.is_admin}
							onChange={(e) =>
								setInviteForm({
									...inviteForm,
									is_admin: e.target.checked,
								})
							}
						/>
						Conceder permissão de Administrador
					</label>

					<div className="flex gap-3 mt-2">
						<Button
							type="submit"
							disabled={inviteMutation.isPending}
						>
							{inviteMutation.isPending
								? 'Enviando convite...'
								: 'Criar e Gerar Convite'}
						</Button>
						<Button
							type="button"
							variant="ghost"
							onClick={() => setIsInviteOpen(false)}
						>
							Cancelar
						</Button>
					</div>
				</form>
			</Modal>

			{/* Modal Convite Gerado (Copiar Link + Senha Temporária) */}
			<Modal
				isOpen={Boolean(inviteInfo)}
				onClose={() => setInviteInfo(null)}
				title="Convite Gerado"
			>
				{inviteInfo && (
					<div className="flex flex-col gap-4 text-sm">
						<p className="text-muted">
							Compartilhe o link e a senha temporária abaixo com{' '}
							<strong className="text-main">
								{inviteInfo.username}
							</strong>{' '}
							({inviteInfo.email}):
						</p>

						<div className="flex flex-col gap-1">
							<span className="text-xs text-muted">
								Link de Conclusão de Cadastro
							</span>
							<div className="flex gap-2">
								<Input
									readOnly
									value={inviteInfo.invite_link}
								/>
								<Button
									type="button"
									variant="ghost"
									size="sm"
									className="w-auto shrink-0"
									onClick={() =>
										copyText('link', inviteInfo.invite_link)
									}
								>
									{copiedField === 'link' ? (
										<Check className="w-4 h-4 text-green-400" />
									) : (
										<Copy className="w-4 h-4" />
									)}
								</Button>
							</div>
						</div>

						{inviteInfo.temporary_password && (
							<div className="flex flex-col gap-1">
								<span className="text-xs text-muted">
									Senha Temporária
								</span>
								<div className="flex gap-2">
									<Input
										readOnly
										value={inviteInfo.temporary_password}
									/>
									<Button
										type="button"
										variant="ghost"
										size="sm"
										className="w-auto shrink-0"
										onClick={() =>
											copyText(
												'pass',
												inviteInfo.temporary_password!,
											)
										}
									>
										{copiedField === 'pass' ? (
											<Check className="w-4 h-4 text-green-400" />
										) : (
											<Copy className="w-4 h-4" />
										)}
									</Button>
								</div>
							</div>
						)}

						<Button
							type="button"
							onClick={() => setInviteInfo(null)}
						>
							Fechar
						</Button>
					</div>
				)}
			</Modal>

			{/* Modal Editar Usuário */}
			<Modal
				isOpen={Boolean(editingUser)}
				onClose={() => setEditingUser(null)}
				title="Editar Usuário"
			>
				<form
					onSubmit={(e) => {
						e.preventDefault();
						updateMutation.mutate();
					}}
					className="flex flex-col gap-3"
				>
					<FormField label="Nome">
						<Input
							value={editForm.name}
							onChange={(e) =>
								setEditForm({ ...editForm, name: e.target.value })
							}
							required
						/>
					</FormField>
					<FormField label="E-mail">
						<Input
							type="email"
							value={editForm.email}
							onChange={(e) =>
								setEditForm({
									...editForm,
									email: e.target.value,
								})
							}
							required
						/>
					</FormField>
					<div className="grid grid-cols-2 gap-3">
						<FormField label="Username">
							<Input
								value={editForm.username}
								onChange={(e) =>
									setEditForm({
										...editForm,
										username: e.target.value,
									})
								}
								required
							/>
						</FormField>
						<FormField label="Telefone">
							<Input
								value={editForm.phone_number}
								onChange={(e) =>
									setEditForm({
										...editForm,
										phone_number: e.target.value,
									})
								}
								required
							/>
						</FormField>
					</div>

					<label className="flex items-center gap-2 text-sm text-main cursor-pointer">
						<input
							type="checkbox"
							checked={editForm.is_admin}
							onChange={(e) =>
								setEditForm({
									...editForm,
									is_admin: e.target.checked,
								})
							}
						/>
						Administrador
					</label>
					<label className="flex items-center gap-2 text-sm text-main cursor-pointer">
						<input
							type="checkbox"
							checked={editForm.is_active}
							onChange={(e) =>
								setEditForm({
									...editForm,
									is_active: e.target.checked,
								})
							}
						/>
						Usuário Ativo
					</label>

					<div className="flex gap-3 mt-2">
						<Button
							type="submit"
							disabled={updateMutation.isPending}
						>
							{updateMutation.isPending
								? 'Salvando...'
								: 'Salvar'}
						</Button>
						<Button
							type="button"
							variant="ghost"
							onClick={() => setEditingUser(null)}
						>
							Cancelar
						</Button>
					</div>
				</form>
			</Modal>

			{/* Modal Vincular Jogador */}
			<Modal
				isOpen={Boolean(linkingUser)}
				onClose={() => setLinkingUser(null)}
				title={`Vincular Jogador a @${linkingUser?.username ?? ''}`}
			>
				<form
					onSubmit={(e) => {
						e.preventDefault();
						linkPlayerMutation.mutate();
					}}
					className="flex flex-col gap-3"
				>
					<FormField label="Jogador disponível">
						<Select
							value={selectedPlayerId}
							onChange={(e) =>
								setSelectedPlayerId(e.target.value)
							}
							required
						>
							<option value="">Selecione um jogador...</option>
							{unlinkedPlayers.map((p) => (
								<option key={p.id_player} value={p.id_player}>
									{p.apelido || p.nome}
								</option>
							))}
						</Select>
					</FormField>
					<div className="flex gap-3 mt-2">
						<Button
							type="submit"
							disabled={
								!selectedPlayerId ||
								linkPlayerMutation.isPending
							}
						>
							{linkPlayerMutation.isPending
								? 'Vinculando...'
								: 'Vincular'}
						</Button>
						<Button
							type="button"
							variant="ghost"
							onClick={() => setLinkingUser(null)}
						>
							Cancelar
						</Button>
					</div>
				</form>
			</Modal>
		</div>
	);
}
