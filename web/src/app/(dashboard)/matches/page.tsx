"use client";
import { useEffect, useState, useMemo } from "react";
import { fetchAPI } from "@/lib/api";
import Link from "next/link";
import styles from "./matches.module.css";

export default function MatchesPage() {
  const [seasons, setSeasons] = useState<any[]>([]);
  const [selectedSeason, setSelectedSeason] = useState<string>("");
  const [matches, setMatches] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Resources for filters
  const [rounds, setRounds] = useState<any[]>([]);
  const [allTeams, setAllTeams] = useState<any[]>([]);
  const [allPlayers, setAllPlayers] = useState<any[]>([]);

  // Filter states
  const [filters, setFilters] = useState({
    round_id: "",
    team_id: "",
    player_id: ""
  });
  
  // Modal states
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isRoundModalOpen, setIsRoundModalOpen] = useState(false);
  const [teamsForMatch, setTeamsForMatch] = useState<any[]>([]);
  const [newMatch, setNewMatch] = useState({
    round_id: "",
    home_team_id: "",
    away_team_id: "",
    home_score: 0,
    away_score: 0
  });

  const [newRound, setNewRound] = useState({
    round_number: "",
    location: "Campo Principal",
    referee: "A definir",
    date: new Date().toISOString().split('T')[0]
  });

  useEffect(() => {
    // Busca todas as temporadas, times e jogadores
    Promise.all([
      fetchAPI("/seasons/"),
      fetchAPI("/seasons/current").catch(() => null),
      fetchAPI("/teams/").catch(() => []),
      fetchAPI("/players/").catch(() => [])
    ]).then(([allSeasons, current, teams, players]) => {
      setSeasons(allSeasons);
      setAllTeams(teams);
      setAllPlayers(players);
      
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
      fetchAPI(`/matches/season/${selectedSeason}`)
        .then(setMatches)
        .catch(console.error);
      
      fetchAPI(`/rounds/season/${selectedSeason}`)
        .then(res => {
          setRounds(res);
          // Auto-suggest next round number
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

  useEffect(() => {
    if (newMatch.round_id) {
       fetchAPI(`/teams/round/${newMatch.round_id}`)
        .then(setTeamsForMatch)
        .catch(console.error);
    } else {
      setTeamsForMatch([]);
    }
  }, [newMatch.round_id]);

  const activeRound = useMemo(() => rounds.find(r => !r.end_time), [rounds]);

  const filteredMatches = useMemo(() => {
    return matches.filter(m => {
      const matchRound = filters.round_id ? m.round_id.toString() === filters.round_id : true;
      const matchTeam = filters.team_id ? (m.home_team_id.toString() === filters.team_id || m.away_team_id.toString() === filters.team_id) : true;
      
      // Filtro por jogador (verifica se o jogador está em algum evento da partida)
      // Nota: Idealmente verificaríamos a escalação se disponível
      const matchPlayer = filters.player_id ? m.events?.some((e: any) => e.player_id.toString() === filters.player_id) : true;
      
      return matchRound && matchTeam && matchPlayer;
    });
  }, [matches, filters]);

  const handleCreateMatch = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const payload = {
        round_id: parseInt(newMatch.round_id),
        home_team_id: parseInt(newMatch.home_team_id),
        away_team_id: parseInt(newMatch.away_team_id),
        home_score: newMatch.home_score,
        away_score: newMatch.away_score
      };
      
      await fetchAPI("/matches/", { method: "POST", body: JSON.stringify(payload) });
      setIsModalOpen(false);
      setNewMatch({ round_id: "", home_team_id: "", away_team_id: "", home_score: 0, away_score: 0 });
      fetchAPI(`/matches/season/${selectedSeason}`).then(setMatches);
    } catch (error) {
      console.error("Erro:", error);
      alert("Erro ao criar partida.");
    }
  };

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
      fetchAPI(`/rounds/season/${selectedSeason}`).then(setRounds);
    } catch (error) {
      console.error("Erro:", error);
      alert("Erro ao iniciar rodada.");
    }
  };

  const getTeamName = (id: number) => allTeams.find(t => t.id_team === id)?.name || `Time ${id}`;

  if (loading) return <div style={{ color: 'var(--text-muted)', padding: '40px', textAlign: 'center' }}>Carregando radar de partidas...</div>;

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <div>
          <h1>Central de Partidas</h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '14px', marginTop: '4px' }}>
            {activeRound ? `Rodada ${activeRound.round_number} em andamento` : "Nenhuma rodada ativa no momento"}
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
          {!activeRound && (
            <button className={styles.btnPrimary} onClick={() => setIsRoundModalOpen(true)} style={{ background: '#10b981' }}>
              <span>▶</span> Iniciar Rodada
            </button>
          )}
          <button className={styles.btnPrimary} onClick={() => setIsModalOpen(true)}>
            <span>+</span> Nova Partida
          </button>
        </div>
      </div>

      <div className={styles.filterBar}>
        <div className={styles.filterGroup}>
          <label>Filtrar por Rodada</label>
          <select 
            value={filters.round_id} 
            onChange={(e) => setFilters({...filters, round_id: e.target.value})}
            className={styles.select}
          >
            <option value="">Todas as Rodadas</option>
            {rounds.map(r => (
              <option key={r.id_round} value={r.id_round}>
                Rodada {r.round_number} ({new Date(r.date).toLocaleDateString()})
              </option>
            ))}
          </select>
        </div>
        <div className={styles.filterGroup}>
          <label>Filtrar por Time</label>
          <select 
            value={filters.team_id} 
            onChange={(e) => setFilters({...filters, team_id: e.target.value})}
            className={styles.select}
          >
            <option value="">Todos os Times</option>
            {allTeams.map(t => (
              <option key={t.id_team} value={t.id_team}>{t.name}</option>
            ))}
          </select>
        </div>
        <div className={styles.filterGroup}>
          <label>Filtrar por Jogador</label>
          <select 
            value={filters.player_id} 
            onChange={(e) => setFilters({...filters, player_id: e.target.value})}
            className={styles.select}
          >
            <option value="">Todos os Jogadores</option>
            {allPlayers.map(p => (
              <option key={p.id_player} value={p.id_player}>{p.name}</option>
            ))}
          </select>
        </div>
      </div>

      <div className={styles.grid}>
        {filteredMatches.length === 0 && <p style={{ color: 'var(--text-muted)', gridColumn: '1/-1', textAlign: 'center', padding: '40px' }}>Nenhuma partida encontrada com estes filtros.</p>}
        {filteredMatches.map(m => (
          <Link href={`/matches/${m.id}`} key={m.id} className={styles.matchCard}>
            <div className={styles.teamsRow}>
              <div className={styles.team}>{getTeamName(m.home_team_id)}</div>
              <div className={styles.scoreBoard}>
                <span>{m.home_score}</span>
                <span className={styles.divider}>x</span>
                <span>{m.away_score}</span>
              </div>
              <div className={styles.team}>{getTeamName(m.away_team_id)}</div>
            </div>
            <div className={styles.meta}>
              <span>#P{m.id} • Rodada {m.round_id}</span>
              <span className={styles.liveBadge}>Ver Detalhes</span>
            </div>
          </Link>
        ))}
      </div>

      {/* Modal Nova Partida */}
      {isModalOpen && (
        <div className={styles.modalOverlay}>
          <div className={styles.modal}>
            <h2>Nova Partida</h2>
            <form onSubmit={handleCreateMatch} className={styles.form}>
              <div className={styles.formGroup}>
                <label>Rodada</label>
                <select 
                  className={styles.select}
                  value={newMatch.round_id}
                  onChange={(e) => setNewMatch({...newMatch, round_id: e.target.value, home_team_id: "", away_team_id: ""})}
                  required
                >
                  <option value="">Selecione a rodada</option>
                  {rounds.map(r => (
                    <option key={r.id_round} value={r.id_round}>Rodada {r.round_number}</option>
                  ))}
                </select>
              </div>

              <div className={styles.formGroup}>
                <label>Time da Casa</label>
                <select 
                  className={styles.select}
                  value={newMatch.home_team_id}
                  onChange={(e) => setNewMatch({...newMatch, home_team_id: e.target.value})}
                  required
                  disabled={!newMatch.round_id}
                >
                  <option value="">Selecione o time</option>
                  {teamsForMatch.map(t => (
                    <option key={t.id_team} value={t.id_team}>{t.name}</option>
                  ))}
                </select>
              </div>

              <div className={styles.formGroup}>
                <label>Time Visitante</label>
                <select 
                  className={styles.select}
                  value={newMatch.away_team_id}
                  onChange={(e) => setNewMatch({...newMatch, away_team_id: e.target.value})}
                  required
                  disabled={!newMatch.round_id}
                >
                  <option value="">Selecione o time</option>
                  {teamsForMatch.map(t => (
                    <option key={t.id_team} value={t.id_team}>{t.name}</option>
                  ))}
                </select>
              </div>

              <div className={styles.modalActions}>
                <button type="button" className={styles.btnSecondary} onClick={() => setIsModalOpen(false)}>
                  Cancelar
                </button>
                <button type="submit" className={styles.btnPrimary}>
                  Criar Partida
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Iniciar Rodada */}
      {isRoundModalOpen && (
        <div className={styles.modalOverlay}>
          <div className={styles.modal}>
            <h2>Iniciar Nova Rodada</h2>
            <form onSubmit={handleStartRound} className={styles.form}>
              <div className={styles.formGroup}>
                <label>Número da Rodada</label>
                <input 
                  type="number" 
                  className={styles.select} // Usando mesma classe para manter estilo
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
                  className={styles.select}
                  value={newRound.location}
                  onChange={(e) => setNewRound({...newRound, location: e.target.value})}
                  required 
                />
              </div>
              <div className={styles.formGroup}>
                <label>Árbitro</label>
                <input 
                  type="text" 
                  className={styles.select}
                  value={newRound.referee}
                  onChange={(e) => setNewRound({...newRound, referee: e.target.value})}
                  required 
                />
              </div>
              <div className={styles.formGroup}>
                <label>Data</label>
                <input 
                  type="date" 
                  className={styles.select}
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
    </div>
  );
}
