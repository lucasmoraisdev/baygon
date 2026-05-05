"use client";
import { useEffect, useState, useMemo, useCallback } from "react";
import { fetchAPI } from "@/lib/api";
import styles from "./rounds.module.css";

/* ─── Types ─── */
interface Round {
  id_round: number;
  round_number: number;
  date: string;
  location: string;
  referee: string;
  initial_time: string | null;
  end_time: string | null;
  season_id: number;
}

interface RoundStats {
  total_matches: number;
  total_goals: number;
  total_assists: number;
  goals_per_match: number;
  assists_per_match: number;
  total_yellow_cards: number;
  total_red_cards: number;
  total_blue_cards: number;
  winner_team: { id: number; name: string; wins: number } | null;
  top_scorer: { id: number; nome: string; apelido: string | null; goals: number } | null;
  top_assister: { id: number; nome: string; apelido: string | null; assists: number } | null;
  participants: { id: number; nome: string; apelido: string | null; posicao: string | null }[];
}

interface Season { id_season: number; number: number; is_active: boolean; }
interface Player { id_player: number; nome: string; apelido: string | null; posicao: string | null; }

/* ─── Helpers ─── */
const initials = (nome: string) =>
  nome.split(" ").map((w) => w[0]).slice(0, 2).join("").toUpperCase();

const posLabel: Record<string, string> = {
  goleiro: "GK",
  pivo: "PIV",
  ala: "ALA",
  fixo: "FIX",
};

const DEFAULT_ROUND = {
  round_number: "",
  location: "Campo Principal",
  referee: "A definir",
  date: new Date().toISOString().split("T")[0],
};

