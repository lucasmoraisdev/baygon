"use client";
import { useEffect, useState } from "react";
import { fetchAPI } from "@/lib/api";
import styles from "../seasons/seasons.module.css"; 

export default function AwardsPage() {
  const [awards, setAwards] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchAPI("/awards/round/1") 
      .then(res => setAwards(res))
      .catch((e) => {
          console.log("No global endpoint, showing empty or mocked data", e);
          setAwards([]);
      })
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div>Carregando troféus...</div>;

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <div>
           <h1>Galeria de Prêmios 🏆</h1>
           <p style={{ margin: '8px 0 0', color: 'var(--text-muted)' }}>Conquistas distribuídas durante a temporada.</p>
        </div>
      </div>

      <div className={styles.grid}>
        {awards.length === 0 && <p style={{ color: 'var(--text-muted)' }}>Nenhum prêmio distribuído ainda.</p>}
        {awards.map(a => (
          <div key={a.id_award} className={styles.card}>
            <div className={styles.cardHeader}>
              <span className={styles.badge}>Prêmio #{a.id_award}</span>
              <h2>{a.event_type}</h2>
            </div>
            <div className={styles.cardBody}>
              <p>Rodada associada: <strong>{a.round_id}</strong></p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
