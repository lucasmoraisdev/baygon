"use client";

import { useEffect, useState, useCallback } from "react";
import { fetchAPI } from "@/lib/api";
import Link from "next/link";
import styles from "../seasons.module.css";

export default function SeasonDetail({ params }: { params: { id: string } }) {
  const [season, setSeason] = useState<any>(null);
  const [rounds, setRounds] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const loadData = useCallback(async () => {
    try {
      const [seasonData, roundsData] = await Promise.all([
        fetchAPI(`/seasons/${params.id}`),
        fetchAPI(`/rounds/season/${params.id}`)
      ]);
      setSeason(seasonData);
      setRounds(roundsData);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [params.id]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleCreateRound = async () => {
    try {
      await fetchAPI("/rounds/", {
        method: "POST",
        body: JSON.stringify({
          date: new Date().toISOString(),
          location: "Location",
          referee: "Referee",
          round_number: rounds.length + 1,
          season_id: parseInt(params.id)
        })
      });
      loadData();
    } catch(err) {
      console.error(err);
    }
  };

  if (loading) return <div>Carregando rodadas...</div>;
  if (!season) return <div>Temporada não encontrada.</div>;

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h1>Temporada #{season.number}</h1>
        <button className={styles.primaryBtn} onClick={handleCreateRound}>Nova Rodada</button>
      </div>

      <div className={styles.grid}>
        {rounds.map(r => (
          <Link key={r.id_round} href={`/rounds/${r.id_round}`} className={styles.card}>
            <h2>Rodada {r.round_number}</h2>
            <p><strong>Data:</strong> {new Date(r.date).toLocaleDateString("pt-BR")}</p>
            <p><strong>Local:</strong> {r.location}</p>
          </Link>
        ))}
      </div>
    </div>
  );
}
