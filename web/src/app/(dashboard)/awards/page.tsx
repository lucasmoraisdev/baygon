'use client';

import { useQuery } from '@tanstack/react-query';
import { fetchAPI } from '@/lib/api';
import { Loading } from '@/components/Loading';

export default function AwardsPage() {
	const { data: awards = [], isLoading, isError } = useQuery<any[]>({
		queryKey: ['awards', 'round', 1],
		queryFn: () => fetchAPI('/awards/round/1').catch(() => []),
	});

	if (isLoading) return <Loading />;
	if (isError)
		return <div className="text-red-500 p-4">Erro ao carregar prêmios.</div>;

	return (
		<div className="flex flex-col gap-6 animate-slide-down">
			<div>
				<h1 className="text-3xl text-main">Galeria de Prêmios</h1>
				<p className="text-sm text-muted mt-1">Conquistas distribuídas durante a temporada.</p>
			</div>

			{awards.length === 0 ? (
				<div className="bg-surface border border-border rounded-xl p-6 text-muted text-sm">
					Nenhum prêmio distribuído ainda.
				</div>
			) : (
				<div className="grid grid-cols-[repeat(auto-fill,minmax(240px,1fr))] gap-4">
					{awards.map((a) => (
						<div key={a.id_award} className="bg-surface border border-border rounded-xl p-5">
							<div className="flex items-center gap-2 mb-3">
								<span className="text-xs text-primary font-semibold bg-primary/10 px-2 py-1 rounded-full">
									Prêmio #{a.id_award}
								</span>
							</div>
							<h2 className="text-base font-semibold text-main mb-2">{a.event_type}</h2>
							<p className="text-sm text-muted">
								Rodada associada: <strong>{a.round_id}</strong>
							</p>
						</div>
					))}
				</div>
			)}
		</div>
	);
}
