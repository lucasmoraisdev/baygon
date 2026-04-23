"use client";
import { useEffect, useState, useCallback } from "react";
import { fetchAPI } from "@/lib/api";
import styles from "../matches.module.css";

export default function LiveMatch({ params }: { params: { id: string } }) {
  const [match, setMatch] = useState<any>(null);
  const [events, setEvents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const loadData = useCallback(async () => {
    try {
      const [m, evts] = await Promise.all([
        fetchAPI(`/matches/${params.id}`),
        fetchAPI(`/events/match/${params.id}`)
      ]);
      setMatch(m);
      setEvents(evts);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [params.id]);

  useEffect(() => {
    loadData();
    const interval = setInterval(loadData, 5000);
    return () => clearInterval(interval);
  }, [loadData]);

  const handleRegisterEvent = async (type: string, teamId: number) => {
    const playerId = Math.floor(Math.random() * 10) + 1; // dummy select player for now
    try {
      await fetchAPI("/events/", {
        method: "POST",
        body: JSON.stringify({
          match_id: parseInt(params.id),
          event_type: type,
          player_id: playerId
        })
      });
      
      if (type === "GOL") {
         const updates = parseInt(teamId as any) === match.home_team_id 
             ? { home_score: match.home_score + 1 }
             : { away_score: match.away_score + 1 };
             
         await fetchAPI(`/matches/${params.id}`, {
            method: "PUT",
            body: JSON.stringify(updates)
         });
      }
      loadData();
    } catch(err) {
      console.error(err);
    }
  };

  if (loading && !match) return <div style={{ color: 'var(--text-muted)' }}>Conectando ao gramado...</div>;
  if (!match) return <div>Partida não encontrada.</div>;

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h1>Cobertura ao Vivo</h1>
        <div style={{ display: 'flex', gap: '16px', alignItems: 'center' }}>
            <div className={styles.liveIndicator}></div>
            <span style={{ fontSize: '13px', color: 'var(--text-muted)', fontWeight: 600 }}>Em andamento</span>
        </div>
      </div>

      <div className={styles.liveScoreboard}>
        <div className={styles.teamColumn}>
          <h2>Time {match.home_team_id}</h2>
          <div className={styles.scoreBig}>{match.home_score}</div>
          <div className={styles.eventActions}>
            <button onClick={() => handleRegisterEvent("GOL", match.home_team_id)} className={styles.btnActionGoal}>⚽ Gol</button>
            <button onClick={() => handleRegisterEvent("CARTAO_AMARELO", match.home_team_id)} className={styles.btnActionYellow}>🟨 Amarelo</button>
            <button onClick={() => handleRegisterEvent("CARTAO_VERMELHO", match.home_team_id)} className={styles.btnActionRed}>🟥 Vermelho</button>
          </div>
        </div>

        <div className={styles.vs}>VS</div>

        <div className={styles.teamColumn}>
          <h2>Time {match.away_team_id}</h2>
          <div className={styles.scoreBig}>{match.away_score}</div>
          <div className={styles.eventActions}>
            <button onClick={() => handleRegisterEvent("GOL", match.away_team_id)} className={styles.btnActionGoal}>⚽ Gol</button>
            <button onClick={() => handleRegisterEvent("CARTAO_AMARELO", match.away_team_id)} className={styles.btnActionYellow}>🟨 Amarelo</button>
            <button onClick={() => handleRegisterEvent("CARTAO_VERMELHO", match.away_team_id)} className={styles.btnActionRed}>🟥 Vermelho</button>
          </div>
        </div>
      </div>

      <div className={styles.timeline}>
        <h3>Timeline da Partida ({events.length})</h3>
        <div className={styles.timelineList}>
          {events.length === 0 && <p className={styles.textMuted}>Nenhum evento registrado ainda.</p>}
          {events.map((evt, idx) => (
             <div key={evt.id_match_event || idx} className={styles.timelineItem}>
                <span className={styles.eventType}>{evt.event_type}</span>
                <span className={styles.eventPlayer}>Jogador #{evt.player_id} envolvido</span>
             </div>
          ))}
        </div>
      </div>
    </div>
  );
}
