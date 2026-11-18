'use client';

import React, { useState, Suspense } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useTheme } from '@/context/ThemeContext';
import { useAuth } from '@/context/AuthContext';
import { Loading } from '@/components/Loading';
import {
	Trophy,
	Swords,
	Users,
	Calendar,
	Award,
	Sun,
	Moon,
	LogIn,
	LayoutDashboard,
	Menu,
	X,
	Flame,
	Share2,
} from 'lucide-react';

interface PublicLayoutProps {
	children: React.ReactNode;
}

const NAV_ITEMS = [
	{ label: 'Ranking', href: '/public', icon: Trophy },
	{ label: 'Partidas', href: '/public/matches', icon: Swords },
	{ label: 'Times', href: '/public/teams', icon: Users },
	{ label: 'Temporadas', href: '/public/seasons', icon: Calendar },
	{ label: 'Recordes', href: '/public/records', icon: Award },
];

export default function PublicLayout({ children }: PublicLayoutProps) {
	const pathname = usePathname();
	const { theme, toggleTheme } = useTheme();
	const { user } = useAuth();
	const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
	const [copied, setCopied] = useState(false);

	const handleShare = async () => {
		try {
			if (navigator.share) {
				await navigator.share({
					title: 'Baygon - Portal Público de Partidas & Ranking',
					url: window.location.href,
				});
			} else {
				await navigator.clipboard.writeText(window.location.href);
				setCopied(true);
				setTimeout(() => setCopied(false), 2000);
			}
		} catch {
			// Ignora cancelamento do share nativo
		}
	};

	const isActiveLink = (href: string) => {
		if (href === '/public') {
			return pathname === '/public';
		}
		return pathname.startsWith(href);
	};

	return (
		<div className="min-h-screen bg-background text-main flex flex-col transition-colors duration-200">
			{/* Header Público */}
			<header className="sticky top-0 z-40 w-full border-b border-border bg-surface/95 backdrop-blur-md transition-colors">
				<div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8">
					<div className="flex items-center justify-between h-16 gap-2 sm:gap-4">
						{/* Logo & Marca */}
						<div className="flex items-center gap-2 sm:gap-3 min-w-0 shrink-0">
							<Link
								href="/public"
								className="flex items-center gap-2 sm:gap-2.5 group focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary rounded-lg"
							>
								<span className="w-8 h-8 rounded-xl bg-gradient-to-br from-[#635bff] to-[#4338ca] flex items-center justify-center font-black text-white text-base shadow-sm shadow-[#635bff]/30 group-hover:scale-105 transition-transform shrink-0">
									B
								</span>
								<div className="flex flex-col min-w-0">
									<div className="flex items-center gap-1.5">
										<span className="font-bold text-main tracking-tight text-base sm:text-lg">
											Baygon
										</span>
										<span className="inline-flex items-center gap-1 text-[10px] font-semibold uppercase px-1.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 shrink-0">
											<span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
											Público
										</span>
									</div>
									<span className="text-[10px] text-muted hidden sm:inline -mt-0.5 truncate">
										Associação & Baba da Galera
									</span>
								</div>
							</Link>
						</div>

						{/* Links de navegação desktop */}
						<nav className="hidden md:flex items-center gap-1">
							{NAV_ITEMS.map((item) => {
								const Icon = item.icon;
								const active = isActiveLink(item.href);
								return (
									<Link
										key={item.href}
										href={item.href}
										className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-all ${
											active
												? 'bg-primary/10 text-primary font-semibold shadow-xs'
												: 'text-muted hover:text-main hover:bg-surface-hover'
										}`}
									>
										<Icon
											size={16}
											className={active ? 'text-primary' : 'text-muted'}
										/>
										<span>{item.label}</span>
									</Link>
								);
							})}
						</nav>

						{/* Controles da direita */}
						<div className="flex items-center gap-2">
							{/* Botão de compartilhar link */}
							<button
								type="button"
								onClick={handleShare}
								title="Compartilhar página"
								aria-label="Compartilhar página"
								className="p-2 rounded-lg border border-border bg-surface hover:bg-surface-hover text-muted hover:text-main transition-colors text-xs font-medium cursor-pointer"
							>
								<Share2 size={16} />
							</button>

							{/* Alternar tema */}
							<button
								type="button"
								onClick={toggleTheme}
								aria-label={`Alternar para tema ${theme === 'dark' ? 'claro' : 'escuro'}`}
								title={`Alternar para tema ${theme === 'dark' ? 'claro' : 'escuro'}`}
								className="p-2 rounded-lg border border-border bg-surface hover:bg-surface-hover text-muted hover:text-main transition-colors cursor-pointer"
							>
								{theme === 'dark' ? (
									<Sun size={16} className="text-amber-400" />
								) : (
									<Moon size={16} className="text-primary" />
								)}
							</button>

							{/* Botão de Área Restrita / Painel */}
							{user ? (
								<Link
									href="/"
									className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-primary text-white hover:bg-primary-hover shadow-xs transition-colors"
								>
									<LayoutDashboard size={14} />
									<span>Painel Admin</span>
								</Link>
							) : (
								<Link
									href="/login"
									className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border border-border bg-surface hover:bg-surface-hover text-main shadow-xs transition-colors"
								>
									<LogIn size={14} className="text-primary" />
									<span>Entrar</span>
								</Link>
							)}

							{/* Menu Mobile */}
							<button
								type="button"
								onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
								aria-label="Abrir menu"
								className="md:hidden p-2 rounded-lg border border-border bg-surface text-main hover:bg-surface-hover transition-colors cursor-pointer"
							>
								{mobileMenuOpen ? <X size={18} /> : <Menu size={18} />}
							</button>
						</div>
					</div>
				</div>

				{/* Dropdown Mobile */}
				{mobileMenuOpen && (
					<div className="md:hidden border-t border-border bg-surface/98 px-4 pt-3 pb-4 space-y-1 shadow-lg animate-fade-in">
						{NAV_ITEMS.map((item) => {
							const Icon = item.icon;
							const active = isActiveLink(item.href);
							return (
								<Link
									key={item.href}
									href={item.href}
									onClick={() => setMobileMenuOpen(false)}
									className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
										active
											? 'bg-primary/10 text-primary font-semibold'
											: 'text-muted hover:text-main hover:bg-surface-hover'
									}`}
								>
									<Icon
										size={18}
										className={active ? 'text-primary' : 'text-muted'}
									/>
									<span>{item.label}</span>
								</Link>
							);
						})}

						<div className="pt-3 border-t border-border flex items-center justify-between">
							{user ? (
								<Link
									href="/"
									onClick={() => setMobileMenuOpen(false)}
									className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-sm font-semibold bg-primary text-white shadow-xs"
								>
									<LayoutDashboard size={16} />
									<span>Ir para Painel Administrativo</span>
								</Link>
							) : (
								<Link
									href="/login"
									onClick={() => setMobileMenuOpen(false)}
									className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-sm font-semibold border border-border bg-surface text-main hover:bg-surface-hover"
								>
									<LogIn size={16} className="text-primary" />
									<span>Entrar (Área Restrita)</span>
								</Link>
							)}
						</div>
					</div>
				)}

				{copied && (
					<div className="absolute right-4 bottom-2 text-xs font-medium text-emerald-600 bg-emerald-500/10 border border-emerald-500/20 px-2.5 py-1 rounded-md shadow-xs animate-fade-in">
						Link copiado para a área de transferência!
					</div>
				)}
			</header>

			{/* Conteúdo da Página */}
			<main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
				<Suspense fallback={<Loading />}>
					{children}
				</Suspense>
			</main>

			{/* Rodapé Público */}
			<footer className="border-t border-border bg-surface/50 mt-auto py-8 transition-colors">
				<div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-muted text-center sm:text-left">
					<div className="flex items-center gap-2">
						<span className="w-5 h-5 rounded-md bg-primary text-white flex items-center justify-center font-bold text-[10px]">
							B
						</span>
						<span>
							&copy; {new Date().getFullYear()} Baygon Baba & Associação. Todos os direitos reservados.
						</span>
					</div>
					<div className="flex items-center gap-4 text-xs">
						<Link href="/public" className="hover:text-primary transition-colors">
							Ranking
						</Link>
						<Link href="/public/matches" className="hover:text-primary transition-colors">
							Partidas
						</Link>
						<Link href="/public/teams" className="hover:text-primary transition-colors">
							Times
						</Link>
						<Link href="/public/seasons" className="hover:text-primary transition-colors">
							Temporadas
						</Link>
						<Link href="/login" className="hover:text-primary transition-colors font-medium">
							Área Administrativa
						</Link>
					</div>
				</div>
			</footer>
		</div>
	);
}
