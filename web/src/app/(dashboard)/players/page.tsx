"use client";

import { useEffect, useState } from "react";
import { fetchAPI } from "@/lib/api";
import styles from "./players.module.css";
import Link from "next/link";

interface Player {
  id_player: number;
  name: string;
  is_associate: boolean;
}

export default function PlayersPage() {
  const [players, setPlayers] = useState<Player[]>([]);
  const [loading, setLoading] = useState(true);
  const [isCreating, setIsCreating] = useState(false);
  const [name, setName] = useState("");
  const [isAssociate, setIsAssociate] = useState(true);

  const loadPlayers = async () => {
    try {
      const data = await fetchAPI("/players/");
      setPlayers(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadPlayers();
  }, []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await fetchAPI("/players/", {
        method: "POST",
        body: JSON.stringify({ name, is_associate: isAssociate })
      });
      setIsCreating(false);
      setName("");
      loadPlayers();
    } catch (err) {
      console.error(err);
    }
  };

  if (loading) return <div>Carregando jogadores...</div>;

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h1>Jogadores ({players.length})</h1>
        <button className={styles.primaryBtn} onClick={() => setIsCreating(true)}>
          Novo Jogador
        </button>
      </div>

      {isCreating && (
        <form onSubmit={handleCreate} className={styles.createForm}>
          <h3>Adicionar Jogador</h3>
          <div className={styles.inputGroup}>
            <label>Nome do Jogador</label>
            <input type="text" value={name} onChange={(e) => setName(e.target.value)} required placeholder="Ex: Lucas Morais" />
          </div>
          <div className={styles.inputGroupRow}>
            <label>
              <input type="checkbox" checked={isAssociate} onChange={(e) => setIsAssociate(e.target.checked)} />
              É associado (Mensalista)?
            </label>
          </div>
          <div className={styles.actions}>
            <button type="submit" className={styles.primaryBtn}>Salvar</button>
            <button type="button" className={styles.secondaryBtn} onClick={() => setIsCreating(false)}>Cancelar</button>
          </div>
        </form>
      )}

      <div className={styles.list}>
        {players.length === 0 && <p style={{ color: 'var(--text-muted)' }}>Nenhum jogador registrado.</p>}
        {players.map((player) => (
          <div key={player.id_player} className={styles.listItem}>
            <div className={styles.avatar}>{player.name.charAt(0).toUpperCase()}</div>
            <div className={styles.details}>
              <strong>{player.name}</strong>
              <span className={player.is_associate ? styles.associate : styles.guest}>
                {player.is_associate ? "Associado" : "Convidado"}
              </span>
            </div>
            <div className={styles.actionsBox}>
               <Link href={`/players/${player.id_player}`} className={styles.secondaryBtn} style={{ padding: '6px 12px', fontSize: '13px' }}>
                 Perfil Completo
               </Link>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
