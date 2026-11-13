interface SeasonStats {
	season_id: number;
	season_name: string;
	total_matches: number;
	total_wins: number;
	total_losses: number;
	total_draws: number;
	total_goals: number;
	total_assists: number;
	total_points: number;
}

interface SeasonChartProps {
	stats: SeasonStats[];
	dataKey:
		| 'total_matches'
		| 'total_wins'
		| 'total_losses'
		| 'total_draws'
		| 'total_goals'
		| 'total_assists';
	label: string;
	color?: string;
}

export default function SeasonChart({
	stats,
	dataKey,
	label,
	color = '#3b82f6',
}: SeasonChartProps) {
	if (!stats || stats.length === 0) {
		return (
			<p className="py-6 text-center text-xs text-muted bg-background/40 rounded-lg border border-border">
				Sem dados para exibir
			</p>
		);
	}

	const maxValue = Math.max(...stats.map((s) => s[dataKey])) || 1;
	const yLabels = [
		maxValue,
		Math.ceil(maxValue / 2),
		0,
	];

	return (
		<div className="p-3.5 bg-background/40 border border-border rounded-xl">
			<div className="flex items-center justify-between mb-2.5">
				<h3 className="text-xs font-semibold uppercase tracking-wider text-muted">
					{label} por Temporada
				</h3>
				<span className="text-xs font-bold text-main">
					Total: {stats.reduce((acc, s) => acc + s[dataKey], 0)}
				</span>
			</div>

			<div className="flex gap-2.5 h-36 bg-background/60 rounded-lg p-2.5 border border-border/60">
				<div className="flex flex-col justify-between w-7 pr-1.5 border-r border-white/10">
					{yLabels.map((v, i) => (
						<span
							key={i}
							className="text-[10px] text-muted text-right font-medium"
						>
							{v}
						</span>
					))}
				</div>

				<div className="flex items-end gap-3 flex-1 px-1 overflow-x-auto">
					{stats.map((season) => {
						const value = season[dataKey];
						const heightPercent = Math.max(
							(value / maxValue) * 100,
							value > 0 ? 8 : 2,
						);

						return (
							<div
								key={season.season_id}
								className="flex flex-col items-center gap-1 flex-[0_0_auto] min-w-10 h-full justify-end"
							>
								<span className="text-[11px] font-bold text-main">
									{value}
								</span>
								<div className="h-20 w-7 bg-white/5 rounded-md overflow-hidden flex items-end border border-white/10">
									<div
										className="w-full rounded-t-sm transition-all duration-300 hover:brightness-125"
										style={{
											height: `${heightPercent}%`,
											backgroundColor: color,
										}}
										title={`${season.season_name}: ${value}`}
									/>
								</div>
								<span className="text-[10px] text-muted font-medium text-center whitespace-nowrap max-w-12 overflow-hidden text-ellipsis">
									{season.season_name
										? season.season_name.replace(
												/Temporada\s*/i,
												'T',
											)
										: `T${season.season_id}`}
								</span>
							</div>
						);
					})}
				</div>
			</div>
		</div>
	);
}
