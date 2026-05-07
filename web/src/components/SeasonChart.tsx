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
  dataKey: "total_matches" | "total_wins" | "total_losses" | "total_draws" | "total_goals" | "total_assists";
  label: string;
  color?: string;
}

export default function SeasonChart({
  stats,
  dataKey,
  label,
  color = "#3498db",
}: SeasonChartProps) {
  if (!stats || stats.length === 0) {
    return (
      <p className="py-6 text-center text-muted bg-black/20 rounded">
        Sem dados para exibir
      </p>
    );
  }

  const maxValue = Math.max(...stats.map((s) => s[dataKey])) || 1;
  const yLabels = [
    maxValue,
    Math.ceil((maxValue / 4) * 3),
    Math.ceil((maxValue / 4) * 2),
    Math.ceil(maxValue / 4),
    0,
  ];

  return (
    <div className="p-4 bg-surface border border-border rounded-lg">
      <h3 className="text-base font-semibold text-main mb-4">
        {label} por Temporada
      </h3>

      <div className="flex gap-3 h-75 bg-black/20 rounded p-3">
        <div className="flex flex-col justify-between w-10 pr-2 border-r border-white/10">
          {yLabels.map((v, i) => (
            <span key={i} className="text-xs text-muted text-right font-medium">
              {v}
            </span>
          ))}
        </div>

        <div className="flex items-end gap-4 flex-1 px-2 overflow-x-auto">
          {stats.map((season) => {
            const value = season[dataKey];
            const heightPercent = (value / maxValue) * 100;

            return (
              <div
                key={season.season_id}
                className="flex flex-col items-center gap-2 flex-[0_0_auto] min-w-12"
              >
                <div className="h-full w-10 bg-white/5 rounded overflow-hidden flex items-end border border-white/10">
                  <div
                    className="w-full rounded-sm transition-all duration-300 min-h-0.5 hover:opacity-80 hover:brightness-125"
                    style={{ height: `${heightPercent}%`, backgroundColor: color }}
                    title={`${season.season_name}: ${value}`}
                  />
                </div>
                <span className="text-xs text-gray-300 font-medium text-center whitespace-nowrap max-w-12 overflow-hidden text-ellipsis">
                  {season.season_name ? season.season_name.substring(0, 4) : `T${season.season_id}`}
                </span>
                <span className="text-[13px] font-semibold text-emerald-500 min-h-4.5">
                  {value}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
