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
	CheckCircle2,
	ChevronLeft,
	ChevronRight,
	Clock,
	Copy,
	ExternalLink,
	Link2,
	Mail,
	Pencil,
	Search,
	ShieldAlert,
	ShieldCheck,
	Trash2,
	Unlink,
	UserPlus,
	Users,
	X,
} from 'lucide-react';
import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';

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
	name?: string;
	username: string;
	email: string;
	invite_link?: string | null;
	temporary_password?: string | null;
	setup_token?: string | null;
}

export default function AdminUsersPage() {
	const { user, loading: authLoading } = useAuth();
	const isAdmin = Boolean(user?.is_admin || user?.role === 'admin');
	const queryClient = useQueryClient();

	const [search, setSearch] = useState('');
	const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'pending' | 'admin'>('all');
	const [playerFilter, setPlayerFilter] = useState<'all' | 'linked' | 'unlinked'>('all');
	const [currentPage, setCurrentPage] = useState<number>(1);
	const pageSize = 10;

	const [isInviteOpen, setIsInviteOpen] = useState(false);
	const [inviteForm, setInviteForm] = useState({
		name: '',
		email: '',
		username: '',
		phone_number: '',
		is_admin: false,
		skip_email: true,
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

	const sortedPlayersForLink = useMemo(() => {
		return [...players].sort((a, b) => {
			if (!a.user_id && b.user_id) return -1;
			if (a.user_id && !b.user_id) return 1;
			return (a.apelido || a.nome).localeCompare(b.apelido || b.nome);
		});
	}, [players]);

	useEffect(() => {
		setCurrentPage(1);
	}, [search, statusFilter, playerFilter]);

	const stats = useMemo(() => {
		const total = users.length;
		const active = users.filter((u) => u.is_active).length;
		const pending = users.filter((u) => !u.is_active).length;
		const admins = users.filter((u) => u.is_admin).length;
		return { total, active, pending, admins };
	}, [users]);

	const filteredUsers = useMemo(() => {
		const q = search.toLowerCase().trim();
		return users.filter((u) => {
			if (statusFilter === 'active' && !u.is_active) return false;
			if (statusFilter === 'pending' && u.is_active) return false;
			if (statusFilter === 'admin' && !u.is_admin) return false;
			if (playerFilter === 'linked' && (!u.players || u.players.length === 0)) return false;
			if (playerFilter === 'unlinked' && u.players && u.players.length > 0) return false;
			if (!q) return true;
			return (
				u.name.toLowerCase().includes(q) ||
				u.username.toLowerCase().includes(q) ||
				u.email.toLowerCase().includes(q) ||
				(u.phone_number && u.phone_number.includes(q))
			);
		});
	}, [users, search, statusFilter, playerFilter]);

	const totalPages = Math.ceil(filteredUsers.length / pageSize) || 1;
	const paginatedUsers = useMemo(() => {
		const start = (currentPage - 1) * pageSize;
		return filteredUsers.slice(start, start + pageSize);
	}, [filteredUsers, currentPage, pageSize]);

	const invalidateUsersAndPlayers = () => {
		queryClient.invalidateQueries({ queryKey: ['users'] });
		queryClient.invalidateQueries({ queryKey: ['players'] });
	};

	const normalizeInviteLink = (rawLink?: string | null, fallbackToken?: string | null) => {
		if (typeof window === 'undefined') return rawLink || '';
		const origin = window.location.origin;

		if (rawLink) {
			try {
				const url = new URL(rawLink, origin);
				const token = url.searchParams.get('setup_token') || fallbackToken;
				if (token) {
					return `${origin}/complete-registration?setup_token=${encodeURIComponent(token)}`;
				}
				if (url.pathname) {
					return `${origin}${url.pathname}${url.search}`;
				}
			} catch {
				// fallback
			}
		}

		if (fallbackToken) {
			return `${origin}/complete-registration?setup_token=${encodeURIComponent(fallbackToken)}`;
		}

		return rawLink || '';
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
					skip_email: inviteForm.skip_email,
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
				skip_email: true,
				player_id: '',
			});
			setInviteInfo({
				...created,
				invite_link: normalizeInviteLink(created.invite_link, created.setup_token),
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
				invite_link: normalizeInviteLink(res.invite_link, res.setup_token),
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
			{/* Header Principal */}
			<div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
				<div>
					<h1 className="text-2xl sm:text-3xl font-bold text-main tracking-tight">
						Gestão de Usuários
					</h1>
					<p className="text-xs sm:text-sm text-muted mt-0.5">
						Gerencie contas, permissões de acesso e vínculos com os jogadores da associação.
					</p>
				</div>

				<Button
					onClick={() => setIsInviteOpen(true)}
					className="!w-auto flex items-center gap-1.5 px-3.5 py-2 text-sm self-start sm:self-auto"
				>
					<UserPlus className="w-4 h-4" />
					<span>Convidar Usuário</span>
				</Button>
			</div>

			{/* Cards de Métricas e Filtros Rápidos */}
			<div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
				<button
					type="button"
					onClick={() => setStatusFilter('all')}
					className={`p-4 rounded-xl border text-left transition-all cursor-pointer ${
						statusFilter === 'all'
							? 'bg-primary/10 border-primary ring-1 ring-primary'
							: 'bg-surface border-border hover:border-border-hover'
					}`}
				>
					<div className="flex items-center justify-between mb-2">
						<span className="text-xs font-semibold text-muted uppercase tracking-wider">
							Total
						</span>
						<div className="w-8 h-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
							<Users className="w-4 h-4" />
						</div>
					</div>
					<div className="text-2xl font-bold text-main">
						{stats.total}
					</div>
					<span className="text-xs text-muted">Contas cadastradas</span>
				</button>

				<button
					type="button"
					onClick={() => setStatusFilter('active')}
					className={`p-4 rounded-xl border text-left transition-all cursor-pointer ${
						statusFilter === 'active'
							? 'bg-emerald-500/10 border-emerald-500 ring-1 ring-emerald-500'
							: 'bg-surface border-border hover:border-border-hover'
					}`}
				>
					<div className="flex items-center justify-between mb-2">
						<span className="text-xs font-semibold text-muted uppercase tracking-wider">
							Ativos
						</span>
						<div className="w-8 h-8 rounded-lg bg-emerald-500/10 text-emerald-500 flex items-center justify-center">
							<CheckCircle2 className="w-4 h-4" />
						</div>
					</div>
					<div className="text-2xl font-bold text-main">
						{stats.active}
					</div>
					<span className="text-xs text-muted">Cadastro concluído</span>
				</button>

				<button
					type="button"
					onClick={() => setStatusFilter('pending')}
					className={`p-4 rounded-xl border text-left transition-all cursor-pointer ${
						statusFilter === 'pending'
							? 'bg-amber-500/10 border-amber-500 ring-1 ring-amber-500'
							: 'bg-surface border-border hover:border-border-hover'
					}`}
				>
					<div className="flex items-center justify-between mb-2">
						<span className="text-xs font-semibold text-muted uppercase tracking-wider">
							Pendentes
						</span>
						<div className="w-8 h-8 rounded-lg bg-amber-500/10 text-amber-500 flex items-center justify-center">
							<Clock className="w-4 h-4" />
						</div>
					</div>
					<div className="text-2xl font-bold text-main">
						{stats.pending}
					</div>
					<span className="text-xs text-muted">Aguardando ativação</span>
				</button>

				<button
					type="button"
					onClick={() => setStatusFilter('admin')}
					className={`p-4 rounded-xl border text-left transition-all cursor-pointer ${
						statusFilter === 'admin'
							? 'bg-blue-500/10 border-blue-500 ring-1 ring-blue-500'
							: 'bg-surface border-border hover:border-border-hover'
					}`}
				>
					<div className="flex items-center justify-between mb-2">
						<span className="text-xs font-semibold text-muted uppercase tracking-wider">
							Administradores
						</span>
						<div className="w-8 h-8 rounded-lg bg-blue-500/10 text-blue-500 flex items-center justify-center">
							<ShieldCheck className="w-4 h-4" />
						</div>
					</div>
					<div className="text-2xl font-bold text-main">
						{stats.admins}
					</div>
					<span className="text-xs text-muted">Acesso total</span>
				</button>
			</div>

			{/* Barra de Busca e Filtros */}
			<div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center justify-between">
				{/* Campo de Busca */}
				<div className="relative flex-1 max-w-md">
					<Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-muted pointer-events-none" />
					<input
						type="text"
						value={search}
						onChange={(e) => setSearch(e.target.value)}
						placeholder="Buscar por nome, @username, e-mail ou telefone..."
						className="w-full pl-10 pr-9 py-2 bg-surface border border-border rounded-xl text-sm text-main placeholder:text-muted focus:outline-none focus:border-primary transition-colors"
					/>
					{search && (
						<button
							type="button"
							onClick={() => setSearch('')}
							className="absolute right-3 top-1/2 -translate-y-1/2 text-muted hover:text-main cursor-pointer"
							title="Limpar busca"
						>
							<X className="w-4 h-4" />
						</button>
					)}
				</div>

				{/* Filtro por vínculo de jogador */}
				<div className="flex items-center gap-2">
					<span className="text-xs text-muted font-medium hidden md:inline">Vínculo:</span>
					<div className="inline-flex bg-surface border border-border rounded-xl p-1 text-xs">
						<button
							type="button"
							onClick={() => setPlayerFilter('all')}
							className={`px-3 py-1.5 rounded-lg font-medium transition-colors cursor-pointer ${
								playerFilter === 'all'
									? 'bg-primary/20 text-primary font-semibold'
									: 'text-muted hover:text-main hover:bg-hover-nav'
							}`}
						>
							Todos
						</button>
						<button
							type="button"
							onClick={() => setPlayerFilter('linked')}
							className={`px-3 py-1.5 rounded-lg font-medium transition-colors cursor-pointer ${
								playerFilter === 'linked'
									? 'bg-primary/20 text-primary font-semibold'
									: 'text-muted hover:text-main hover:bg-hover-nav'
							}`}
						>
							Vinculados
						</button>
						<button
							type="button"
							onClick={() => setPlayerFilter('unlinked')}
							className={`px-3 py-1.5 rounded-lg font-medium transition-colors cursor-pointer ${
								playerFilter === 'unlinked'
									? 'bg-primary/20 text-primary font-semibold'
									: 'text-muted hover:text-main hover:bg-hover-nav'
							}`}
						>
							Sem Vínculo
						</button>
					</div>
				</div>
			</div>

			{/* Tabela de Usuários */}
			<section className="bg-surface border border-border rounded-2xl overflow-hidden shadow-sm">
				{/* Cabeçalho da Tabela (Desktop) */}
				<div className="hidden lg:grid lg:grid-cols-[2fr_1.8fr_1.8fr_1.4fr_120px] gap-4 items-center px-5 py-3.5 text-xs font-semibold text-muted tracking-wider uppercase border-b border-border bg-hover-nav/40">
					<span>USUÁRIO</span>
					<span>CONTATO</span>
					<span>JOGADOR VINCULADO</span>
					<span>STATUS & FUNÇÃO</span>
					<span className="text-right">AÇÕES</span>
				</div>

				{filteredUsers.length === 0 ? (
					<div className="px-5 py-12 text-center text-sm text-muted flex flex-col items-center gap-2">
						<Users className="w-8 h-8 text-muted/50 mb-1" />
						<p className="font-medium text-main">Nenhum usuário encontrado</p>
						<p className="text-xs text-muted max-w-sm">
							Tente ajustar os termos da busca ou os filtros selecionados acima.
						</p>
					</div>
				) : (
					paginatedUsers.map((u) => {
						const isSelf = u.id_user === user?.id_user;
						const initial = (u.name || u.username || 'U').charAt(0).toUpperCase();

						return (
							<div
								key={u.id_user}
								className="grid grid-cols-1 lg:grid-cols-[2fr_1.8fr_1.8fr_1.4fr_120px] gap-4 items-center px-5 py-4 border-t first:border-t-0 lg:first:border-t border-border hover:bg-hover-nav/40 transition-colors"
							>
								{/* Coluna 1: Usuário */}
								<div className="flex items-center gap-3 min-w-0">
									<div
										className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm shrink-0 ${
											u.is_admin
												? 'bg-blue-500/15 text-blue-500 border border-blue-500/30'
												: 'bg-primary/10 text-primary border border-primary/20'
										}`}
									>
										{initial}
									</div>
									<div className="min-w-0">
										<div className="flex items-center gap-2 flex-wrap">
											<span className="font-semibold text-main text-sm truncate">
												{u.name}
											</span>
											{isSelf && (
												<span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-primary/20 text-primary">
													Você
												</span>
											)}
										</div>
										<span className="text-xs text-muted truncate block">
											@{u.username}
										</span>
									</div>
								</div>

								{/* Coluna 2: Contato */}
								<div className="min-w-0 text-sm">
									<div className="text-main truncate text-xs sm:text-sm">
										{u.email}
									</div>
									<div className="text-xs text-muted truncate mt-0.5">
										{u.phone_number || 'Sem telefone'}
									</div>
								</div>

								{/* Coluna 3: Jogador Vinculado */}
								<div className="flex items-center gap-1.5 flex-wrap min-w-0">
									{u.players && u.players.length > 0 ? (
										u.players.map((pl) => (
											<span
												key={pl.id_player}
												className="inline-flex items-center gap-1.5 text-xs bg-primary/10 border border-primary/25 text-primary px-2.5 py-1 rounded-lg"
											>
												<Link
													href={`/players/${pl.id_player}`}
													className="hover:underline font-medium truncate max-w-[140px]"
													title={pl.nome}
												>
													⚽ {pl.apelido || pl.nome}
												</Link>
												<button
													type="button"
													onClick={() =>
														unlinkPlayerMutation.mutate({
															userId: u.id_user,
															playerId: pl.id_player,
														})
													}
													className="text-muted hover:text-red-400 cursor-pointer transition-colors p-0.5 rounded"
													title="Desvincular jogador"
												>
													<Unlink className="w-3 h-3" />
												</button>
											</span>
										))
									) : (
										<button
											type="button"
											onClick={() => {
												setLinkingUser(u);
												setSelectedPlayerId('');
											}}
											className="inline-flex items-center gap-1.5 text-xs text-muted hover:text-primary border border-dashed border-border hover:border-primary/50 px-2.5 py-1 rounded-lg transition-colors cursor-pointer bg-surface/50"
										>
											<Link2 className="w-3 h-3" />
											Vincular Jogador
										</button>
									)}
								</div>

								{/* Coluna 4: Status e Função */}
								<div className="flex items-center gap-2 flex-wrap">
									<span
										className={`text-xs font-medium px-2.5 py-0.5 rounded-full border ${
											u.is_admin
												? 'bg-blue-500/10 text-blue-500 border-blue-500/25'
												: 'bg-hover-nav text-muted border-border'
										}`}
									>
										{u.is_admin ? 'Admin' : 'Membro'}
									</span>
									<span
										className={`inline-flex items-center gap-1 text-xs font-medium px-2.5 py-0.5 rounded-full border ${
											u.is_active
												? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/25'
												: 'bg-amber-500/10 text-amber-500 border-amber-500/25'
										}`}
									>
										<span
											className={`w-1.5 h-1.5 rounded-full ${
												u.is_active ? 'bg-emerald-500' : 'bg-amber-500'
											}`}
										/>
										{u.is_active ? 'Ativo' : 'Pendente'}
									</span>
								</div>

								{/* Coluna 5: Ações */}
								<div className="flex items-center gap-1 justify-end">
									{!u.is_active && (
										<button
											type="button"
											onClick={() => resendMutation.mutate(u.id_user)}
											disabled={resendMutation.isPending}
											className="p-2 rounded-lg text-primary hover:text-primary-hover hover:bg-hover-nav border border-transparent hover:border-border transition-colors cursor-pointer"
											title="Gerar / Obter Link de Ativação Direto"
										>
											<Link2 className="w-4 h-4" />
										</button>
									)}
									<button
										type="button"
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
										className="p-2 rounded-lg text-muted hover:text-main hover:bg-hover-nav border border-transparent hover:border-border transition-colors cursor-pointer"
										title="Editar Usuário"
									>
										<Pencil className="w-4 h-4" />
									</button>
									{!isSelf && (
										<button
											type="button"
											onClick={() => {
												if (
													confirm(
														`Tem certeza que deseja excluir o usuário "${u.username}"?`,
													)
												) {
													deleteMutation.mutate(u.id_user);
												}
											}}
											className="p-2 rounded-lg text-muted hover:text-red-400 hover:bg-red-500/10 border border-transparent hover:border-red-500/20 transition-colors cursor-pointer"
											title="Excluir Usuário"
										>
											<Trash2 className="w-4 h-4" />
										</button>
									)}
								</div>
							</div>
						);
					})
				)}

				{/* Paginação */}
				{filteredUsers.length > pageSize && (
					<div className="flex items-center justify-between border-t border-border p-4 px-5 flex-wrap gap-3 bg-surface">
						<span className="text-xs text-muted">
							Mostrando{' '}
							<strong className="text-main">
								{Math.min(
									(currentPage - 1) * pageSize + 1,
									filteredUsers.length,
								)}
							</strong>{' '}
							a{' '}
							<strong className="text-main">
								{Math.min(
									currentPage * pageSize,
									filteredUsers.length,
								)}
							</strong>{' '}
							de{' '}
							<strong className="text-main">
								{filteredUsers.length}
							</strong>{' '}
							usuários
						</span>

						<div className="flex items-center gap-1.5">
							<button
								type="button"
								onClick={() =>
									setCurrentPage((p) => Math.max(1, p - 1))
								}
								disabled={currentPage === 1}
								className="p-1.5 rounded-lg border border-border bg-surface text-main hover:bg-hover-nav disabled:opacity-40 disabled:cursor-not-allowed transition-colors cursor-pointer"
								title="Página anterior"
							>
								<ChevronLeft className="w-4 h-4" />
							</button>

							<span className="px-3 py-1 text-xs font-medium text-main bg-surface border border-border rounded-lg">
								{currentPage} / {totalPages}
							</span>

							<button
								type="button"
								onClick={() =>
									setCurrentPage((p) =>
										Math.min(totalPages, p + 1),
									)
								}
								disabled={currentPage === totalPages}
								className="p-1.5 rounded-lg border border-border bg-surface text-main hover:bg-hover-nav disabled:opacity-40 disabled:cursor-not-allowed transition-colors cursor-pointer"
								title="Próxima página"
							>
								<ChevronRight className="w-4 h-4" />
							</button>
						</div>
					</div>
				)}
			</section>

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
							{sortedPlayersForLink.map((p) => {
								const isLinked = Boolean(p.user_id);
								const displayName = p.apelido ? `${p.nome} (${p.apelido})` : p.nome;
								return (
									<option key={p.id_player} value={p.id_player}>
										{displayName} {isLinked ? '✓ (Já vinculado)' : '— (Disponível)'}
									</option>
								);
							})}
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

					<label className="flex items-start gap-2.5 text-xs text-muted cursor-pointer bg-background p-3 rounded-xl border border-border hover:border-border-hover transition">
						<input
							type="checkbox"
							className="mt-0.5"
							checked={inviteForm.skip_email}
							onChange={(e) =>
								setInviteForm({
									...inviteForm,
									skip_email: e.target.checked,
								})
							}
						/>
						<div>
							<span className="font-semibold text-main block">Modo teste: Não enviar e-mail por SMTP</span>
							<span>Cria o usuário e gera o link/credenciais de convite sem disparar e-mail para a caixa postal (evita bloqueios e bounces).</span>
						</div>
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
				title="Acesso e Ativação do Usuário"
				maxWidth="max-w-lg"
			>
				{inviteInfo && (() => {
					const displayLink =
						inviteInfo.invite_link ||
						normalizeInviteLink(inviteInfo.invite_link, inviteInfo.setup_token);
					const displayPassword = inviteInfo.temporary_password || 'Baygon@123';

					return (
						<div className="flex flex-col gap-4 text-sm">
							<div className="flex items-start gap-3 p-3.5 rounded-xl bg-primary/10 border border-primary/25 text-primary">
								<CheckCircle2 className="w-5 h-5 shrink-0 mt-0.5" />
								<div className="text-xs">
									<p className="font-semibold text-main text-sm">Link de ativação gerado com sucesso!</p>
									<p className="text-muted mt-1 leading-relaxed">
										Para ativar o usuário <strong className="text-main">@{inviteInfo.username}</strong> ({inviteInfo.email}), compartilhe o link direto e a senha provisória abaixo:
									</p>
								</div>
							</div>

							{/* Bloco 1: Link Direto de Ativação */}
							<div className="flex flex-col gap-2">
								<div className="flex items-center justify-between">
									<span className="text-xs font-semibold text-main flex items-center gap-1.5">
										<Link2 className="w-3.5 h-3.5 text-primary" />
										Link Direto de Ativação
									</span>
									<span className="text-[11px] text-muted">Válido por 24 horas</span>
								</div>

								{/* Container do link com quebra total e texto visível */}
								<div className="p-3 rounded-xl bg-background border border-border text-xs font-mono text-main break-all select-all leading-relaxed max-h-28 overflow-y-auto font-medium">
									{displayLink || 'Gerando link de ativação...'}
								</div>

								{/* Ações do Link com botões bem identificados */}
								<div className="flex items-center gap-2">
									<Button
										type="button"
										variant={copiedField === 'link' ? 'primary' : 'ghost'}
										size="sm"
										className="w-auto flex items-center justify-center gap-1.5 px-3.5 py-2 text-xs font-semibold"
										onClick={() => copyText('link', displayLink)}
									>
										{copiedField === 'link' ? (
											<Check className="w-4 h-4 text-emerald-400" />
										) : (
											<Copy className="w-4 h-4" />
										)}
										<span>{copiedField === 'link' ? 'Link Copiado!' : 'Copiar Link'}</span>
									</Button>

									{displayLink && (
										<a
											href={displayLink}
											target="_blank"
											rel="noreferrer"
											className="inline-flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-semibold bg-primary hover:bg-primary-hover text-white transition cursor-pointer"
										>
											<span>Abrir Página de Ativação</span>
											<ExternalLink className="w-3.5 h-3.5" />
										</a>
									)}
								</div>
							</div>

							{/* Bloco 2: Senha Inicial Temporária */}
							<div className="flex flex-col gap-2">
								<span className="text-xs font-semibold text-main flex items-center gap-1.5">
									<ShieldCheck className="w-3.5 h-3.5 text-amber-500" />
									Senha Inicial Temporária
								</span>

								<div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/25 flex items-center justify-between gap-3">
									<div className="flex flex-col gap-0.5">
										<span className="text-[11px] uppercase tracking-wider font-semibold text-amber-500">
											Senha Provisória
										</span>
										<span className="font-mono text-base font-bold tracking-wider text-main select-all">
											{displayPassword}
										</span>
									</div>

									<Button
										type="button"
										variant="ghost"
										size="sm"
										className="w-auto flex items-center gap-1.5 border border-amber-500/30 text-amber-500 hover:bg-amber-500/10 px-3 py-1.5 text-xs font-semibold"
										onClick={() => copyText('pass', displayPassword)}
									>
										{copiedField === 'pass' ? (
											<Check className="w-4 h-4 text-emerald-400" />
										) : (
											<Copy className="w-4 h-4" />
										)}
										<span>{copiedField === 'pass' ? 'Senha Copiada!' : 'Copiar Senha'}</span>
									</Button>
								</div>

								<span className="text-[11px] text-muted leading-relaxed">
									O usuário informará esta senha temporária no primeiro acesso e em seguida definirá sua nova senha definitiva.
								</span>
							</div>

							<Button
								type="button"
								onClick={() => setInviteInfo(null)}
								className="mt-2"
							>
								Concluído / Fechar
							</Button>
						</div>
					);
				})()}
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
					<FormField label="Jogador para vincular">
						<Select
							value={selectedPlayerId}
							onChange={(e) =>
								setSelectedPlayerId(e.target.value)
							}
							required
						>
							<option value="">Selecione um jogador...</option>
							{sortedPlayersForLink.map((p) => {
								const isLinked = Boolean(p.user_id);
								const displayName = p.apelido ? `${p.nome} (${p.apelido})` : p.nome;
								return (
									<option key={p.id_player} value={p.id_player}>
										{displayName} {isLinked ? '✓ (Já vinculado)' : '— (Disponível)'}
									</option>
								);
							})}
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
