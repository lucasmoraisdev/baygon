"use client";

import { useEffect, useState, useCallback } from "react";
import { fetchAPI } from "@/lib/api";
import styles from "../../seasons/seasons.module.css";
import Link from "next/link";

export default function RoundDetail({ params }: { params: { id: string } }) {
  const [round, setRound] = useState<any>(null);
  const [teams, setTeams] = useState<any[]>([]);
  const [matches, setMatches] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const loadData = useCallback(async () => {
    try {
      const [roundData, teamsData, matchesData] = await Promise.all([
        fetchAPI(`/rounds/${params.id}`),
        fetchAPI(`/teams/round/${params.id}`),
        fetchAPI(`/matches/round/${params.id}`)
      ]);
      setRound(roundData);
      setTeams(teamsData);
      setMatches(matchesData);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [params.id]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  if (loading) return <div>Carregando...</div>;
  if (!round) return <div>Rodada não encontrada.</div>;

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <div>
          <h1>Rodada {round.round_number}</h1>
          <p style={{ color: 'var(--text-muted)' }}>Data: {new Date(round.date).toLocaleDateString("pt-BR")}</p>
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button className={styles.primaryBtn} onClick={() => alert("Adicionar Time")}>+ Time</button>
          <button className={styles.primaryBtn} onClick={() => alert("Nova Partida")}>+ Partida</button>
        </div>
      </div>

      <div style={{ display: 'flex', gap: '20px', flexWrap: 'wrap' }}>
        <div style={{ flex: '1 1 300px' }}>
          <h3>Times Participantes ({teams.length})</h3>
          <ul style={{ background: 'var(--bg-surface)', padding: '16px', borderRadius: '8px', listStyle: 'none', margin: 0 }}>
            {teams.length === 0 && <li style={{ color: 'var(--text-muted)' }}>Nenhum time registrado.</li>}
            {teams.map(t => (
              <li key={t.id_team} style={{ padding: '8px 0', borderBottom: '1px solid var(--border-color)' }}>
                {t.name}
              </li>
            ))}
          </ul>
        </div>
        <div style={{ flex: '2 1 400px' }}>
          <h3>Partidas ({matches.length})</h3>
          <div className={styles.grid} style={{ gridTemplateColumns: '1fr', gap: '12px' }}>
            {matches.length === 0 && <p style={{ color: 'var(--text-muted)' }}>Nenhuma partida criada.</p>}
            {matches.map(m => (
              <Link key={m.id} href={`/matches/${m.id}`} className={styles.card} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ fontWeight: 600 }}>T{m.home_team_id} vs T{m.away_team_id}</div>
                <div className={styles.badge} style={{ fontSize: '18px', padding: '6px 12px' }}>
                  {m.home_score} x {m.away_score}
                </div>
              </Link>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
