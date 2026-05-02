'use client';

import { useEffect, useState, useContext } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { AuthContext } from '@/context/AuthContext';
import { fetchAPI } from '@/lib/api';
import Link from 'next/link';
import SeasonChart from '@/components/SeasonChart';
import styles from './player-profile.module.css';

interface Stats {
  total_matches: number;
  total_wins: number;
  total_losses: number;
  total_draws: number;
  total_goals: number;
  total_assists: number;
  total_awards: number;
  total_seasons: number;
}

interface SeasonStats {
  season_id: number;
  season_name: string;
  total_matches: number;
  total_wins: number;
  total_losses: number;
  total_draws: number;
  total_goals: number;
  total_assists: number;
  total_points: number;
}

interface Team {
  id_team: number;
  name: string;
}

interface Award {
  id_award: number;
  event_type: string;
}

interface PlayerProfile {
  id_player: number;
  nome: string;
  apelido: string;
  email: string;
  telefone: string;
  posicao: string;
  pe: string;
  potes: number;
  user_id: number;
  is_associate: boolean;
  is_guest: boolean;
  created_at: string;
  updated_at: string;
  stats: Stats;
  season_stats: SeasonStats[];
  teams: Team[];
  awards: Award[];
}

export default function PlayerProfilePage() {
  const params = useParams();
  const router = useRouter();
  const { user } = useContext(AuthContext);
  const [player, setPlayer] = useState<PlayerProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showAdminPanel, setShowAdminPanel] = useState(false);
  const [adminAction, setAdminAction] = useState<string>('');
  const [showSuspendModal, setShowSuspendModal] = useState(false);
  const [suspendType, setSuspendType] = useState('days');
  const [suspendValue, setSuspendValue] = useState(1);
  const [fineAmount, setFineAmount] = useState(0);
  const [observations, setObservations] = useState('');
  const [adminActionsHistory, setAdminActionsHistory] = useState<any[]>([]);
  const [playerStatus, setPlayerStatus] = useState<any>(null);

  const playerId = params.id as string;

  useEffect(() => {
    loadPlayerProfile();
  }, [playerId]);

  const loadPlayerProfile = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await fetchAPI(`/players/${playerId}/profile`);
      setPlayer(data);

      // Carregar status do admin se o usuário for admin
      if (user?.role === 'admin') {
        try {
          const statusData = await fetchAPI(`/players/${playerId}/status`);
          setPlayerStatus(statusData);

          const actionsData = await fetchAPI(`/players/${playerId}/admin/actions`);
          setAdminActionsHistory(actionsData);
        } catch (err) {
          console.log('Erro ao carregar dados de admin:', err);
        }
      }
    } catch (err: any) {
      setError(err.message || 'Erro ao carregar perfil do jogador');
      console.error('Erro ao carregar perfil:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleAdminAction = async (action: string) => {
    if (!action) return;

    try {
      let endpoint = '';
      let method = 'POST';
      let body = {};

      switch (action) {
        case 'suspend':
          endpoint = `/players/${playerId}/admin/suspend`;
          body = { suspension_type: suspendType, value: suspendValue };
          break;
        case 'unsuspend':
          endpoint = `/players/${playerId}/admin/unsuspend`;
          break;
        case 'fine':
          endpoint = `/players/${playerId}/admin/fine`;
          body = { fine_amount: fineAmount };
          break;
        case 'observe':
          endpoint = `/players/${playerId}/admin/observe`;
          body = { observations };
          break;
        case 'block':
          endpoint = `/players/${playerId}/admin/block`;
          break;
        case 'unblock':
          endpoint = `/players/${playerId}/admin/unblock`;
          break;
        default:
          return;
      }

      const response = await fetchAPI(endpoint, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: Object.keys(body).length > 0 ? JSON.stringify(body) : undefined,
      });

      // Recarregar dados após ação bem-sucedida
      await loadPlayerProfile();
      alert(`Ação "${action}" executada com sucesso!`);
      setAdminAction('');
      setShowSuspendModal(false);
    } catch (err: any) {
      console.error('Erro ao executar ação admin:', err);
      alert(`Erro: ${err.message || 'Falha ao executar ação'}`);
    }
  };

  if (loading) {
    return (
      <div className={styles.loading}>
        Carregando perfil do jogador...
      </div>
    );
  }

  if (error || !player) {
    return (
      <div className={styles.error}>
        <button onClick={() => router.back()} className={styles.backBtn}>
          ← Voltar
        </button>
        <div>{error || 'Jogador não encontrado'}</div>
      </div>
    );
  }

  const isAdmin = user?.role === 'admin';

  return (
    <div className={styles.container}>
      {/* Header com informações básicas */}
      <div>
        <button onClick={() => router.back()} className={styles.backBtn}>
          ← Voltar
        </button>

        <div className={styles.card}>
          <div className={styles.profileHeader}>
            <div className={styles.profileInfo}>
              <div className={styles.avatar}>
                {player.nome.charAt(0).toUpperCase()}
              </div>
              <div className={styles.nameSection}>
                <h1>{player.nome}</h1>
                {player.apelido && <p className={styles.nickname}>"{player.apelido}"</p>}
                <div className={styles.tags}>
                  {player.posicao && (
                    <span className={`${styles.tag} ${styles.tagBlue}`}>
                      {player.posicao.charAt(0).toUpperCase() + player.posicao.slice(1).toLowerCase()}
                    </span>
                  )}
                  {player.pe && (
                    <span className={`${styles.tag} ${styles.tagGreen}`}>
                      Pé: {player.pe}
                    </span>
                  )}
                  {player.potes && (
                    <span className={`${styles.tag} ${styles.tagYellow}`}>
                      Pote {player.potes}
                    </span>
                  )}
                  <span className={`${styles.tag} ${player.is_guest ? styles.tagRed : styles.tagGreen}`}>
                    {player.is_guest ? 'Convidado' : 'Mensalista'}
                  </span>
                </div>
              </div>
            </div>

            {isAdmin && (
              <button
                onClick={() => setShowAdminPanel(!showAdminPanel)}
                className={styles.adminBtn}
              >
                {showAdminPanel ? 'Fechar Painel Admin' : 'Abrir Painel Admin'}
              </button>
            )}
          </div>

          {/* Informações de contato */}
          <div className={styles.contactGrid}>
            {player.email && (
              <div className={styles.contactItem}>
                <label>Email</label>
                <p>{player.email}</p>
              </div>
            )}
            {player.telefone && (
              <div className={styles.contactItem}>
                <label>Telefone</label>
                <p>{player.telefone}</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Dashboard com estatísticas */}
      <div className={styles.dashboardGrid}>
        {/* Cards de estatísticas */}
        <div className={styles.statsGrid}>
          <StatCard label="Partidas" value={player.stats.total_matches} />
          <StatCard label="Vitórias" value={player.stats.total_wins} color="green" />
          <StatCard label="Derrotas" value={player.stats.total_losses} color="red" />
          <StatCard label="Empates" value={player.stats.total_draws} color="yellow" />
          <StatCard label="Gols" value={player.stats.total_goals} color="blue" />
          <StatCard label="Assistências" value={player.stats.total_assists} color="purple" />
          <StatCard label="Prêmios" value={player.stats.total_awards} color="orange" />
          <StatCard label="Temporadas" value={player.stats.total_seasons} />
        </div>

        {/* Card de resumo */}
        <div className={`${styles.card} ${styles.summarySection}`}>
          <h2>Resumo</h2>
          <div className={styles.summaryList}>
            <div className={styles.summaryItem}>
              <span className={styles.summaryItemLabel}>Taxa de Vitória:</span>
              <span className={styles.summaryItemValue}>
                {player.stats.total_matches > 0
                  ? ((player.stats.total_wins / player.stats.total_matches) * 100).toFixed(1)
                  : 0}
                %
              </span>
            </div>
            <div className={styles.summaryItem}>
              <span className={styles.summaryItemLabel}>Gols por Partida:</span>
              <span className={styles.summaryItemValue}>
                {player.stats.total_matches > 0
                  ? (player.stats.total_goals / player.stats.total_matches).toFixed(2)
                  : 0}
              </span>
            </div>
            <div className={styles.summaryItem}>
              <span className={styles.summaryItemLabel}>Assistências por Part.:</span>
              <span className={styles.summaryItemValue}>
                {player.stats.total_matches > 0
                  ? (player.stats.total_assists / player.stats.total_matches).toFixed(2)
                  : 0}
              </span>
            </div>
            <div className={styles.summaryItem}>
              <span className={styles.summaryItemLabel}>Times:</span>
              <span className={styles.summaryItemValue}>{player.teams.length}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Estatísticas por temporada */}
      {player.season_stats.length > 0 && (
        <div className={styles.card}>
          <h2 className={styles.sectionTitle}>Estatísticas por Temporada</h2>

          {/* Gráficos */}
          <div className={styles.chartsGrid}>
            <SeasonChart
              stats={player.season_stats}
              dataKey="total_matches"
              label="Partidas"
              color="#3b82f6"
            />
            <SeasonChart
              stats={player.season_stats}
              dataKey="total_goals"
              label="Gols"
              color="#10b981"
            />
            <SeasonChart
              stats={player.season_stats}
              dataKey="total_assists"
              label="Assistências"
              color="#f59e0b"
            />
            <SeasonChart
              stats={player.season_stats}
              dataKey="total_wins"
              label="Vitórias"
              color="#8b5cf6"
            />
          </div>

          {/* Tabela detalhada */}
          <div className={styles.tableWrapper}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Temporada</th>
                  <th style={{ textAlign: 'center' }}>Partidas</th>
                  <th style={{ textAlign: 'center' }}>Vitórias</th>
                  <th style={{ textAlign: 'center' }}>Derrotas</th>
                  <th style={{ textAlign: 'center' }}>Empates</th>
                  <th style={{ textAlign: 'center' }}>Gols</th>
                  <th style={{ textAlign: 'center' }}>Assistências</th>
                </tr>
              </thead>
              <tbody>
                {player.season_stats.map((season) => (
                  <tr key={season.season_id}>
                    <td>{season.season_name || `Temporada ${season.season_id}`}</td>
                    <td style={{ textAlign: 'center' }}>{season.total_matches}</td>
                    <td style={{ textAlign: 'center' }} className={styles.colorGreen}>{season.total_wins}</td>
                    <td style={{ textAlign: 'center' }} className={styles.colorRed}>{season.total_losses}</td>
                    <td style={{ textAlign: 'center' }} className={styles.colorYellow}>{season.total_draws}</td>
                    <td style={{ textAlign: 'center' }} className={styles.colorBlue}>{season.total_goals}</td>
                    <td style={{ textAlign: 'center' }} className={styles.colorPurple}>{season.total_assists}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Times */}
      {player.teams.length > 0 && (
        <div className={styles.card}>
          <h2 className={styles.sectionTitle}>Times</h2>
          <div className={styles.teamsGrid}>
            {player.teams.map((team) => (
              <Link
                key={team.id_team}
                href={`/teams/${team.id_team}`}
                className={styles.teamCard}
              >
                <p className={styles.teamName}>{team.name}</p>
                <p className={styles.teamAction}>Ver detalhes →</p>
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* Prêmios */}
      {player.awards.length > 0 && (
        <div className={styles.card}>
          <h2 className={styles.sectionTitle}>Prêmios ({player.awards.length})</h2>
          <div className={styles.awardsGrid}>
            {player.awards.map((award, idx) => (
              <div key={idx} className={styles.awardCard}>
                <div className={styles.awardIcon}>🏆</div>
                <div className={styles.awardName}>{formatAwardType(award.event_type)}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Painel Admin */}
      {isAdmin && showAdminPanel && (
        <div className={styles.adminPanel}>
          <h2>Painel Administrativo</h2>

          {/* Status do jogador */}
          {playerStatus && (
            <div className={styles.adminCard} style={{ marginBottom: '24px' }}>
              <h3>Status Atual</h3>
              <div className={styles.summaryList}>
                <div className={styles.summaryItem}>
                  <span className={styles.summaryItemLabel}>Bloqueado:</span>
                  <span className={playerStatus.is_blocked ? styles.colorRed : styles.colorGreen}>
                    {playerStatus.is_blocked ? 'SIM' : 'NÃO'}
                  </span>
                </div>
                {playerStatus.suspension && (
                  <>
                    {playerStatus.suspension.is_indefinite ? (
                      <div className={styles.summaryItem}>
                        <span className={styles.summaryItemLabel}>Suspensão:</span>
                        <span className={styles.colorRed}>Indefinida</span>
                      </div>
                    ) : playerStatus.suspension.suspension_matches ? (
                      <div className={styles.summaryItem}>
                        <span className={styles.summaryItemLabel}>Jogos restantes:</span>
                        <span className={styles.colorYellow}>{playerStatus.suspension.suspension_matches}</span>
                      </div>
                    ) : (
                      <>
                        <div className={styles.summaryItem}>
                          <span className={styles.summaryItemLabel}>Suspenso até:</span>
                          <span className={styles.colorYellow}>
                            {new Date(playerStatus.suspension.suspended_until).toLocaleDateString('pt-BR')}
                          </span>
                        </div>
                        <div className={styles.summaryItem}>
                          <span className={styles.summaryItemLabel}>Dias restantes:</span>
                          <span className={styles.colorYellow}>{playerStatus.suspension.days_remaining}</span>
                        </div>
                      </>
                    )}
                    <button
                      onClick={() => handleAdminAction('unsuspend')}
                      className={`${styles.actionBtn} ${styles.btnGreen}`}
                      style={{ marginTop: '12px' }}
                    >
                      Remover Suspensão Ativa
                    </button>
                  </>
                )}
              </div>
            </div>
          )}

          <div className={styles.adminGrid}>
            {/* Ação de suspensão */}
            <div className={styles.adminCard}>
              <h3>Gerenciar Suspensão</h3>
              <p className={styles.summaryItemLabel} style={{marginBottom: '16px'}}>Aplique penalidades de suspensão</p>
              <button
                onClick={() => setShowSuspendModal(true)}
                className={`${styles.actionBtn} ${styles.btnRed}`}
              >
                Configurar Suspensão
              </button>
            </div>

            {/* Ação de multa */}
            <div className={styles.adminCard}>
              <h3>Aplicar Multa</h3>
              <div className={styles.inputGroup}>
                <label>Valor da multa (R$):</label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={fineAmount}
                  onChange={(e) => setFineAmount(parseFloat(e.target.value))}
                  className={styles.input}
                />
              </div>
              <button
                onClick={() => handleAdminAction('fine')}
                className={`${styles.actionBtn} ${styles.btnOrange}`}
              >
                Aplicar Multa de R$ {fineAmount.toFixed(2)}
              </button>
            </div>

            {/* Ação de observações */}
            <div className={styles.adminCard}>
              <h3>Adicionar Observações</h3>
              <div className={styles.inputGroup}>
                <textarea
                  value={observations}
                  onChange={(e) => setObservations(e.target.value)}
                  placeholder="Digite suas observações..."
                  className={styles.textarea}
                />
              </div>
              <button
                onClick={() => handleAdminAction('observe')}
                className={`${styles.actionBtn} ${styles.btnBlue}`}
              >
                Salvar Observações
              </button>
            </div>

            {/* Ações de bloqueio */}
            <div className={styles.adminCard}>
              <h3>Controle de Acesso</h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginTop: '12px' }}>
                <button
                  onClick={() => handleAdminAction('block')}
                  className={`${styles.actionBtn} ${styles.btnRed}`}
                  style={{ margin: 0 }}
                >
                  Bloquear Acesso
                </button>
                <button
                  onClick={() => handleAdminAction('unblock')}
                  className={`${styles.actionBtn} ${styles.btnGreen}`}
                  style={{ margin: 0 }}
                >
                  Desbloquear Acesso
                </button>
              </div>
            </div>
          </div>

          {/* Histórico de ações */}
          {adminActionsHistory.length > 0 && (
            <div className={styles.adminCard} style={{ marginTop: '24px' }}>
              <h3>Histórico de Ações</h3>
              <div style={{ maxHeight: '250px', overflowY: 'auto' }}>
                {adminActionsHistory.map((action, idx) => (
                  <div key={idx} className={styles.historyItem}>
                    <div className={styles.historyHeader}>
                      <span className={styles.historyAction}>{action.action_type}</span>
                      <span className={styles.historyDate}>
                        {new Date(action.created_at).toLocaleDateString('pt-BR')}
                      </span>
                    </div>
                    {action.description && <p className={styles.historyDesc}>{action.description}</p>}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Modal Suspensão */}
      {showSuspendModal && (
        <div className={styles.modalOverlay}>
          <div className={styles.modalContent}>
            <h2>Suspender Jogador</h2>
            <div className={styles.inputGroup}>
              <label>Tipo de Suspensão:</label>
              <select 
                value={suspendType} 
                onChange={(e) => setSuspendType(e.target.value)}
                className={styles.input}
              >
                <option value="days">Por Dias</option>
                <option value="weeks">Por Semanas</option>
                <option value="games">Por Jogos</option>
                <option value="indefinite">Indefinidamente</option>
              </select>
            </div>
            
            {suspendType !== 'indefinite' && (
              <div className={styles.inputGroup}>
                <label>Quantidade ({suspendType === 'games' ? 'jogos' : suspendType === 'weeks' ? 'semanas' : 'dias'}):</label>
                <input
                  type="number"
                  min="1"
                  value={suspendValue}
                  onChange={(e) => setSuspendValue(parseInt(e.target.value))}
                  className={styles.input}
                />
              </div>
            )}
            
            <div style={{ display: 'flex', gap: '12px', marginTop: '24px' }}>
              <button
                onClick={() => handleAdminAction('suspend')}
                className={`${styles.actionBtn} ${styles.btnRed}`}
                style={{ margin: 0 }}
              >
                Confirmar Suspensão
              </button>
              <button
                onClick={() => setShowSuspendModal(false)}
                className={`${styles.actionBtn}`}
                style={{ background: 'var(--bg-surface)', margin: 0, border: '1px solid var(--border-color)' }}
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function StatCard({
  label,
  value,
  color = 'gray',
}: {
  label: string;
  value: number;
  color?: string;
}) {
  const getColorClass = (c: string) => {
    switch (c) {
      case 'green': return styles.colorGreen;
      case 'red': return styles.colorRed;
      case 'yellow': return styles.colorYellow;
      case 'blue': return styles.colorBlue;
      case 'purple': return styles.colorPurple;
      case 'orange': return styles.colorOrange;
      default: return '';
    }
  };

  return (
    <div className={styles.statCard}>
      <span className={styles.statLabel}>{label}</span>
      <span className={`${styles.statValue} ${getColorClass(color)}`}>{value}</span>
    </div>
  );
}

function formatAwardType(eventType: string): string {
  const awardMap: Record<string, string> = {
    time_vencedor_rodada: 'Campeão da Rodada',
    bola_cheia: 'MVP',
    bola_murcha: 'Pior Jogador',
    gol_rodada: 'Gol da Rodada',
    defesa_rodada: 'Defesa da Rodada',
    drible_rodada: 'Drible da Rodada',
    inacreditavel: 'Inacreditável',
    goleiro_menos_vazado: 'Goleiro Menos Vazado',
    roleta: 'Roleta',
  };
  return awardMap[eventType] || eventType;
}
