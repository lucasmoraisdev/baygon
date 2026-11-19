'use client';

import { useAuth } from '@/context/AuthContext';
import { useSidebar } from '@/context/SidebarContext';
import { useTheme } from '@/context/ThemeContext';
import {
	Award,
	Calendar,
	ChevronLeft,
	ChevronRight,
	CircleDollarSign,
	ExternalLink,
	FileSpreadsheet,
	Gamepad2,
	KeyRound,
	LayoutDashboard,
	LogOut,
	LucideIcon,
	Moon,
	Shield,
	Sliders,
	Sun,
	Trophy,
	UserCog,
	Users,
	Vote,
	X,
} from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import React, { useEffect } from 'react';

interface MenuItem {
	name: string;
	path: string;
	icon: LucideIcon;
	adminOnly?: boolean;
}

interface MenuSection {
	title: string;
	adminOnly?: boolean;
	items: MenuItem[];
}

const MENU_SECTIONS: MenuSection[] = [
	{
		title: 'Competições',
		items: [
			{ name: 'Dashboard', path: '/', icon: LayoutDashboard },
			{ name: 'Temporadas', path: '/seasons', icon: Calendar },
			{ name: 'Partidas', path: '/matches', icon: Trophy },
			{ name: 'Times', path: '/teams', icon: Shield },
			{ name: 'Jogadores', path: '/players', icon: Users },
			{ name: 'Premiações', path: '/awards', icon: Award },
			{ name: 'Votações', path: '/polls', icon: Vote },
			{ name: 'Fantasy Game', path: '/fantasy', icon: Gamepad2 },
			{ name: 'Portal Público ↗', path: '/public', icon: ExternalLink },
		],
	},
	{
		title: 'Administração',
		adminOnly: true,
		items: [
			{ name: 'Regras', path: '/admin/rules', icon: Sliders, adminOnly: true },
			{
				name: 'Importar Súmula',
				path: '/admin/sumulas',
				icon: FileSpreadsheet,
				adminOnly: true,
			},
			{
				name: 'Usuários',
				path: '/admin/users',
				icon: UserCog,
				adminOnly: true,
			},
			{
				name: 'Financeiro',
				path: '/admin/financeiro',
				icon: CircleDollarSign,
				adminOnly: true,
			},
		],
	},
];

