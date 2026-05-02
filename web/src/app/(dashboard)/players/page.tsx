"use client";

import { useEffect, useState, useContext } from "react";
import { fetchAPI } from "@/lib/api";
import styles from "./players.module.css";
import Link from "next/link";
import { AuthContext } from "@/context/AuthContext";
import SuspendModal from "@/components/SuspendModal";

interface Player {
  id_player: number;
  nome: string;
  apelido?: string;
  email?: string;
  telefone?: string;
  posicao?: "goleiro" | "pivo" | "ala" | "fixo";
  pe?: "D" | "E" | "A";
  potes?: number;
  is_associate: boolean;
  is_guest: boolean;
}

export default function PlayersPage() {
  const { user } = useContext(AuthContext);
  const isAdmin = user?.role === 'admin';

  const [players, setPlayers] = useState<Player[]>([]);
  const [loading, setLoading] = useState(true);
  const [isCreating, setIsCreating] = useState(false);
  const [nome, setNome] = useState("");
  const [apelido, setApelido] = useState("");
  const [email, setEmail] = useState("");
  const [telefone, setTelefone] = useState("");
  const [posicao, setPosicao] = useState<"goleiro" | "pivo" | "ala" | "fixo" | "">("");
  const [pe, setPe] = useState<"D" | "E" | "A" | "">("");
  const [potes, setPotes] = useState<number | "">("");
  const [isGuest, setIsGuest] = useState(false);

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

  const [suspendModalOpen, setSuspendModalOpen] = useState(false);
  const [playerToSuspend, setPlayerToSuspend] = useState<number | null>(null);

  const handleConfirmSuspend = async (type: string, value: number) => {
    if (!playerToSuspend) return;
    try {
      await fetchAPI(`/players/${playerToSuspend}/admin/suspend`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ suspension_type: type, value }),
      });
      setSuspendModalOpen(false);
      setPlayerToSuspend(null);
      alert('Jogador suspenso com sucesso!');
      loadPlayers();
    } catch (err: any) {
      console.error(err);
      alert(`Erro: ${err.message || 'Falha ao suspender'}`);
    }
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await fetchAPI("/players/", {
        method: "POST",
        body: JSON.stringify({
          nome,
          apelido: apelido || null,
          email: email || null,
          telefone: telefone || null,
          posicao: posicao || null,
          pe: pe || null,
          potes: potes ? parseInt(String(potes)) : null,
          is_associate: !isGuest,
          is_guest: isGuest
        })
      });
      setIsCreating(false);
      setNome("");
      setApelido("");
      setEmail("");
      setTelefone("");
      setPosicao("");
      setPe("");
      setPotes("");
      setIsGuest(false);
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
        <div className={styles.modalOverlay}>
          <div className={styles.modalContent}>
            <h2>Novo Jogador</h2>
            <form onSubmit={handleCreate}>
          <div className={styles.inputGroup}>
            <label>Nome do Jogador *</label>
            <input type="text" value={nome} onChange={(e) => setNome(e.target.value)} required placeholder="Ex: Lucas Morais" />
          </div>
          <div className={styles.inputGroup}>
            <label>Apelido</label>
            <input type="text" value={apelido} onChange={(e) => setApelido(e.target.value)} placeholder="Ex: Lucão" />
          </div>
          <div className={styles.inputGroup}>
            <label>Email</label>
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Ex: lucas@example.com" />
          </div>
          <div className={styles.inputGroup}>
            <label>Telefone</label>
            <input type="tel" value={telefone} onChange={(e) => setTelefone(e.target.value)} placeholder="Ex: (11) 98765-4321" />
          </div>
          <div className={styles.inputGroup}>
            <label>Posição</label>
            <select value={posicao} onChange={(e) => setPosicao(e.target.value as "goleiro" | "pivo" | "ala" | "fixo" | "")}>
              <option value="">Selecione uma posição...</option>
              <option value="goleiro">Goleiro</option>
              <option value="pivo">Pívô</option>
              <option value="ala">Ala</option>
              <option value="fixo">Fixo</option>
            </select>
          </div>
          <div className={styles.inputGroup}>
            <label>Pé Predominante</label>
            <select value={pe} onChange={(e) => setPe(e.target.value as "D" | "E" | "A" | "")}>
              <option value="">Selecione um pé...</option>
              <option value="D">Direito</option>
              <option value="E">Esquerdo</option>
              <option value="A">Ambidestro</option>
            </select>
          </div>
          <div className={styles.inputGroup}>
            <label>Potes (1-5)</label>
            <select value={potes} onChange={(e) => setPotes(e.target.value ? parseInt(e.target.value) : "")}>
              <option value="">Selecione um pote...</option>
              <option value="1">1</option>
              <option value="2">2</option>
              <option value="3">3</option>
              <option value="4">4</option>
              <option value="5">5</option>
            </select>
          </div>
          <div className={styles.inputGroupRow}>
            <label>
              <input type="checkbox" checked={isGuest} onChange={(e) => setIsGuest(e.target.checked)} />
              É convidado? (Se não selecionado, será mensalista)
            </label>
          </div>
          <div className={styles.actions}>
            <button type="submit" className={styles.primaryBtn} disabled={loading}>Salvar</button>
            <button type="button" className={styles.secondaryBtn} onClick={() => setIsCreating(false)}>Cancelar</button>
          </div>
            </form>
          </div>
        </div>
      )}

      <div className={styles.list}>
        {players.length === 0 && <p style={{ color: 'var(--text-muted)' }}>Nenhum jogador registrado.</p>}
        {players.map((player) => (
          <div key={player.id_player} className={styles.listItem}>
            <div className={styles.avatar}>{player.nome.charAt(0).toUpperCase()}</div>
            <div className={styles.details}>
              <strong>{player.nome}</strong>
              {player.apelido && <span style={{ fontSize: '0.9em', color: 'var(--text-muted)' }}>Apelido: {player.apelido}</span>}
              {player.email && <span style={{ fontSize: '0.9em', color: 'var(--text-muted)' }}>Email: {player.email}</span>}
              {player.telefone && <span style={{ fontSize: '0.9em', color: 'var(--text-muted)' }}>Tel: {player.telefone}</span>}
              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginTop: '4px' }}>
                {player.posicao && <span style={{ fontSize: '0.9em', backgroundColor: '#3498db', padding: '2px 6px', borderRadius: '4px', color: '#fff' }}>{player.posicao.charAt(0).toUpperCase() + player.posicao.slice(1)}</span>}
                {player.pe && <span style={{ fontSize: '0.9em', backgroundColor: '#2ecc71', padding: '2px 6px', borderRadius: '4px', color: '#fff' }}>Pé: {player.pe === 'D' ? 'Direito' : player.pe === 'E' ? 'Esquerdo' : 'Ambidestro'}</span>}
                {player.potes && <span style={{ fontSize: '0.9em', backgroundColor: '#ffa500', padding: '2px 6px', borderRadius: '4px', color: '#fff' }}>Pote {player.potes}</span>}
              </div>
              <span className={player.is_guest ? styles.guest : styles.associate}>
                {player.is_guest ? "Convidado" : "Mensalista"}
              </span>
            </div>
            <div className={styles.actionsBox} style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
              {isAdmin && (
                <button
                  onClick={() => { setPlayerToSuspend(player.id_player); setSuspendModalOpen(true); }}
                  className={styles.secondaryBtn}
                  style={{ padding: '6px 12px', fontSize: '13px', background: '#ef4444', color: 'white', border: 'none' }}
                >
                  Suspender
                </button>
              )}
              <Link href={`/players/${player.id_player}`} className={styles.secondaryBtn} style={{ padding: '6px 12px', fontSize: '13px' }}>
                Perfil Completo
              </Link>
            </div>
          </div>
        ))}
      </div>

      <SuspendModal
        isOpen={suspendModalOpen}
        onClose={() => { setSuspendModalOpen(false); setPlayerToSuspend(null); }}
        onConfirm={handleConfirmSuspend}
      />
    </div>
  );
}
