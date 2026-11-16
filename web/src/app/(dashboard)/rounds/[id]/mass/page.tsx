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
			<div className="w-full max-w-4xl mx-auto p-6 text-center text-[#94a3b8]">
				<p className="text-base font-semibold text-rose-400">
					Acesso restrito para administradores.
				</p>
				<Link
					href={`/rounds/${params.id}`}
					className="inline-flex items-center gap-2 mt-4 text-sm text-blue-400 hover:underline"
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
		<div className="w-full max-w-[1300px] mx-auto flex flex-col gap-6">
			{/* Top Bar Navigation */}
			<div className="flex items-center justify-between gap-4 w-full">
				<Link
					href={`/rounds/${params.id}`}
					className="inline-flex items-center gap-2 px-4 py-2.5 rounded-[12px] bg-[#111a2e] hover:bg-[#16233f] border border-white/[0.1] text-sm font-semibold text-[#e6edf7] shadow-sm hover:border-blue-500/40 transition-colors"
				>
					<ArrowLeft size={16} />
					<span>Voltar para a Rodada</span>
				</Link>

				<div className="flex items-center gap-3">
					{roundDateFormatted && (
						<span className="hidden sm:inline-flex items-center gap-1.5 text-xs text-[#94a3b8] px-3 py-1.5 rounded-full bg-white/[0.04] border border-white/[0.07]">
							<Calendar size={13} />
							{roundDateFormatted}
						</span>
					)}
					{round?.location && (
						<span className="hidden md:inline-flex items-center gap-1.5 text-xs text-[#94a3b8] px-3 py-1.5 rounded-full bg-white/[0.04] border border-white/[0.07]">
							<MapPin size={13} />
							{round.location}
						</span>
					)}
					<span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400">
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