export default function Sidebar() {
	const pathname = usePathname();
	const { user, logout } = useAuth();
	const { theme, toggleTheme } = useTheme();
	const { isCollapsed, toggleSidebar, isMobileOpen, setIsMobileOpen } =
		useSidebar();
	const isAdmin = Boolean(user?.is_admin || user?.role === 'admin');

	// Fechar mobile drawer com tecla ESC
	useEffect(() => {
		const handleKeyDown = (e: KeyboardEvent) => {
			if (e.key === 'Escape' && isMobileOpen) {
				setIsMobileOpen(false);
			}
		};
		window.addEventListener('keydown', handleKeyDown);
		return () => window.removeEventListener('keydown', handleKeyDown);
	}, [isMobileOpen, setIsMobileOpen]);

	const isItemActive = (path: string) => {
		if (path === '/') {
			return pathname === '/';
		}
		return pathname === path || pathname.startsWith(path + '/');
	};

	return (
		<>
			{/* Backdrop para mobile quando a barra estiver aberta */}
			{isMobileOpen && (
				<div
					onClick={() => setIsMobileOpen(false)}
					className="fixed inset-0 bg-slate-900/40 dark:bg-black/70 backdrop-blur-sm z-40 md:hidden transition-opacity duration-300"
					aria-hidden="true"
				/>
			)}

			<aside
				aria-label="Navegação Lateral"
				className={`fixed left-0 top-0 h-screen z-50 bg-white/95 dark:bg-[#0d1527]/95 border-r border-[#e1eaf3] dark:border-white/[0.08] backdrop-blur-md flex flex-col transition-all duration-300 ease-in-out ${isCollapsed ? 'w-[72px]' : 'w-64'
					} ${isMobileOpen
						? 'translate-x-0'
						: '-translate-x-full md:translate-x-0'
					}`}
			>
				{/* Botão de Retração / Expansão na Borda (Desktop - Estilo Stripe) */}
				<button
					type="button"
					onClick={toggleSidebar}
					aria-label={isCollapsed ? 'Expandir menu lateral' : 'Recolher menu lateral'}
					title={isCollapsed ? 'Expandir menu lateral' : 'Recolher menu lateral'}
					className="hidden md:flex absolute -right-3 top-5 z-50 w-6 h-6 items-center justify-center rounded-full bg-white dark:bg-[#151f38] border border-[#d4dee9] dark:border-white/20 text-[#50617a] dark:text-slate-300 hover:text-[#1a2c44] dark:hover:text-white hover:bg-[#f4f7fa] dark:hover:bg-blue-600 hover:border-[#635bff] dark:hover:border-blue-400 transition-all shadow-sm cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#635bff]"
				>
					{isCollapsed ? <ChevronRight size={13} /> : <ChevronLeft size={13} />}
				</button>

				{/* Header do Menu */}
				<div
					className={`h-16 border-b border-[#e1eaf3] dark:border-white/[0.08] flex items-center px-4 transition-all ${isCollapsed ? 'justify-center' : 'justify-between'
						}`}
				>
					{!isCollapsed ? (
						<div className="flex items-center gap-3 overflow-hidden">
							<div className="w-9 h-9 rounded-xl bg-gradient-to-br from-[#635bff] to-[#533afd] flex items-center justify-center font-black text-white text-base shadow-sm shadow-[#635bff]/25 shrink-0 ring-1 ring-black/[0.06] dark:ring-white/20">
								B
							</div>
							<div className="flex flex-col min-w-0">
								<div className="flex items-center gap-1.5">
									<h2 className="text-base font-bold text-[#1a2c44] dark:text-white tracking-tight m-0 truncate">
										Baygon
									</h2>
									<span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-[#e5e8fe] dark:bg-blue-500/20 text-[#4e11e2] dark:text-blue-400 border border-[#c3b6fb]/60 dark:border-blue-500/30 leading-none">
										API
									</span>
								</div>
								<span className="text-[11px] text-[#667691] dark:text-slate-400 truncate">
									Painel do Torneio
								</span>
							</div>
						</div>
					) : (
						<div
							title="Baygon API"
							className="w-9 h-9 rounded-xl bg-gradient-to-br from-[#635bff] to-[#533afd] flex items-center justify-center font-black text-white text-base shadow-sm shadow-[#635bff]/25 ring-1 ring-black/[0.06] dark:ring-white/20"
						>
							B
						</div>
					)}

					{/* Botão de Fechar Exclusivo para Mobile */}
					<button
						type="button"
						onClick={() => setIsMobileOpen(false)}
						aria-label="Fechar menu"
						className="md:hidden flex items-center justify-center w-8 h-8 rounded-lg border border-[#e1eaf3] dark:border-white/10 bg-[#f4f7fa] dark:bg-white/[0.04] text-[#50617a] dark:text-slate-300 hover:text-[#1a2c44] dark:hover:text-white transition-colors cursor-pointer"
					>
						<X size={18} />
					</button>
				</div>

				{/* Lista de Navegação Agrupada */}
				<nav
					aria-label="Menu principal"
					className="flex-1 flex flex-col gap-1 p-3 overflow-y-auto overflow-x-hidden scrollbar-thin scrollbar-thumb-[#d4dee9] dark:scrollbar-thumb-white/10"
				>
					{MENU_SECTIONS.map((section, sIndex) => {
						if (section.adminOnly && !isAdmin) return null;

						return (
							<div key={section.title} className="flex flex-col gap-1">
								{/* Título da Seção */}
								{!isCollapsed ? (
									<div className={`px-3 flex items-center justify-between ${sIndex > 0 ? 'pt-4 pb-1' : 'pt-1 pb-1'}`}>
										<span className="text-[10px] font-bold uppercase tracking-wider text-[#7d8ba4] dark:text-slate-400">
											{section.title}
										</span>
										{section.adminOnly && (
											<span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-[#fde5d2] dark:bg-amber-500/15 text-[#922700] dark:text-amber-400 border border-[#fbd992] dark:border-amber-500/30 leading-none">
												ADMIN
											</span>
										)}
									</div>
								) : (
									sIndex > 0 && (
										<div
											className="my-2 mx-3 h-px bg-[#e1eaf3] dark:bg-white/[0.08]"
											aria-hidden="true"
										/>
									)
								)}

								{/* Itens da Seção */}
								{section.items.map((item) => {
									const Icon = item.icon;
									const isActive = isItemActive(item.path);

									return (
										<Link
											key={item.path}
											href={item.path}
											onClick={() => setIsMobileOpen(false)}
											aria-current={isActive ? 'page' : undefined}
											className={`group relative flex items-center rounded-xl font-medium text-sm transition-all duration-200 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#635bff] ${isCollapsed
													? 'justify-center w-11 h-11 mx-auto'
													: 'gap-3 px-3 py-2.5'
												} ${isActive
													? 'bg-[#f4f2fd] dark:bg-gradient-to-r dark:from-blue-600/25 dark:via-blue-600/15 dark:to-blue-600/5 text-[#533afd] dark:text-white font-semibold border border-[#e5e8fe] dark:border-blue-500/30 shadow-xs'
													: 'text-[#50617a] dark:text-slate-400 hover:text-[#1a2c44] dark:hover:text-white hover:bg-[#ecf1f6]/70 dark:hover:bg-white/[0.05] border border-transparent'
												}`}
										>
											{/* Barra luminosa de item ativo */}
											{isActive && (
												<span
													className={`absolute left-0 w-1 bg-[#635bff] dark:bg-gradient-to-b dark:from-blue-400 dark:to-indigo-500 rounded-r dark:shadow-[0_0_10px_rgba(59,130,246,0.8)] ${isCollapsed ? 'top-2 bottom-2' : 'top-1.5 bottom-1.5'
														}`}
												/>
											)}

											<Icon
												size={19}
												className={`shrink-0 transition-transform duration-200 ${isActive
														? 'text-[#635bff] dark:text-blue-400'
														: 'text-[#7d8ba4] dark:text-slate-400 group-hover:text-[#1a2c44] dark:group-hover:text-white group-hover:scale-105'
													}`}
											/>

											{!isCollapsed && (
												<span className="truncate group-hover:translate-x-0.5 transition-transform duration-150">
													{item.name}
												</span>
											)}

											{/* Tooltip flutuante quando colapsado */}
											{isCollapsed && (
												<div
													role="tooltip"
													className="absolute left-[calc(100%+12px)] top-1/2 -translate-y-1/2 px-3 py-1.5 rounded-lg bg-[#1a2c44] dark:bg-[#0d1527] border border-[#3c4f69] dark:border-white/15 text-white text-xs font-semibold whitespace-nowrap shadow-xl opacity-0 pointer-events-none group-hover:opacity-100 group-hover:pointer-events-auto transition-all duration-150 z-50 flex items-center gap-1.5 backdrop-blur-md"
												>
													<span className="absolute -left-1 top-1/2 -translate-y-1/2 w-2 h-2 rotate-45 bg-[#1a2c44] dark:bg-[#0d1527] border-l border-b border-[#3c4f69] dark:border-white/15" />
													<span>{item.name}</span>
													{item.adminOnly && (
														<span className="text-[9px] px-1 py-0.5 rounded bg-amber-500/20 text-amber-300 font-bold border border-amber-500/30">
															Admin
														</span>
													)}
												</div>
											)}
										</Link>
									);
								})}
							</div>
						);
					})}
				</nav>

				{/* Rodapé do Usuário e Alternador de Tema */}
				<div className="p-3 border-t border-[#e1eaf3] dark:border-white/[0.08] flex flex-col gap-2.5 bg-[#f8fafc]/90 dark:bg-[#0a101f]/80 backdrop-blur-sm">
					{!isCollapsed ? (
						<div className="flex flex-col gap-2.5 bg-white dark:bg-white/[0.03] border border-[#e1eaf3] dark:border-white/[0.06] rounded-xl p-2.5 shadow-[0_1px_3px_rgba(0,0,0,0.04)]">
							{/* Card de Usuário */}
							<div className="flex items-center gap-3">
								<div className="relative shrink-0">
									<div
										title={user?.username || 'Usuário'}
										className="w-9 h-9 rounded-full bg-gradient-to-br from-[#635bff] to-[#533afd] text-white flex items-center justify-center font-bold text-sm shadow-sm shadow-[#635bff]/20"
									>
										{user?.username?.charAt(0).toUpperCase() || 'U'}
									</div>
									<span
										title="Online"
										className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 bg-emerald-500 border-2 border-white dark:border-[#0a101f] rounded-full"
									/>
								</div>

								<div className="flex flex-col min-w-0 flex-1">
									<span className="text-sm font-semibold text-[#1a2c44] dark:text-white truncate">
										{user?.username || 'Usuário'}
									</span>
									<div className="flex items-center gap-1.5 mt-0.5">
										<span
											className={`w-1.5 h-1.5 rounded-full ${isAdmin ? 'bg-amber-500' : 'bg-[#635bff]'
												}`}
										/>
										<span className="text-[11px] font-medium text-[#667691] dark:text-slate-400 capitalize truncate">
											{isAdmin ? 'Administrador' : (user?.role || 'Membro')}
										</span>
									</div>
								</div>
							</div>

							{/* Alternador de Tema (Dark / Light) */}
							<button
								type="button"
								onClick={toggleTheme}
								aria-label={`Alternar para modo ${theme === 'dark' ? 'claro' : 'escuro'}`}
								title={`Alternar para modo ${theme === 'dark' ? 'claro' : 'escuro'}`}
								className="flex items-center justify-between w-full px-2.5 py-1.5 rounded-lg border border-[#e1eaf3] dark:border-white/[0.08] bg-[#f4f7fa] dark:bg-white/[0.03] hover:bg-[#e8edf3] dark:hover:bg-white/[0.08] text-[#3c4f69] dark:text-slate-300 hover:text-[#1a2c44] dark:hover:text-white text-xs font-medium transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#635bff]"
							>
								<div className="flex items-center gap-2">
									{theme === 'dark' ? (
										<Moon size={14} className="text-blue-400 shrink-0" />
									) : (
										<Sun size={14} className="text-[#e46602] shrink-0" />
									)}
									<span>{theme === 'dark' ? 'Tema Escuro' : 'Tema Claro'}</span>
								</div>
								<span className="text-[10px] font-semibold uppercase px-1.5 py-0.5 rounded bg-[#e1eaf3]/70 dark:bg-white/10 text-[#50617a] dark:text-slate-400 leading-none">
									{theme === 'dark' ? 'Dark' : 'Light'}
								</span>
							</button>

							{/* Ações: Senha e Sair */}
							<div className="grid grid-cols-2 gap-1.5 pt-1 border-t border-[#e1eaf3] dark:border-white/[0.05]">
								<Link
									href="/change-password"
									onClick={() => setIsMobileOpen(false)}
									title="Alterar Senha"
									className="flex items-center justify-center gap-1.5 px-2 py-1.5 rounded-lg border border-[#e1eaf3] dark:border-white/[0.08] bg-[#f8fafc] dark:bg-white/[0.03] hover:bg-[#e8edf3] dark:hover:bg-white/[0.08] hover:border-[#bac8da] dark:hover:border-white/15 text-[#3c4f69] dark:text-slate-300 hover:text-[#1a2c44] dark:hover:text-white text-xs font-medium transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#635bff]"
								>
									<KeyRound size={13} className="shrink-0 text-[#7d8ba4]" />
									<span className="truncate">Senha</span>
								</Link>

								<button
									type="button"
									onClick={logout}
									title="Encerrar Sessão"
									className="flex items-center justify-center gap-1.5 px-2 py-1.5 rounded-lg border border-[#fde3e5] dark:border-rose-500/20 bg-[#fef0f3] dark:bg-rose-500/10 hover:bg-[#fde3e5] dark:hover:bg-rose-500/20 text-[#c0123c] dark:text-rose-300 hover:text-[#9b0c36] dark:hover:text-rose-200 text-xs font-medium transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500"
								>
									<LogOut size={13} className="shrink-0" />
									<span>Sair</span>
								</button>
							</div>
						</div>
					) : (
						<div className="flex flex-col items-center gap-2">
							{/* Avatar em modo colapsado com tooltip */}
							<div className="group relative">
								<div className="relative">
									<div className="w-10 h-10 rounded-full bg-gradient-to-br from-[#635bff] to-[#533afd] text-white flex items-center justify-center font-bold text-sm shadow-sm shadow-[#635bff]/25 cursor-default">
										{user?.username?.charAt(0).toUpperCase() || 'U'}
									</div>
									<span className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 bg-emerald-500 border-2 border-white dark:border-[#0a101f] rounded-full" />
								</div>
								<div
									role="tooltip"
									className="absolute left-[calc(100%+12px)] top-1/2 -translate-y-1/2 px-3 py-1.5 rounded-lg bg-[#1a2c44] dark:bg-[#0d1527] border border-[#3c4f69] dark:border-white/15 text-white text-xs font-semibold whitespace-nowrap shadow-xl opacity-0 pointer-events-none group-hover:opacity-100 group-hover:pointer-events-auto transition-all duration-150 z-50 flex items-center gap-1.5 backdrop-blur-md"
								>
									<span className="absolute -left-1 top-1/2 -translate-y-1/2 w-2 h-2 rotate-45 bg-[#1a2c44] dark:bg-[#0d1527] border-l border-b border-[#3c4f69] dark:border-white/15" />
									<span>{user?.username || 'Usuário'}</span>
									<span className="text-[10px] text-slate-300">({isAdmin ? 'Admin' : 'Membro'})</span>
								</div>
							</div>

							{/* Alternar Tema em modo colapsado */}
							<button
								type="button"
								onClick={toggleTheme}
								aria-label={`Alternar para modo ${theme === 'dark' ? 'claro' : 'escuro'}`}
								className="group relative flex items-center justify-center w-10 h-10 rounded-lg border border-[#e1eaf3] dark:border-white/[0.08] bg-[#f4f7fa] dark:bg-white/[0.02] hover:bg-[#e8edf3] dark:hover:bg-white/[0.08] text-[#3c4f69] dark:text-slate-400 hover:text-[#1a2c44] dark:hover:text-white transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#635bff]"
							>
								{theme === 'dark' ? (
									<Moon size={16} className="text-blue-400" />
								) : (
									<Sun size={16} className="text-[#e46602]" />
								)}
								<div
									role="tooltip"
									className="absolute left-[calc(100%+12px)] top-1/2 -translate-y-1/2 px-3 py-1.5 rounded-lg bg-[#1a2c44] dark:bg-[#0d1527] border border-[#3c4f69] dark:border-white/15 text-white text-xs font-semibold whitespace-nowrap shadow-xl opacity-0 pointer-events-none group-hover:opacity-100 group-hover:pointer-events-auto transition-all duration-150 z-50 flex items-center gap-1.5 backdrop-blur-md"
								>
									<span className="absolute -left-1 top-1/2 -translate-y-1/2 w-2 h-2 rotate-45 bg-[#1a2c44] dark:bg-[#0d1527] border-l border-b border-[#3c4f69] dark:border-white/15" />
									<span>{theme === 'dark' ? 'Ativar Modo Claro' : 'Ativar Modo Escuro'}</span>
								</div>
							</button>

							{/* Senha em modo colapsado */}
							<Link
								href="/change-password"
								onClick={() => setIsMobileOpen(false)}
								aria-label="Alterar Senha"
								className="group relative flex items-center justify-center w-10 h-10 rounded-lg border border-[#e1eaf3] dark:border-white/[0.08] bg-[#f8fafc] dark:bg-white/[0.02] hover:bg-[#e8edf3] dark:hover:bg-white/[0.08] text-[#50617a] dark:text-slate-400 hover:text-[#1a2c44] dark:hover:text-white transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#635bff]"
							>
								<KeyRound size={16} />
								<div
									role="tooltip"
									className="absolute left-[calc(100%+12px)] top-1/2 -translate-y-1/2 px-3 py-1.5 rounded-lg bg-[#1a2c44] dark:bg-[#0d1527] border border-[#3c4f69] dark:border-white/15 text-white text-xs font-semibold whitespace-nowrap shadow-xl opacity-0 pointer-events-none group-hover:opacity-100 group-hover:pointer-events-auto transition-all duration-150 z-50 flex items-center gap-1.5 backdrop-blur-md"
								>
									<span className="absolute -left-1 top-1/2 -translate-y-1/2 w-2 h-2 rotate-45 bg-[#1a2c44] dark:bg-[#0d1527] border-l border-b border-[#3c4f69] dark:border-white/15" />
									<span>Alterar Senha</span>
								</div>
							</Link>

							{/* Sair em modo colapsado */}
							<button
								type="button"
								onClick={logout}
								aria-label="Sair"
								className="group relative flex items-center justify-center w-10 h-10 rounded-lg border border-[#fde3e5] dark:border-rose-500/20 bg-[#fef0f3] dark:bg-rose-500/10 hover:bg-[#fde3e5] dark:hover:bg-rose-500/20 text-[#c0123c] dark:text-rose-300 hover:text-[#9b0c36] dark:hover:text-rose-200 transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500"
							>
								<LogOut size={16} />
								<div
									role="tooltip"
									className="absolute left-[calc(100%+12px)] top-1/2 -translate-y-1/2 px-3 py-1.5 rounded-lg bg-[#1a2c44] dark:bg-[#0d1527] border border-[#3c4f69] dark:border-white/15 text-rose-300 text-xs font-semibold whitespace-nowrap shadow-xl opacity-0 pointer-events-none group-hover:opacity-100 group-hover:pointer-events-auto transition-all duration-150 z-50 flex items-center gap-1.5 backdrop-blur-md"
								>
									<span className="absolute -left-1 top-1/2 -translate-y-1/2 w-2 h-2 rotate-45 bg-[#1a2c44] dark:bg-[#0d1527] border-l border-b border-[#3c4f69] dark:border-white/15" />
									<span>Sair</span>
								</div>
							</button>
						</div>
					)}
				</div>
			</aside>
		</>
	);
}
