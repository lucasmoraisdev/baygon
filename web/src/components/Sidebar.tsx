'use client';
import { Button } from '@/components/Button';
import { useAuth } from '@/context/AuthContext';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

const MENU_ITEMS = [
	{ name: 'Dashboard', path: '/' },
	{ name: 'Temporadas', path: '/seasons' },
	{ name: 'Times', path: '/teams' },
	{ name: 'Jogadores', path: '/players' },
	{ name: 'Partidas', path: '/matches' },
	{ name: 'Prêmios (Awards)', path: '/awards' },
	{ name: 'Regras (Admin)', path: '/admin/rules' },
];

export default function Sidebar() {
	const pathname = usePathname();
	const { user, logout } = useAuth();

	return (
		<aside className="w-64 bg-background/85 border-r border-r-border flex flex-col h-screen fixed left-0 top-0 backdrop-blur-md">
			<div className="p-4 border-b border-b-border">
				<h2 className="text-xl text-main tracking-[-0.5px]">
					Baygon <span className="text-primary">API</span>
				</h2>
			</div>

			<nav className="flex-1 flex flex-col gap-1 overflow-y-auto ">
				{MENU_ITEMS.map((item) => {
					const isActive =
						pathname === item.path ||
						(item.path !== '/' && pathname.startsWith(item.path));
					return (
						<Link
							key={item.path}
							href={item.path}
							className={
								'px-6 py-2 text-[15px] font-medium transition-all duration-200 border-[3px] hover:text-main hover:bg-nav-hover' +
								(isActive
									? ' bg-primary/5 text-main border-l-primary/50 border-transparent'
									: ' text-muted border-transparent')
							}
						>
							{item.name}
						</Link>
					);
				})}
			</nav>

			<div className="p-4 border-t border-t-border flex flex-col gap-4">
				<div className="flex items-center gap-3">
					<div className="w-9 h-9 rounded-[50%] bg-primary text-white flex items-center justify-center font-semibold text-base">
						{user?.username?.charAt(0).toUpperCase() || 'U'}
					</div>
					<div className="flex flex-col">
						<span className="text-sm font-semibold whitespace-nowrap text-white overflow-hidden text-ellipsis max-w-35">
							{user?.username || 'Usuário'}
						</span>
						<span className="text-[12px] text-muted capitalize">
							{user?.role || 'Admin'}
						</span>
					</div>
				</div>
				<Button variant="danger" onClick={logout}>
					Sair
				</Button>
			</div>
		</aside>
	);
}
