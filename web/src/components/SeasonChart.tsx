import React from 'react';
import styles from './SeasonChart.module.css';

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
  dataKey: 'total_matches' | 'total_wins' | 'total_losses' | 'total_draws' | 'total_goals' | 'total_assists';
  label: string;
  color?: string;
}

const SeasonChart: React.FC<SeasonChartProps> = ({ 
  stats, 
  dataKey, 
  label,
  color = '#3498db'
}) => {
  if (!stats || stats.length === 0) {
    return <div className={styles.noData}>Sem dados para exibir</div>;
  }

  // Encontrar o valor máximo para escalar as barras
  const maxValue = Math.max(...stats.map(s => s[dataKey] as number)) || 1;

  return (
    <div className={styles.container}>
      <h3 className={styles.title}>{label} por Temporada</h3>
      <div className={styles.chartWrapper}>
        <div className={styles.yAxis}>
          <div className={styles.yLabel}>0</div>
          <div className={styles.yLabel}>{Math.ceil(maxValue / 4)}</div>
          <div className={styles.yLabel}>{Math.ceil((maxValue / 4) * 2)}</div>
          <div className={styles.yLabel}>{Math.ceil((maxValue / 4) * 3)}</div>
          <div className={styles.yLabel}>{maxValue}</div>
        </div>
        <div className={styles.bars}>
          {stats.map((season) => {
            const value = season[dataKey] as number;
            const heightPercent = (value / maxValue) * 100;
            
            return (
              <div key={season.season_id} className={styles.bar}>
                <div className={styles.barContainer}>
                  <div
                    className={styles.barFill}
                    style={{
                      height: `${heightPercent}%`,
                      backgroundColor: color,
                    }}
                    title={`${season.season_name}: ${value}`}
                  />
                </div>
                <div className={styles.barLabel}>
                  {season.season_name ? season.season_name.substring(0, 4) : `T${season.season_id}`}
                </div>
                <div className={styles.barValue}>{value}</div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default SeasonChart;