/* ═══════════════════════════════════════════════════════════════ */
export default function RoundsPage() {
  const [seasons, setSeasons] = useState<Season[]>([]);
  const [selectedSeason, setSelectedSeason] = useState<string>("");
  const [rounds, setRounds] = useState<Round[]>([]);
  const [selectedRoundId, setSelectedRoundId] = useState<number | null>(null);
  const [stats, setStats] = useState<RoundStats | null>(null);
  const [allPlayers, setAllPlayers] = useState<Player[]>([]);

  const [loadingSeasons, setLoadingSeasons] = useState(true);
  const [loadingStats, setLoadingStats] = useState(false);

  // Modal state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [newRound, setNewRound] = useState(DEFAULT_ROUND);
  const [selectedPlayerIds, setSelectedPlayerIds] = useState<Set<number>>(new Set());
  const [playerSearch, setPlayerSearch] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // Finish round state
  const [isFinishModalOpen, setIsFinishModalOpen] = useState(false);
  const [finishing, setFinishing] = useState(false);

  /* ─── Initial load ─── */
  useEffect(() => {
    Promise.all([
      fetchAPI("/seasons/"),
      fetchAPI("/seasons/current").catch(() => null),
      fetchAPI("/players/").catch(() => []),
    ]).then(([allSeasons, current, players]) => {
      setSeasons(allSeasons);
      setAllPlayers(players);
      if (current) {
        setSelectedSeason(current.id_season.toString());
      } else if (allSeasons.length > 0) {
        setSelectedSeason(allSeasons[0].id_season.toString());
      }
    }).catch(console.error)
      .finally(() => setLoadingSeasons(false));
  }, []);

  /* ─── Load rounds when season changes ─── */
  useEffect(() => {
    if (!selectedSeason) return;
    fetchAPI(`/rounds/season/${selectedSeason}`)
      .then((res: Round[]) => {
        const sorted = [...res].sort((a, b) => b.round_number - a.round_number);
        setRounds(sorted);

        // Default: active round (no end_time) or most recent
        const active = sorted.find((r) => !r.end_time);
        const defaultRound = active ?? sorted[0] ?? null;
        setSelectedRoundId(defaultRound?.id_round ?? null);

        // Suggest next round number
        if (sorted.length > 0) {
          const max = Math.max(...sorted.map((r) => r.round_number));
          setNewRound((p) => ({ ...p, round_number: (max + 1).toString() }));
        } else {
          setNewRound((p) => ({ ...p, round_number: "1" }));
        }
      })
      .catch(console.error);
  }, [selectedSeason]);

  /* ─── Load stats when round changes ─── */
  const loadStats = useCallback(async (roundId: number) => {
    setLoadingStats(true);
    setStats(null);
    try {
      const data = await fetchAPI(`/rounds/${roundId}/stats`);
      setStats(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingStats(false);
    }
  }, []);

  useEffect(() => {
    if (selectedRoundId !== null) {
      loadStats(selectedRoundId);
    }
  }, [selectedRoundId, loadStats]);

  /* ─── Derived ─── */
  const activeRound = useMemo(() => rounds.find((r) => !r.end_time), [rounds]);
  const selectedRound = useMemo(
    () => rounds.find((r) => r.id_round === selectedRoundId),
    [rounds, selectedRoundId]
  );

  const filteredPlayers = useMemo(() => {
    if (!playerSearch.trim()) return allPlayers;
    const q = playerSearch.toLowerCase();
    return allPlayers.filter(
      (p) =>
        p.nome.toLowerCase().includes(q) ||
        (p.apelido && p.apelido.toLowerCase().includes(q))
    );
  }, [allPlayers, playerSearch]);

  /* ─── Handlers ─── */
  const togglePlayer = (id: number) => {
    setSelectedPlayerIds((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const handleStartRound = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedSeason) return;
    setSubmitting(true);
    try {
      const created: Round = await fetchAPI("/rounds/", {
        method: "POST",
        body: JSON.stringify({
          round_number: parseInt(newRound.round_number),
          location: newRound.location,
          referee: newRound.referee,
          date: new Date(newRound.date).toISOString(),
          season_id: parseInt(selectedSeason),
          initial_time: new Date().toISOString(),
        }),
      });

      // TODO: future endpoint to associate players to round
      // selectedPlayerIds → POST /rounds/{created.id_round}/players

      setIsModalOpen(false);
      setNewRound(DEFAULT_ROUND);
      setSelectedPlayerIds(new Set());
      setPlayerSearch("");

      // Refresh rounds and select the new one
      const refreshed: Round[] = await fetchAPI(`/rounds/season/${selectedSeason}`);
      const sorted = [...refreshed].sort((a, b) => b.round_number - a.round_number);
      setRounds(sorted);
      setSelectedRoundId(created.id_round);
    } catch (err) {
      console.error(err);
      alert("Erro ao iniciar rodada.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleFinishRound = async () => {
    if (!activeRound) return;
    setFinishing(true);
    try {
      await fetchAPI(`/rounds/${activeRound.id_round}`, {
        method: "PUT",
        body: JSON.stringify({ end_time: new Date().toISOString() }),
      });
      setIsFinishModalOpen(false);
      // Refresh rounds list
      const refreshed: Round[] = await fetchAPI(`/rounds/season/${selectedSeason}`);
      const sorted = [...refreshed].sort((a, b) => b.round_number - a.round_number);
      setRounds(sorted);
      // Reload stats for currently selected round
      if (selectedRoundId !== null) loadStats(selectedRoundId);
    } catch (err) {
      console.error(err);
      alert("Erro ao finalizar rodada.");
    } finally {
      setFinishing(false);
    }
  };

  /* ─── Render helpers ─── */
  const StatCard = ({
    icon,
    value,
    label,
    sub,
    variant,
  }: {
    icon: string;
    value: string | number;
    label: string;
    sub?: string;
    variant?: "highlight" | "gold" | "green" | "red";
  }) => (
    <div
      className={`${styles.statCard} ${
        variant === "highlight"
          ? styles.statCardHighlight
          : variant === "gold"
          ? styles.statCardGold
          : variant === "green"
          ? styles.statCardGreen
          : variant === "red"
          ? styles.statCardRed
          : ""
      }`}
    >
      <div className={styles.statIcon}>{icon}</div>
      <div className={styles.statValue}>{value}</div>
      <div className={styles.statLabel}>{label}</div>
      {sub && <div className={styles.statSub}>{sub}</div>}
    </div>
  );

  if (loadingSeasons) {
    return <div className={styles.loadingState}>Carregando temporadas...</div>;
  }

  return (
    <div className={styles.container}>
      {/* ── Header ── */}
      <div className={styles.header}>
        <div>
          <h1>Rodadas</h1>
          <p className={styles.headerSub}>
            {activeRound
              ? `Rodada ${activeRound.round_number} em andamento`
              : rounds.length > 0
              ? "Nenhuma rodada ativa no momento"
              : "Nenhuma rodada cadastrada"}
          </p>
        </div>
        <div className={styles.headerActions}>
          {/* Season selector */}
          <select
            value={selectedSeason}
            onChange={(e) => setSelectedSeason(e.target.value)}
            className={styles.input}
            style={{ width: "auto", cursor: "pointer" }}
            id="season-selector"
          >
            {seasons.map((s) => (
              <option key={s.id_season} value={s.id_season}>
                Temporada {s.number} {s.is_active ? "(Atual)" : ""}
              </option>
            ))}
          </select>

          {/* Start Round button — only if no active round */}
          {!activeRound && (
            <button
              id="btn-start-round"
              className={styles.btnSuccess}
              onClick={() => setIsModalOpen(true)}
            >
              ▶ Iniciar Rodada
            </button>
          )}

          {/* Finish Round button — only if selected round is the active one */}
          {activeRound && selectedRound?.id_round === activeRound.id_round && (
            <button
              id="btn-finish-round"
              className={styles.btnDanger}
              onClick={() => setIsFinishModalOpen(true)}
            >
              🏁 Finalizar Rodada
            </button>
          )}
        </div>
      </div>

      {/* ── Round Selector Tabs ── */}
      {rounds.length > 0 ? (
        <div className={styles.selectorBar}>
          <span className={styles.selectorLabel}>Rodada</span>
          <div className={styles.roundTabs}>
            {rounds.map((r) => {
              const isActive = !r.end_time;
              const isSelected = r.id_round === selectedRoundId;
              return (
                <button
                  key={r.id_round}
                  id={`round-tab-${r.id_round}`}
                  onClick={() => setSelectedRoundId(r.id_round)}
                  className={`${styles.roundTab} ${isSelected ? styles.roundTabActive : ""}`}
                >
                  #{r.round_number}
                  {isActive && (
                    <span className={styles.activeBadge}>
                      <span className={styles.activeDot} />
                      LIVE
                    </span>
                  )}
                </button>
              );
            })}
          </div>
          {selectedRound && (
            <span style={{ fontSize: "12px", color: "var(--text-muted)", whiteSpace: "nowrap" }}>
              {new Date(selectedRound.date).toLocaleDateString("pt-BR", {
                day: "2-digit",
                month: "short",
                year: "numeric",
              })}
            </span>
          )}
        </div>
      ) : (
        <div className={styles.noRoundState}>
          <div className={styles.noRoundIcon}>🏟️</div>
          <div className={styles.noRoundTitle}>Nenhuma rodada cadastrada</div>
          <div className={styles.noRoundSub}>
            Inicie a primeira rodada desta temporada para começar a registrar partidas e estatísticas.
          </div>
          <button className={styles.btnSuccess} onClick={() => setIsModalOpen(true)}>
            ▶ Iniciar Primeira Rodada
          </button>
        </div>
      )}

      {/* ── Stats Section ── */}
      {selectedRound && (
        <>
          {/* Round meta bar */}
          <div
            style={{
              display: "flex",
              gap: "24px",
              flexWrap: "wrap",
              fontSize: "13px",
              color: "var(--text-muted)",
              background: "var(--bg-surface)",
              border: "1px solid var(--border-color)",
              borderRadius: "var(--radius)",
              padding: "14px 20px",
              backdropFilter: "blur(10px)",
            }}
          >
            <span>📅 {new Date(selectedRound.date).toLocaleDateString("pt-BR", { weekday: "long", day: "2-digit", month: "long", year: "numeric" })}</span>
            <span>📍 {selectedRound.location}</span>
            <span>👨‍⚖️ {selectedRound.referee}</span>
            {selectedRound.initial_time && (
              <span>⏱ Início: {new Date(selectedRound.initial_time).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}</span>
            )}
            {selectedRound.end_time && (
              <span>🏁 Fim: {new Date(selectedRound.end_time).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}</span>
            )}
          </div>

          {loadingStats ? (
            <div className={styles.loadingState}>Carregando estatísticas...</div>
          ) : stats ? (
            <>
              {/* ── Main Stats Grid ── */}
              <div className={styles.statsGrid}>
                <StatCard icon="⚽" value={stats.total_goals} label="Gols" sub={`${stats.goals_per_match} por partida`} variant="highlight" />
                <StatCard icon="🎯" value={stats.total_assists} label="Assistências" sub={`${stats.assists_per_match} por partida`} variant="highlight" />
                <StatCard icon="🏟️" value={stats.total_matches} label="Partidas" />
                <StatCard icon="🟡" value={stats.total_yellow_cards} label="Cartões Amarelos" variant="gold" />
                <StatCard icon="🔴" value={stats.total_red_cards} label="Cartões Vermelhos" variant="red" />
                <StatCard icon="🔵" value={stats.total_blue_cards} label="Cartões Azuis (Ouro)" />
                {stats.winner_team && (
                  <StatCard
                    icon="🏆"
                    value={stats.winner_team.name}
                    label="Time Vencedor"
                    sub={`${stats.winner_team.wins} vitória${stats.winner_team.wins !== 1 ? "s" : ""}`}
                    variant="gold"
                  />
                )}
              </div>

              {/* ── Highlights + Participants ── */}
              <div className={styles.panelRow}>
                {/* Highlights */}
                <div className={styles.panel}>
                  <p className={styles.panelTitle}>🌟 Destaques da Rodada</p>

                  {stats.top_scorer ? (
                    <div className={styles.highlightBox}>
                      <div className={styles.highlightBoxIcon}>⚽</div>
                      <div className={styles.highlightBoxInfo}>
                        <div className={styles.highlightBoxName}>
                          {stats.top_scorer.apelido || stats.top_scorer.nome}
                        </div>
                        <div className={styles.highlightBoxSub}>
                          Artilheiro · {stats.top_scorer.goals} gol{stats.top_scorer.goals !== 1 ? "s" : ""}
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className={styles.highlightBox} style={{ opacity: 0.5 }}>
                      <div className={styles.highlightBoxIcon}>⚽</div>
                      <div className={styles.highlightBoxInfo}>
                        <div className={styles.highlightBoxName}>— Sem artilheiro</div>
                        <div className={styles.highlightBoxSub}>Nenhum gol registrado</div>
                      </div>
                    </div>
                  )}

                  {stats.top_assister ? (
                    <div className={styles.highlightBox}>
                      <div className={styles.highlightBoxIcon}>🎯</div>
                      <div className={styles.highlightBoxInfo}>
                        <div className={styles.highlightBoxName}>
                          {stats.top_assister.apelido || stats.top_assister.nome}
                        </div>
                        <div className={styles.highlightBoxSub}>
                          Garçom · {stats.top_assister.assists} assistência{stats.top_assister.assists !== 1 ? "s" : ""}
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className={styles.highlightBox} style={{ opacity: 0.5 }}>
                      <div className={styles.highlightBoxIcon}>🎯</div>
                      <div className={styles.highlightBoxInfo}>
                        <div className={styles.highlightBoxName}>— Sem assistências</div>
                        <div className={styles.highlightBoxSub}>Nenhuma assistência registrada</div>
                      </div>
                    </div>
                  )}

                  {stats.winner_team ? (
                    <div className={styles.highlightBox}>
                      <div className={styles.highlightBoxIcon}>🏆</div>
                      <div className={styles.highlightBoxInfo}>
                        <div className={styles.highlightBoxName}>{stats.winner_team.name}</div>
                        <div className={styles.highlightBoxSub}>
                          Time mais vitorioso · {stats.winner_team.wins} vitória{stats.winner_team.wins !== 1 ? "s" : ""}
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className={styles.highlightBox} style={{ opacity: 0.5 }}>
                      <div className={styles.highlightBoxIcon}>🏆</div>
                      <div className={styles.highlightBoxInfo}>
                        <div className={styles.highlightBoxName}>— Sem vencedor</div>
                        <div className={styles.highlightBoxSub}>Nenhuma partida encerrada</div>
                      </div>
                    </div>
                  )}
                </div>

                {/* Participants */}
                <div className={styles.panel}>
                  <p className={styles.panelTitle}>
                    👥 Participantes ({stats.participants.length})
                  </p>
                  {stats.participants.length === 0 ? (
                    <div className={styles.emptyState}>
                      Nenhum jogador com eventos registrados nesta rodada.
                    </div>
                  ) : (
                    <div className={styles.playerList}>
                      {stats.participants.map((p) => (
                        <div key={p.id} className={styles.playerItem}>
                          <div className={styles.playerAvatar}>{initials(p.nome)}</div>
                          <span className={styles.playerName}>{p.apelido || p.nome}</span>
                          {p.posicao && (
                            <span className={styles.playerPosition}>
                              {posLabel[p.posicao] ?? p.posicao.toUpperCase()}
                            </span>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </>
          ) : null}
        </>
      )}

      {/* ═══════════════════════════════════════════════ */}
      {/* Modal: Iniciar Nova Rodada */}
      {isModalOpen && (
        <div className={styles.modalOverlay} onClick={(e) => { if (e.target === e.currentTarget) setIsModalOpen(false); }}>
          <div className={styles.modal}>
            <h2>🏟️ Iniciar Nova Rodada</h2>
            <p className={styles.modalSub}>
              Configure a data do baba e selecione os jogadores participantes.
            </p>

            <form onSubmit={handleStartRound} className={styles.form}>
              {/* Row 1 */}
              <div className={styles.formRow}>
                <div className={styles.formGroup}>
                  <label htmlFor="round-number">Número da Rodada</label>
                  <input
                    id="round-number"
                    type="number"
                    className={styles.input}
                    value={newRound.round_number}
                    onChange={(e) => setNewRound({ ...newRound, round_number: e.target.value })}
                    required
                    min={1}
                    placeholder="Ex: 1"
                  />
                </div>
                <div className={styles.formGroup}>
                  <label htmlFor="round-date">Data do Baba</label>
                  <input
                    id="round-date"
                    type="date"
                    className={styles.input}
                    value={newRound.date}
                    onChange={(e) => setNewRound({ ...newRound, date: e.target.value })}
                    required
                  />
                </div>
              </div>

              {/* Row 2 */}
              <div className={styles.formRow}>
                <div className={styles.formGroup}>
                  <label htmlFor="round-location">Local</label>
                  <input
                    id="round-location"
                    type="text"
                    className={styles.input}
                    value={newRound.location}
                    onChange={(e) => setNewRound({ ...newRound, location: e.target.value })}
                    required
                    placeholder="Ex: Campo Principal"
                  />
                </div>
                <div className={styles.formGroup}>
                  <label htmlFor="round-referee">Árbitro</label>
                  <input
                    id="round-referee"
                    type="text"
                    className={styles.input}
                    value={newRound.referee}
                    onChange={(e) => setNewRound({ ...newRound, referee: e.target.value })}
                    required
                    placeholder="Ex: A definir"
                  />
                </div>
              </div>

              <hr className={styles.dividerLine} />

              {/* Players */}
              <div>
                <p className={styles.sectionLabel}>
                  Jogadores Convocados ({selectedPlayerIds.size} selecionados)
                </p>
                <input
                  type="text"
                  className={styles.input}
                  placeholder="🔍  Buscar jogador..."
                  value={playerSearch}
                  onChange={(e) => setPlayerSearch(e.target.value)}
                  style={{ marginBottom: "10px" }}
                  id="player-search"
                />
                <div className={styles.playerSelectionGrid}>
                  {filteredPlayers.map((p) => {
                    const selected = selectedPlayerIds.has(p.id_player);
                    return (
                      <div
                        key={p.id_player}
                        id={`player-select-${p.id_player}`}
                        className={`${styles.playerCheckItem} ${selected ? styles.playerCheckItemSelected : ""}`}
                        onClick={() => togglePlayer(p.id_player)}
                      >
                        <div className={`${styles.playerCheckbox} ${selected ? styles.playerCheckboxChecked : ""}`}>
                          {selected && <span style={{ color: "white", fontSize: "10px", fontWeight: 800 }}>✓</span>}
                        </div>
                        <span className={styles.playerCheckName} title={p.nome}>
                          {p.apelido || p.nome}
                        </span>
                      </div>
                    );
                  })}
                  {filteredPlayers.length === 0 && (
                    <p style={{ color: "var(--text-muted)", fontSize: "13px", gridColumn: "1/-1", textAlign: "center", padding: "16px 0" }}>
                      Nenhum jogador encontrado.
                    </p>
                  )}
                </div>
              </div>

              <div className={styles.modalActions}>
                <button
                  type="button"
                  className={styles.btnSecondary}
                  onClick={() => {
                    setIsModalOpen(false);
                    setSelectedPlayerIds(new Set());
                    setPlayerSearch("");
                  }}
                >
                  Cancelar
                </button>
                <button type="submit" className={styles.btnSuccess} disabled={submitting} id="btn-confirm-start-round">
                  {submitting ? "Criando..." : "▶ Iniciar Rodada"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════════ */}
      {/* Modal: Confirmar Finalizar Rodada */}
      {isFinishModalOpen && activeRound && (
        <div
          className={styles.modalOverlay}
          onClick={(e) => { if (e.target === e.currentTarget) setIsFinishModalOpen(false); }}
        >
          <div className={styles.modal} style={{ maxWidth: "420px" }}>
            <div style={{ textAlign: "center", marginBottom: "8px", fontSize: "48px" }}>🏁</div>
            <h2 style={{ textAlign: "center", margin: "0 0 8px" }}>Finalizar Rodada?</h2>
            <p className={styles.modalSub} style={{ textAlign: "center" }}>
              Você está prestes a encerrar a{" "}
              <strong style={{ color: "var(--text-main)" }}>Rodada {activeRound.round_number}</strong>.
              Isso registrará o horário de fim e a rodada será marcada como concluída.
              Esta ação não pode ser desfeita facilmente.
            </p>

            <div
              style={{
                background: "rgba(239, 68, 68, 0.08)",
                border: "1px solid rgba(239, 68, 68, 0.2)",
                borderRadius: "10px",
                padding: "14px 16px",
                marginBottom: "24px",
                fontSize: "13px",
                color: "#fca5a5",
              }}
            >
              ⚠️ Após finalizar, não será possível criar novas partidas nesta rodada sem reabri-la manualmente.
            </div>

            <div className={styles.modalActions}>
              <button
                type="button"
                className={styles.btnSecondary}
                onClick={() => setIsFinishModalOpen(false)}
                disabled={finishing}
              >
                Cancelar
              </button>
              <button
                id="btn-confirm-finish-round"
                type="button"
                className={styles.btnDanger}
                onClick={handleFinishRound}
                disabled={finishing}
              >
                {finishing ? "Finalizando..." : "🏁 Confirmar Encerramento"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
