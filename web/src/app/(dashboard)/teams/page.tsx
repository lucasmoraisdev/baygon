"use client";
import { useEffect, useState, useMemo, useContext } from "react";
import { fetchAPI } from "@/lib/api";
import Link from "next/link";
import styles from "./teams.module.css";
import { AuthContext } from "@/context/AuthContext";

export default function TeamsPage() {
  const { user } = useContext(AuthContext);
  const isAdmin = user?.role === 'admin';

  const [seasons, setSeasons] = useState<any[]>([]);
  const [selectedSeason, setSelectedSeason] = useState<string>("");
  const [rounds, setRounds] = useState<any[]>([]);
  const [allTeams, setAllTeams] = useState<any[]>([]);
  const [allPlayers, setAllPlayers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [filterRoundId, setFilterRoundId] = useState<string>("");

  // Modals
  const [isRoundModalOpen, setIsRoundModalOpen] = useState(false);
  const [isTeamModalOpen, setIsTeamModalOpen] = useState(false);

  const [newRound, setNewRound] = useState({
    round_number: "",
    location: "Campo Principal",
    referee: "A definir",
    date: new Date().toISOString().split('T')[0]
  });

  const [newTeam, setNewTeam] = useState<{name: string, round_id: string, player_ids: string[]}>({
    name: "",
    round_id: "",
    player_ids: ["", "", "", "", ""]
  });

  useEffect(() => {
    Promise.all([
      fetchAPI("/seasons/"),
      fetchAPI("/seasons/current").catch(() => null),
      fetchAPI("/teams/").catch(() => []),
      fetchAPI("/players/").catch(() => [])
    ]).then(([allSeasons, current, teams, players]) => {
      setSeasons(allSeasons);
      setAllTeams(teams);
      setAllPlayers(players || []);
      if (current) {
        setSelectedSeason(current.id_season.toString());
      } else if (allSeasons.length > 0) {
        setSelectedSeason(allSeasons[0].id_season.toString());
      }
    })
    .catch(console.error)
    .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (selectedSeason) {
      fetchAPI(`/rounds/season/${selectedSeason}`)
        .then(res => {
          setRounds(res);
          const active = res.find((r: any) => !r.end_time);
          if (active) {
            setFilterRoundId(active.id_round.toString());
            setNewTeam(prev => ({ ...prev, round_id: active.id_round.toString() }));
          } else {
            setFilterRoundId("");
          }

          if (res.length > 0) {
            const maxRound = Math.max(...res.map((r: any) => r.round_number));
            setNewRound(prev => ({ ...prev, round_number: (maxRound + 1).toString() }));
          } else {
            setNewRound(prev => ({ ...prev, round_number: "1" }));
          }
        })
        .catch(console.error);
    }
  }, [selectedSeason]);

  const activeRound = useMemo(() => rounds.find(r => !r.end_time), [rounds]);

  const filteredTeams = useMemo(() => {
    return allTeams.filter(team => {
      if (filterRoundId) {
        return team.round_id.toString() === filterRoundId;
      } else {
        // Se filtro de rodada estiver vazio, mostra todos da temporada selecionada
        return rounds.some(r => r.id_round === team.round_id);
      }
    });
  }, [allTeams, filterRoundId, rounds]);

  const getRoundDisplay = (roundId: number) => {
    const r = rounds.find(rd => rd.id_round === roundId);
    return r ? `Rodada ${r.round_number}` : `Rodada ID: ${roundId}`;
  };

  const currentRoundTeams = useMemo(() => {
    if (!activeRound) return [];
    return allTeams.filter(t => t.round_id === activeRound.id_round);
  }, [allTeams, activeRound]);

  const handleStartRound = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const payload = {
        round_number: parseInt(newRound.round_number),
        location: newRound.location,
        referee: newRound.referee,
        date: new Date(newRound.date).toISOString(),
        season_id: parseInt(selectedSeason),
        initial_time: new Date().toISOString()
      };
      
      await fetchAPI("/rounds/", { method: "POST", body: JSON.stringify(payload) });
      setIsRoundModalOpen(false);
      
      // Refresh rounds
      fetchAPI(`/rounds/season/${selectedSeason}`).then(res => {
        setRounds(res);
        const active = res.find((r: any) => !r.end_time);
        if (active) {
          setFilterRoundId(active.id_round.toString());
          setNewTeam(prev => ({ ...prev, round_id: active.id_round.toString() }));
        }
      });
    } catch (error) {
      console.error("Erro:", error);
      alert("Erro ao iniciar rodada.");
    }
  };

  const handleCreateTeam = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const pIds = newTeam.player_ids.filter(id => id !== "").map(id => parseInt(id));
      await fetchAPI("/teams/", {
        method: "POST",
        body: JSON.stringify({
          name: newTeam.name,
          round_id: parseInt(newTeam.round_id),
          player_ids: pIds
        })
      });
      setIsTeamModalOpen(false);
      setNewTeam(prev => ({ ...prev, name: "", player_ids: ["", "", "", "", ""] }));
      
      fetchAPI("/teams/").then(setAllTeams);
    } catch (error) {
      console.error(error);
      alert("Erro ao criar time.");
    }
  };

  if (loading) return <div style={{ color: 'var(--text-muted)', padding: '40px', textAlign: 'center' }}>Carregando times...</div>;

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <div>
          <h1>Times</h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '14px', marginTop: '4px' }}>
            Gerencie os times de cada rodada
          </p>
        </div>
        <div className={styles.headerActions}>
          <select 
            value={selectedSeason} 
            onChange={(e) => setSelectedSeason(e.target.value)}
            className={styles.select}
          >
            {seasons.map(s => (
              <option key={s.id_season} value={s.id_season}>
                Temporada {s.number} {s.is_active ? "(Atual)" : ""}
              </option>
            ))}
          </select>
          {isAdmin && (
            <button className={styles.btnPrimary} onClick={() => setIsTeamModalOpen(true)}>
              <span>+</span> Novo Time
            </button>
          )}
        </div>
      </div>

      <div className={styles.filterBar}>
        <div className={styles.filterGroup}>
          <label>Filtrar por Rodada ou Temporada</label>
          <select 
            value={filterRoundId} 
            onChange={(e) => setFilterRoundId(e.target.value)}
            className={styles.select}
          >
            <option value="">Toda a Temporada (Todos os times da Temp.)</option>
            {rounds.map(r => (
              <option key={r.id_round} value={r.id_round}>
                Rodada {r.round_number} ({new Date(r.date).toLocaleDateString()}) {!r.end_time ? "[Ativa]" : ""}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Alertas de Fluxo (Rodada Ativa e Times Vazios) */}
      {!activeRound ? (
        <div className={styles.emptyState}>
          <h3>Nenhuma Rodada Ativa</h3>
          <p>Para interagir com os times desta semana, inicie uma nova rodada.</p>
          {isAdmin && (
            <button className={styles.btnPrimary} onClick={() => setIsRoundModalOpen(true)} style={{ background: '#10b981' }}>
              <span>▶</span> Iniciar Nova Rodada
            </button>
          )}
        </div>
      ) : currentRoundTeams.length === 0 && filterRoundId === activeRound.id_round.toString() ? (
        <div className={styles.emptyState}>
          <h3>Nenhum time cadastrado ainda</h3>
          <p>A rodada {activeRound.round_number} já está em andamento, mas não existem times sorteados e cadastrados para ela.</p>
          {isAdmin && (
            <button className={styles.btnPrimary} onClick={() => {
              setNewTeam(prev => ({ ...prev, round_id: activeRound.id_round.toString() }));
              setIsTeamModalOpen(true);
            }}>
              <span>+</span> Cadastrar Novo Time
            </button>
          )}
        </div>
      ) : null}

      <div className={styles.grid}>
        {filteredTeams.map(team => (
          <Link href={`/teams/${team.id_team}`} key={team.id_team} className={styles.teamCard}>
            <div className={styles.teamName}>
              {team.name}
              <span>⚽</span>
            </div>
            <div className={styles.teamMeta}>
              <span>{getRoundDisplay(team.round_id)}</span>
              <span style={{ color: "var(--primary-color)" }}>Detalhes →</span>
            </div>
          </Link>
        ))}
      </div>

      {/* Modal Iniciar Rodada (Reutilizado) */}
      {isRoundModalOpen && (
        <div className={styles.modalOverlay}>
          <div className={styles.modalContent}>
            <h2>Iniciar Nova Rodada</h2>
            <form onSubmit={handleStartRound}>
              <div className={styles.formGroup}>
                <label>Número da Rodada</label>
                <input 
                  type="number" 
                  value={newRound.round_number}
                  onChange={(e) => setNewRound({...newRound, round_number: e.target.value})}
                  required 
                  placeholder="Ex: 1"
                />
              </div>
              <div className={styles.formGroup}>
                <label>Local</label>
                <input 
                  type="text" 
                  value={newRound.location}
                  onChange={(e) => setNewRound({...newRound, location: e.target.value})}
                  required 
                />
              </div>
              <div className={styles.formGroup}>
                <label>Árbitro</label>
                <input 
                  type="text" 
                  value={newRound.referee}
                  onChange={(e) => setNewRound({...newRound, referee: e.target.value})}
                  required 
                />
              </div>
              <div className={styles.formGroup}>
                <label>Data</label>
                <input 
                  type="date" 
                  value={newRound.date}
                  onChange={(e) => setNewRound({...newRound, date: e.target.value})}
                  required 
                />
              </div>

              <div className={styles.modalActions}>
                <button type="button" className={styles.btnSecondary} onClick={() => setIsRoundModalOpen(false)}>
                  Cancelar
                </button>
                <button type="submit" className={styles.btnPrimary} style={{ background: '#10b981' }}>
                  Iniciar Rodada
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Novo Time */}
      {isTeamModalOpen && (
        <div className={styles.modalOverlay}>
          <div className={styles.modalContent}>
            <h2>Cadastrar Novo Time</h2>
            <form onSubmit={handleCreateTeam}>
              <div className={styles.formGroup}>
                <label>Nome do Time</label>
                <input 
                  type="text" 
                  value={newTeam.name}
                  onChange={(e) => setNewTeam({...newTeam, name: e.target.value})}
                  required 
                  placeholder="Ex: Time Azul"
                />
              </div>
              <div className={styles.formGroup}>
                <label>Rodada Alvo</label>
                <select 
                  value={newTeam.round_id}
                  onChange={(e) => setNewTeam({...newTeam, round_id: e.target.value})}
                  required
                >
                  <option value="">Selecione uma Rodada</option>
                  {rounds.map(r => (
                    <option key={r.id_round} value={r.id_round}>
                      Rodada {r.round_number} {!r.end_time ? "[Ativa]" : ""}
                    </option>
                  ))}
                </select>
              </div>

              {[1, 2, 3, 4, 5].map((pote, index) => (
                <div className={styles.formGroup} key={pote}>
                  <label>Pote {pote}</label>
                  <select 
                    value={newTeam.player_ids[index]}
                    onChange={(e) => {
                      const newIds = [...newTeam.player_ids];
                      newIds[index] = e.target.value;
                      setNewTeam({...newTeam, player_ids: newIds});
                    }}
                    required
                  >
                    <option value="">Selecione o jogador...</option>
                    {allPlayers.map(p => (
                      <option key={p.id_player} value={p.id_player}>
                        {p.nome} {p.potes ? `(Pote Origem: ${p.potes})` : ""}
                      </option>
                    ))}
                  </select>
                </div>
              ))}

              <div className={styles.modalActions}>
                <button type="button" className={styles.btnSecondary} onClick={() => setIsTeamModalOpen(false)}>
                  Cancelar
                </button>
                <button type="submit" className={styles.btnPrimary}>
                  Criar Time
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
