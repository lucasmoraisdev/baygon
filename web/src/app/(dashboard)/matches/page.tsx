"use client";
import { useEffect, useState } from "react";
import { fetchAPI } from "@/lib/api";
import Link from "next/link";
import styles from "./matches.module.css";

export default function MatchesPage() {
  const [seasons, setSeasons] = useState<any[]>([]);
  const [selectedSeason, setSelectedSeason] = useState<string>("");
  const [matches, setMatches] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchAPI("/seasons/")
      .then(res => {
        setSeasons(res);
        if(res.length > 0) setSelectedSeason(res[0].id_season.toString());
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (selectedSeason) {
      fetchAPI(`/matches/season/${selectedSeason}`)
        .then(setMatches)
        .catch(console.error);
    }
  }, [selectedSeason]);

  if (loading) return <div style={{ color: 'var(--text-muted)' }}>Carregando radar de partidas...</div>;

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h1>Central de Partidas</h1>
        <select 
          value={selectedSeason} 
          onChange={(e) => setSelectedSeason(e.target.value)}
          className={styles.select}
        >
          {seasons.map(s => (
            <option key={s.id_season} value={s.id_season}>Temporada {s.number}</option>
          ))}
        </select>
      </div>

      <div className={styles.grid}>
        {matches.length === 0 && <p style={{ color: 'var(--text-muted)' }}>Nenhuma partida encontrada nesta temporada.</p>}
        {matches.map(m => (
          <Link href={`/matches/${m.id}`} key={m.id} className={styles.matchCard}>
            <div className={styles.teamsRow}>
              <div className={styles.team}>T{m.home_team_id}</div>
              <div className={styles.scoreBoard}>
                <span>{m.home_score}</span>
                <span className={styles.divider}>x</span>
                <span>{m.away_score}</span>
              </div>
              <div className={styles.team}>T{m.away_team_id}</div>
            </div>
            <div className={styles.meta}>
              <span>Rodada {m.round_id}</span>
              <span className={styles.liveBadge}>Acompanhar Match</span>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
