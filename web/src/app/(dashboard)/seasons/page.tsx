"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { fetchAPI } from "@/lib/api";
import styles from "./seasons.module.css";

interface Season {
  id_season: number;
  initial_date: string;
  end_date: string;
  number: number;
}

export default function SeasonsPage() {
  const [season, setSeason] = useState<Season | null>(null);
  const [loading, setLoading] = useState(true);
  const [isCreating, setIsCreating] = useState(false);
  const [newNumber, setNewNumber] = useState("");
  const [newDate, setNewDate] = useState("");
  const [newEndDate, setNewEndDate] = useState("");
  const [error, setError] = useState<string | null>(null);

  const loadCurrentSeason = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchAPI("/seasons/current");
      setSeason(data);
    } catch (err: any) {
      if (err.message !== "Nenhuma temporada ativa") {
        console.error(err);
        setError(err.message || "Erro ao carregar a temporada atual.");
      }
      setSeason(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadCurrentSeason();
  }, []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();

    const body: any = {
      initial_date: new Date(newDate).toISOString()
    };

    if (newNumber) {
      body.number = parseInt(newNumber, 10);
    }
    if (newEndDate) {
      body.end_date = new Date(newEndDate).toISOString();
    }

    try {
      await fetchAPI("/seasons/", {
        method: "POST",
        body: JSON.stringify(body)
      });
      setIsCreating(false);
      setNewNumber("");
      setNewDate("");
      setNewEndDate("");
      loadCurrentSeason();
    } catch (err) {
      console.error(err);
    }
  };

  if (loading) return <div>Carregando temporada atual...</div>;

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h1>Temporadas</h1>
        {!season && (
          <button className={styles.primaryBtn} onClick={() => setIsCreating(true)}>
            Nova Temporada
          </button>
        )}
        {season && (
          <Link href={`/seasons/${season.id_season}`} className={styles.primaryBtn}>
            Ver temporada ativa
          </Link>
        )}
      </div>

      {error && <div className={styles.error}>{error}</div>}

      {!season && (
        <div className={styles.message}>
          <p>Nenhuma temporada ativa encontrada. Crie uma nova temporada para começar.</p>
        </div>
      )}

      {season && (
        <div className={styles.card}>
          <div className={styles.cardHeader}>
            <h2>Temporada #{season.number}</h2>
          </div>
          <div className={styles.cardBody}>
            <p><strong>Início:</strong> {new Date(season.initial_date).toLocaleDateString("pt-BR")}</p>
            <p><strong>Fim:</strong> {new Date(season.end_date).toLocaleDateString("pt-BR")}</p>
          </div>
        </div>
      )}

      {isCreating && (
        <form onSubmit={handleCreate} className={styles.createForm}>
          <h3>Criar Temporada</h3>
          <div className={styles.inputGroup}>
            <label>Número da Temporada</label>
            <input
              type="number"
              value={newNumber}
              onChange={(e) => setNewNumber(e.target.value)}
              min={1}
              placeholder="Opcional"
            />
          </div>
          <div className={styles.inputGroup}>
            <label>Data Inicial</label>
            <input type="date" value={newDate} onChange={(e) => setNewDate(e.target.value)} required />
          </div>
          <div className={styles.inputGroup}>
            <label>Data de Encerramento</label>
            <input
              type="date"
              value={newEndDate}
              onChange={(e) => setNewEndDate(e.target.value)}
              placeholder="Opcional"
            />
          </div>
          <div className={styles.actions}>
            <button type="submit" className={styles.primaryBtn}>Salvar</button>
            <button type="button" className={styles.secondaryBtn} onClick={() => setIsCreating(false)}>Cancelar</button>
          </div>
        </form>
      )}
    </div>
  );
}
