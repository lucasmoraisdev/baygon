'use client';

import { Loading } from '@/components/Loading';
import Sidebar from '@/components/Sidebar';
import { useAuth } from '@/context/AuthContext';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

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
		<div className="flex min-h-screen">
			<Sidebar />
			<main className="flex-1 ml-64 p-6">
				<div className="max-w-6xl m-auto w-full animate-fade-in">
					{children}
				</div>
			</main>
		</div>
	);
}
