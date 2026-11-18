'use client';

import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { fetchAPI } from '@/lib/api';
import { Loading } from '@/components/Loading';
import Link from 'next/link';
import {
	Calendar,
	Sparkles,
	Clock,
	CheckCircle,
	ArrowRight,
	Trophy,
	ChevronRight,
} from 'lucide-react';

interface SeasonItem {
	id_season: number;
	number: number;
	description?: string | null;
	start_date?: string | null;
	end_date?: string | null;
	initial_date?: string | null;
	is_active: boolean;
}

export default function PublicSeasonsPage() {
	const seasonsQuery = useQuery<SeasonItem[]>({
		queryKey: ['public-seasons-timeline'],
		queryFn: () => fetchAPI('/seasons/').catch(() => []),
	});

	const seasons = seasonsQuery.data ?? [];

	// Separar a temporada ativa das temporadas anteriores
	const activeSeason = seasons.find((s) => s.is_active);
	const pastSeasons = seasons
		.filter((s) => s.id_season !== activeSeason?.id_season)
		.sort((a, b) => b.number - a.number);

	const formatDate = (d?: string | null) => {
		if (!d) return 'Não informada';
		try {
			const date = new Date(d);
			if (isNaN(date.getTime())) return d;
			return date.toLocaleDateString('pt-BR');
		} catch {
			return d;
		}
	};

	return (
		<div className="space-y-6">
			{/* Top Bar */}
			<div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-border">
				<div>
					<div className="flex items-center gap-2">
						<span className="p-2 rounded-xl bg-indigo-500/10 text-indigo-500 border border-indigo-500/20">
							<Calendar size={22} />
						</span>
						<div>
							<h1 className="text-xl sm:text-2xl font-bold text-main tracking-tight">
								Temporadas & Histórico
							</h1>
							<p className="text-xs sm:text-sm text-muted">
								Histórico de edições, períodos de disputa e temporadas ativas do Baygon
							</p>
						</div>
					</div>
				</div>
			</div>

			{seasonsQuery.isLoading ? (
				<div className="py-12">
					<Loading />
				</div>
			) : seasons.length === 0 ? (
				<div className="bg-surface border border-border rounded-xl p-10 text-center text-muted text-sm">
					Nenhuma temporada cadastrada.
				</div>
			) : (
				<div className="space-y-8">
					{/* Temporada Atual em Destaque */}
					{activeSeason && (
						<div className="bg-gradient-to-br from-primary/10 via-surface to-surface border-2 border-primary/30 rounded-2xl p-6 sm:p-8 shadow-sm">
							<div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
								<div className="space-y-3">
									<div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 text-xs font-bold uppercase tracking-wider">
										<span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
										Temporada Atual em Andamento
									</div>

									<h2 className="text-2xl sm:text-3xl font-extrabold text-main tracking-tight">
										Temporada {activeSeason.number}
									</h2>

									{activeSeason.description && (
										<p className="text-sm text-muted max-w-xl">
											{activeSeason.description}
										</p>
									)}

									<div className="flex flex-wrap items-center gap-4 text-xs text-muted pt-2">
										<div className="flex items-center gap-1.5">
											<Calendar size={14} className="text-primary" />
											<span>
												Início:{' '}
												<strong className="text-main">
													{formatDate(activeSeason.start_date || activeSeason.initial_date)}
												</strong>
											</span>
										</div>
										<div className="flex items-center gap-1.5">
											<Clock size={14} className="text-primary" />
											<span>
												Término previsto:{' '}
												<strong className="text-main">
													{formatDate(activeSeason.end_date)}
												</strong>
											</span>
										</div>
									</div>
								</div>

								<div className="flex flex-col sm:flex-row gap-3">
									<Link
										href={`/public?temporada=${activeSeason.id_season}`}
										className="inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl bg-primary text-white font-semibold text-sm hover:bg-primary-hover shadow-md transition-all"
									>
										<Trophy size={16} />
										<span>Ver Ranking da Temporada</span>
										<ArrowRight size={16} />
									</Link>
									<Link
										href={`/public/matches?temporada=${activeSeason.id_season}`}
										className="inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl bg-surface border border-border text-main font-semibold text-sm hover:bg-surface-hover shadow-xs transition-all"
									>
										<span>Ver Partidas</span>
									</Link>
								</div>
							</div>
						</div>
					)}

					{/* Temporadas Históricas */}
					<div className="space-y-4">
						<div className="flex items-center justify-between">
							<h3 className="text-base sm:text-lg font-bold text-main">
								Edições Anteriores ({pastSeasons.length})
							</h3>
							<span className="text-xs text-muted">Arquivo histórico</span>
						</div>

						{pastSeasons.length === 0 ? (
							<div className="p-6 bg-surface border border-border rounded-xl text-center text-xs text-muted">
								Ainda não há temporadas finalizadas arquivadas.
							</div>
						) : (
							<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
								{pastSeasons.map((s) => (
									<Link
										key={s.id_season}
										href={`/public?temporada=${s.id_season}`}
										className="group bg-surface border border-border rounded-xl p-5 hover:border-primary/60 hover:shadow-sm transition-all flex flex-col justify-between gap-4"
									>
										<div className="space-y-2">
											<div className="flex items-center justify-between">
												<span className="text-xs font-bold uppercase tracking-wider text-muted">
													Edição #{s.number}
												</span>
												<span className="inline-flex items-center gap-1 text-[10px] font-semibold text-muted bg-surface-hover px-2 py-0.5 rounded border border-border">
													<CheckCircle size={10} className="text-slate-400" />
													Encerrada
												</span>
											</div>

											<h4 className="text-lg font-bold text-main group-hover:text-primary transition-colors">
												Temporada {s.number}
											</h4>

											{s.description && (
												<p className="text-xs text-muted line-clamp-2">
													{s.description}
												</p>
											)}
										</div>

										<div className="pt-3 border-t border-border flex items-center justify-between text-xs text-muted">
											<span>
												{formatDate(s.start_date || s.initial_date)} —{' '}
												{formatDate(s.end_date)}
											</span>
											<span className="text-primary font-semibold flex items-center gap-0.5 group-hover:translate-x-1 transition-transform">
												Ver dados <ChevronRight size={14} />
											</span>
										</div>
									</Link>
								))}
							</div>
						)}
					</div>
				</div>
			)}
		</div>
	);
}
