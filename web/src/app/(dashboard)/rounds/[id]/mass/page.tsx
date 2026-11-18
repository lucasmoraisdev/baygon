'use client';

import { Loading } from '@/components/Loading';
import { MassMatchRegistration } from '@/components/MassMatchRegistration';
import { useAuth } from '@/context/AuthContext';
import { fetchAPI } from '@/lib/api';
import { Round } from '@/types/types';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, Calendar, MapPin, Zap } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

export default function MassMatchPage({ params }: { params: { id: string } }) {
	const router = useRouter();
	const { user } = useAuth();
	const isAdmin = Boolean(user?.is_admin || user?.role === 'admin');

	const { data: round, isLoading } = useQuery<Round>({
		queryKey: ['round', params.id],
		queryFn: () => fetchAPI(`/rounds/${params.id}`),
	});

	if (isLoading) return <Loading />;

	if (!isAdmin) {
		return (
			<div className="w-full max-w-4xl mx-auto p-6 text-center text-muted">
				<p className="text-base font-semibold text-rose-500 dark:text-rose-400">
					Acesso restrito para administradores.
				</p>
				<Link
					href={`/rounds/${params.id}`}
					className="inline-flex items-center gap-2 mt-4 text-sm text-primary hover:underline"
				>
					<ArrowLeft size={16} /> Voltar para a rodada
				</Link>
			</div>
		);
	}

	const roundDateFormatted = round?.date
		? new Date(round.date).toLocaleDateString('pt-BR')
		: '';

	return (
		<div className="w-full max-w-[1300px] mx-auto flex flex-col gap-6 text-main">
			{/* Top Bar Navigation */}
			<div className="flex items-center justify-between gap-4 w-full">
				<Link
					href={`/rounds/${params.id}`}
					className="inline-flex items-center gap-2 px-4 py-2.5 rounded-[12px] bg-surface hover:bg-nav-hover border border-border text-sm font-semibold text-main shadow-sm hover:border-primary transition-colors"
				>
					<ArrowLeft size={16} />
					<span>Voltar para a Rodada</span>
				</Link>

				<div className="flex items-center gap-3">
					{roundDateFormatted && (
						<span className="hidden sm:inline-flex items-center gap-1.5 text-xs text-muted px-3 py-1.5 rounded-full bg-surface border border-border">
							<Calendar size={13} />
							{roundDateFormatted}
						</span>
					)}
					{round?.location && (
						<span className="hidden md:inline-flex items-center gap-1.5 text-xs text-muted px-3 py-1.5 rounded-full bg-surface border border-border">
							<MapPin size={13} />
							{round.location}
						</span>
					)}
					<span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-600 dark:text-emerald-400">
						Modo Admin
					</span>
				</div>
			</div>

			{/* Main Mass Match Component */}
			<MassMatchRegistration
				roundId={params.id}
				onClose={() => router.push(`/rounds/${params.id}`)}
				onSuccess={() => {
					router.push(`/rounds/${params.id}`);
				}}
			/>
		</div>
	);
}
