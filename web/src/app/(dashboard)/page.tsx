"use client";

import { useEffect, useState } from "react";
import { fetchAPI } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import styles from "./dashboard.module.css";

export default function DashboardPage() {
  const { user } = useAuth();
  const [stats, setStats] = useState({ matches: 0, goals: 0, players: 0 });
  const [rankings, setRankings] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      fetchAPI("/rankings/"),
      fetchAPI("/players/"),
      fetchAPI("/matches/")
    ]).then(([ranks, players, matches]) => {
      setRankings(ranks || []);
      setStats({
        players: (players || []).length,
        matches: (matches || []).length,
        goals: 0
      });
    }).catch(console.error).finally(() => setLoading(false));
  }, []);

  if (loading) return <div style={{ color: 'var(--text-muted)' }}>Carregando dashboard...</div>;

  return (
    <div className={styles.container}>
      <div className={styles.welcome}>
        <h1>Olá, {user?.username} 👋</h1>
        <p>Aqui está o resumo do desempenho no Baygon.</p>
      </div>

      <div className={styles.statsGrid}>
        <div className={styles.statCard}>
          <h3>Jogadores Ativos</h3>
          <div className={styles.statValue}>{stats.players}</div>
        </div>
        <div className={styles.statCard}>
          <h3>Partidas Realizadas</h3>
          <div className={styles.statValue}>{stats.matches}</div>
        </div>
      </div>

      <div className={styles.section}>
        <div className={styles.sectionHeader}>
          <h2>🔥 Top Ranking Global</h2>
        </div>
        <div className={styles.rankingTable}>
          <div className={styles.tableHeader}>
            <span>Posição</span>
            <span>Jogador</span>
            <span>Pontos</span>
          </div>
          {rankings.length === 0 && <div className={styles.empty}>Nenhum dado na tabela de classificação ainda.</div>}
          {rankings.slice(0, 10).map((r, i) => (
             <div key={r.id_player_score || i} className={styles.tableRow}>
                <span className={styles.rankBadge}>#{i + 1}</span>
                <span>Jogador #{r.player_id}</span>
                <span className={styles.points}>{r.points} pts</span>
             </div>
          ))}
        </div>
      </div>
    </div>
  );
}
