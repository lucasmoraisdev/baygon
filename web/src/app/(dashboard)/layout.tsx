'use client';

import { Loading } from '@/components/Loading';
import Sidebar from '@/components/Sidebar';
import { useAuth } from '@/context/AuthContext';
import { SidebarProvider, useSidebar } from '@/context/SidebarContext';
import { Menu } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

function DashboardShell({ children }: { children: React.ReactNode }) {
	const { isCollapsed, toggleMobileSidebar } = useSidebar();

	return (
		<div className="min-h-screen bg-[#070b14] flex flex-col">
			{/* Barra superior móvel com botão de menu */}
			<header className="h-14 md:hidden border-b border-white/[0.08] bg-[#0d1527]/90 px-4 flex items-center justify-between sticky top-0 z-30 backdrop-blur-md">
				<div className="flex items-center gap-2">
					<span className="w-7 h-7 rounded-lg bg-blue-600 flex items-center justify-center font-black text-white text-sm shadow-md shadow-blue-500/30">
						B
					</span>
					<span className="font-bold text-white tracking-tight">Baygon API</span>
				</div>
				<button
					type="button"
					onClick={toggleMobileSidebar}
					aria-label="Abrir menu"
					className="p-2 rounded-lg bg-white/[0.05] border border-white/[0.1] text-white hover:bg-white/[0.1] transition-colors cursor-pointer"
				>
					<Menu size={18} />
				</button>
			</header>

			<div className="flex flex-1 relative">
				<Sidebar />

				<main
					className={`flex-1 min-w-0 transition-all duration-300 ease-in-out p-4 sm:p-6 lg:p-8 ${
						isCollapsed ? 'md:ml-[72px]' : 'md:ml-64'
					}`}
				>
					<div className="w-full max-w-[1700px] mx-auto animate-fade-in">
						{children}
					</div>
				</main>
			</div>
		</div>
	);
}

export default function DashboardLayout({
	children,
}: {
	children: React.ReactNode;
}) {
	const { user, loading } = useAuth();
	const router = useRouter();

	useEffect(() => {
		if (!loading && !user) {
			router.push('/login');
		}
	}, [user, loading, router]);

	if (loading || !user) {
		return <Loading />;
	}

	return (
		<SidebarProvider>
			<DashboardShell>{children}</DashboardShell>
		</SidebarProvider>
	);
}
