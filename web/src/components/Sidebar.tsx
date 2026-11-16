'use client';

import { useAuth } from '@/context/AuthContext';
import { useSidebar } from '@/context/SidebarContext';
import {
	Award,
	Calendar,
	ChevronLeft,
	ChevronRight,
	FileSpreadsheet,
	KeyRound,
	LayoutDashboard,
	LogOut,
	Shield,
	Sliders,
	Trophy,
	UserCog,
	Users,
} from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import React from 'react';

const MENU_ITEMS = [
	{ name: 'Dashboard', path: '/', icon: LayoutDashboard },
	{ name: 'Temporadas', path: '/seasons', icon: Calendar },
	{ name: 'Times', path: '/teams', icon: Shield },
	{ name: 'Jogadores', path: '/players', icon: Users },
	{ name: 'Partidas', path: '/matches', icon: Trophy },
	{ name: 'Prêmios (Awards)', path: '/awards', icon: Award },
	{ name: 'Regras (Admin)', path: '/admin/rules', icon: Sliders, adminOnly: true },
	{
		name: 'Importar Súmula (Admin)',
		path: '/admin/sumulas',
		icon: FileSpreadsheet,
		adminOnly: true,
	},
	{ name: 'Usuários (Admin)', path: '/admin/users', icon: UserCog, adminOnly: true },
];

