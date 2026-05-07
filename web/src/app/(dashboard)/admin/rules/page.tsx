'use client';

import { Button } from '@/components/Button';
import { Loading } from '@/components/Loading';
import { fetchAPI } from '@/lib/api';
import { useQuery } from '@tanstack/react-query';

export default function RulesPage() {
	const {
		data: rules = [],
		isLoading,
		isError,
	} = useQuery<any[]>({
		queryKey: ['rules', 'season', 1],
		queryFn: () => fetchAPI('/rules/season/1').catch(() => []),
	});

	if (isLoading) return <Loading />;
	if (isError)
		return <div className="text-red-500 p-4">Erro ao carregar regras.</div>;

	return (
		<div className="flex flex-col gap-6 animate-slide-down">
			<div className="flex items-center justify-between">
				<h1 className="text-3xl text-main">
					Configuração de Regras (Admin)
				</h1>
				<Button
					onClick={() => alert('Criar regra (Em breve)')}
					className="w-60!"
				>
					Nova Regra
				</Button>
			</div>

			{rules.length === 0 ? (
				<div className="bg-surface border border-border rounded-xl p-6 text-muted text-sm">
					Nenhuma regra configurada ainda.
				</div>
			) : (
				<div className="flex flex-col gap-3">
					{rules.map((r) => (
						<div
							key={r.id_event_score_rule}
							className="bg-surface border border-border rounded-xl p-4 flex items-center justify-between gap-4"
						>
							<strong className="text-main text-sm">
								{r.event_type} no contexto {r.context}
							</strong>
							<div className="flex items-center gap-3 shrink-0">
								<span className="text-sm text-primary font-semibold">
									{r.points} Pontos
								</span>
								<Button
									size="sm"
									variant="ghost"
									onClick={() => alert('Editar')}
								>
									Editar
								</Button>
							</div>
						</div>
					))}
				</div>
			)}
		</div>
	);
}