export default function Sidebar() {
	const pathname = usePathname();
	const { user, logout } = useAuth();
	const { isCollapsed, toggleSidebar, isMobileOpen, setIsMobileOpen } =
		useSidebar();
	const isAdmin = Boolean(user?.is_admin || user?.role === 'admin');

	const visibleMenuItems = MENU_ITEMS.filter(
		(item) => !item.adminOnly || isAdmin,
	);

	return (
		<>
			{/* Backdrop para mobile quando a barra estiver aberta */}
			{isMobileOpen && (
				<div
					onClick={() => setIsMobileOpen(false)}
					className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40 md:hidden transition-opacity duration-300"
				/>
			)}

			<aside
				className={`fixed left-0 top-0 h-screen z-50 bg-[#0d1527]/95 border-r border-white/[0.08] backdrop-blur-md flex flex-col transition-all duration-300 ease-in-out ${
					isCollapsed ? 'w-[72px]' : 'w-64'
				} ${
					isMobileOpen
						? 'translate-x-0'
						: '-translate-x-full md:translate-x-0'
				}`}
			>
				{/* Header do Menu */}
				<div
					className={`h-16 border-b border-white/[0.08] flex items-center px-4 transition-all ${
						isCollapsed ? 'justify-center' : 'justify-between'
					}`}
				>
					{!isCollapsed ? (
						<div className="flex items-center gap-2 overflow-hidden">
							<span className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center font-black text-white text-base shadow-md shadow-blue-500/30 shrink-0">
								B
							</span>
							<h2 className="text-lg font-bold text-white tracking-tight m-0 truncate">
								Baygon <span className="text-[#60a5fa]">API</span>
							</h2>
						</div>
					) : (
						<span className="w-9 h-9 rounded-lg bg-blue-600 flex items-center justify-center font-black text-white text-lg shadow-md shadow-blue-500/30">
							B
						</span>
					)}

					{/* Botão de Retração / Expansão */}
					<button
						type="button"
						onClick={toggleSidebar}
						title={isCollapsed ? 'Expandir menu lateral' : 'Recolher menu lateral'}
						className={`hidden md:flex items-center justify-center w-8 h-8 rounded-lg border border-white/[0.1] bg-white/[0.04] hover:bg-white/[0.08] hover:border-blue-500/40 text-[#94a3b8] hover:text-white transition-colors cursor-pointer shrink-0 ${
							isCollapsed ? 'mt-2' : ''
						}`}
					>
						{isCollapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
					</button>
				</div>

				{/* Lista de Navegação */}
				<nav className="flex-1 flex flex-col gap-1.5 p-3 overflow-y-auto overflow-x-hidden">
					{visibleMenuItems.map((item) => {
						const Icon = item.icon;
						const isActive =
							pathname === item.path ||
							(item.path !== '/' && pathname.startsWith(item.path));

						return (
							<Link
								key={item.path}
								href={item.path}
								onClick={() => setIsMobileOpen(false)}
								title={isCollapsed ? item.name : undefined}
								className={`group relative flex items-center rounded-xl font-medium text-sm transition-all duration-200 cursor-pointer ${
									isCollapsed
										? 'justify-center w-11 h-11 mx-auto'
										: 'gap-3 px-3.5 py-2.5'
								} ${
									isActive
										? 'bg-blue-600/15 text-blue-400 border border-blue-500/30 font-semibold shadow-sm'
										: 'text-[#94a3b8] hover:text-white hover:bg-white/[0.05] border border-transparent'
								}`}
							>
								<Icon
									size={19}
									className={`shrink-0 transition-colors ${
										isActive
											? 'text-blue-400'
											: 'text-[#94a3b8] group-hover:text-white'
									}`}
								/>

								{!isCollapsed && (
									<span className="truncate">{item.name}</span>
								)}

								{/* Tooltip flutuante quando colapsada */}
								{isCollapsed && (
									<div className="absolute left-[calc(100%+12px)] top-1/2 -translate-y-1/2 px-2.5 py-1.5 rounded-lg bg-[#111a2e] border border-white/[0.12] text-white text-xs font-semibold whitespace-nowrap shadow-xl opacity-0 pointer-events-none group-hover:opacity-100 group-hover:pointer-events-auto transition-opacity z-50">
										{item.name}
									</div>
								)}
							</Link>
						);
					})}
				</nav>

				{/* Rodapé do Usuário */}
				<div className="p-3 border-t border-white/[0.08] flex flex-col gap-3 bg-[#0a101f]/60">
					<div
						className={`flex items-center ${
							isCollapsed ? 'justify-center' : 'gap-3'
						}`}
					>
						<div
							title={user?.username || 'Usuário'}
							className="w-10 h-10 rounded-full bg-blue-600 text-white flex items-center justify-center font-bold text-sm shadow-md shadow-blue-600/25 shrink-0"
						>
							{user?.username?.charAt(0).toUpperCase() || 'U'}
						</div>

						{!isCollapsed && (
							<div className="flex flex-col min-w-0">
								<span className="text-sm font-semibold text-white truncate max-w-[140px]">
									{user?.username || 'Usuário'}
								</span>
								<span className="text-[11px] text-[#94a3b8] capitalize">
									{user?.role || (isAdmin ? 'Admin' : 'Membro')}
								</span>
							</div>
						)}
					</div>

					<div className="flex flex-col gap-1.5">
						<Link
							href="/change-password"
							title={isCollapsed ? 'Alterar Senha' : undefined}
							onClick={() => setIsMobileOpen(false)}
							className={`group relative flex items-center rounded-lg border border-white/[0.08] bg-white/[0.02] hover:bg-white/[0.06] text-[#94a3b8] hover:text-white text-xs transition-colors cursor-pointer ${
								isCollapsed
									? 'justify-center w-10 h-10 mx-auto'
									: 'gap-2 px-3 py-2'
							}`}
						>
							<KeyRound size={15} className="shrink-0" />
							{!isCollapsed && <span>Alterar Senha</span>}
							{isCollapsed && (
								<div className="absolute left-[calc(100%+12px)] top-1/2 -translate-y-1/2 px-2.5 py-1.5 rounded-lg bg-[#111a2e] border border-white/[0.12] text-white text-xs font-semibold whitespace-nowrap shadow-xl opacity-0 pointer-events-none group-hover:opacity-100 transition-opacity z-50">
									Alterar Senha
								</div>
							)}
						</Link>

						<button
							type="button"
							onClick={logout}
							title={isCollapsed ? 'Sair' : undefined}
							className={`group relative flex items-center rounded-lg border border-rose-500/20 bg-rose-500/10 hover:bg-rose-500/20 text-rose-300 hover:text-rose-200 text-xs font-medium transition-colors cursor-pointer ${
								isCollapsed
									? 'justify-center w-10 h-10 mx-auto'
									: 'gap-2 px-3 py-2'
							}`}
						>
							<LogOut size={15} className="shrink-0" />
							{!isCollapsed && <span>Sair</span>}
							{isCollapsed && (
								<div className="absolute left-[calc(100%+12px)] top-1/2 -translate-y-1/2 px-2.5 py-1.5 rounded-lg bg-[#111a2e] border border-white/[0.12] text-rose-300 text-xs font-semibold whitespace-nowrap shadow-xl opacity-0 pointer-events-none group-hover:opacity-100 transition-opacity z-50">
									Sair
								</div>
							)}
						</button>
					</div>
				</div>
			</aside>
		</>
	);
}
