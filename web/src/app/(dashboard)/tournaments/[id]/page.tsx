"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Trophy,
  ArrowLeft,
  Calendar,
  Shield,
  Swords,
  Layers,
  Users,
  Play,
  CheckCircle2,
  AlertCircle,
  Edit3,
  Shuffle,
  Plus,
} from "lucide-react";
import { fetchAPI } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { Loading } from "@/components/Loading";
import { Button } from "@/components/Button";
import { Modal } from "@/components/Modal";
import { TournamentAdBanner } from "@/components/TournamentAdBanner";
import {
  TournamentStandingsTable,
  TournamentStandingsData,
} from "@/components/TournamentStandingsTable";
import {
  TournamentBracketView,
  BracketData,
} from "@/components/TournamentBracketView";
import { MatchResultModal, MatchToEdit } from "@/components/MatchResultModal";

interface TournamentRoundItem {
  id_round: number;
  round_number: number;
  date: string;
  location?: string | null;
  matches: {
    id_match: number;
    home_team_id: number;
    home_team_name: string;
    home_team_color?: string | null;
    away_team_id: number;
    away_team_name: string;
    away_team_color?: string | null;
    score_home: number;
    score_away: number;
    penalties_home: number;
    penalties_away: number;
    stage: string;
    bracket_position?: number | null;
    leg: number;
    is_finished: boolean;
    winner_team_id?: number | null;
  }[];
}

interface TournamentDetail {
  id_season: number;
  name: string | null;
  number: number;
  tournament_format: "individual_points" | "pontos_corridos" | "mata_mata" | "grupos_e_mata_mata";
  has_legs: boolean;
  teams_per_group?: number | null;
  advancing_per_group?: number | null;
  is_active: boolean;
  initial_date: string;
  end_date?: string | null;
}

interface TeamItem {
  id_team: number;
  name: string;
  color?: string | null;
  group_name?: string | null;
}

export default function TournamentDetailPage() {
  const params = useParams();
  const tournamentId = parseInt(params.id as string, 10);
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const isAdmin = Boolean(user?.is_admin || user?.role === "admin");

  const [activeTab, setActiveTab] = useState<"standings" | "bracket" | "matches" | "teams">("standings");
  const [isTeamModalOpen, setIsTeamModalOpen] = useState(false);
  const [teamName, setTeamName] = useState("");
  const [teamColor, setTeamColor] = useState("#10b981");
  const [teamGroup, setTeamGroup] = useState("Grupo A");
  const [editingMatch, setEditingMatch] = useState<MatchToEdit | null>(null);
  const [feedbackMsg, setFeedbackMsg] = useState<{ type: "success" | "error"; text: string } | null>(
    null
  );

  // Queries
  const {
    data: tournament,
    isLoading: isLoadingTournament,
    isError,
  } = useQuery<TournamentDetail>({
    queryKey: ["tournament", tournamentId],
    queryFn: () => fetchAPI(`/tournaments/${tournamentId}`),
    enabled: !isNaN(tournamentId),
  });

  const { data: teams = [], refetch: refetchTeams } = useQuery<TeamItem[]>({
    queryKey: ["tournament_teams", tournamentId],
    queryFn: () => fetchAPI(`/tournaments/${tournamentId}/teams`),
    enabled: !isNaN(tournamentId),
  });

  const { data: standings, refetch: refetchStandings } = useQuery<TournamentStandingsData>({
    queryKey: ["tournament_standings", tournamentId],
    queryFn: () => fetchAPI(`/tournaments/${tournamentId}/standings`),
    enabled:
      !isNaN(tournamentId) &&
      tournament?.tournament_format !== "mata_mata" &&
      tournament?.tournament_format !== "individual_points",
  });

  const { data: bracket, refetch: refetchBracket } = useQuery<BracketData>({
    queryKey: ["tournament_bracket", tournamentId],
    queryFn: () => fetchAPI(`/tournaments/${tournamentId}/bracket`),
    enabled:
      !isNaN(tournamentId) &&
      (tournament?.tournament_format === "mata_mata" ||
        tournament?.tournament_format === "grupos_e_mata_mata"),
  });

  const { data: rounds = [], refetch: refetchRounds } = useQuery<TournamentRoundItem[]>({
    queryKey: ["tournament_rounds", tournamentId],
    queryFn: () => fetchAPI(`/tournaments/${tournamentId}/rounds`),
    enabled: !isNaN(tournamentId),
  });

  const refetchAll = () => {
    refetchRounds();
    refetchStandings();
    refetchBracket();
    refetchTeams();
  };

  // Mutações
  const drawBracketMutation = useMutation({
    mutationFn: (seedMode: "random" | "seeded" = "random") =>
      fetchAPI(`/tournaments/${tournamentId}/draw-bracket`, {
        method: "POST",
        body: JSON.stringify({ seed_mode: seedMode }),
      }),
    onSuccess: (data: any) => {
      refetchAll();
      setFeedbackMsg({
        type: "success",
        text: data?.message || "Chaveamento dos playoffs sorteado com sucesso!",
      });
    },
    onError: (err: any) => {
      setFeedbackMsg({
        type: "error",
        text: err?.message || "Erro ao realizar sorteio. Cadastre as equipes primeiro.",
      });
    },
  });
  const addTeamsMutation = useMutation({
    mutationFn: (body: any[]) =>
      fetchAPI(`/tournaments/${tournamentId}/teams`, {
        method: "POST",
        body: JSON.stringify(body),
      }),
    onSuccess: () => {
      refetchTeams();
      setIsTeamModalOpen(false);
      setTeamName("");
      setFeedbackMsg({ type: "success", text: "Equipe inscrita com sucesso no campeonato!" });
    },
    onError: (err: any) => {
      setFeedbackMsg({ type: "error", text: err?.message || "Erro ao inscrever equipe." });
    },
  });

  const generateFixturesMutation = useMutation({
    mutationFn: () =>
      fetchAPI(`/tournaments/${tournamentId}/generate-fixtures`, {
        method: "POST",
      }),
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ["tournament_standings", tournamentId] });
      queryClient.invalidateQueries({ queryKey: ["tournament_bracket", tournamentId] });
      setFeedbackMsg({
        type: "success",
        text: data?.message || "Tabela de jogos gerada com sucesso!",
      });
    },
    onError: (err: any) => {
      setFeedbackMsg({
        type: "error",
        text: err?.message || "Erro ao gerar confrontos. Verifique se há equipes inscritas.",
      });
    },
  });

  // Ajusta tab padrão se for mata-mata puro
  React.useEffect(() => {
    if (tournament?.tournament_format === "mata_mata" && activeTab === "standings") {
      setActiveTab("bracket");
    }
  }, [tournament, activeTab]);

  if (isLoadingTournament) return <Loading />;
  if (isError || !tournament) {
    return (
      <div className="flex flex-col items-center justify-center p-12 text-center">
        <AlertCircle className="w-12 h-12 text-rose-500 mb-3" />
        <h3 className="text-lg font-bold text-zinc-100">Torneio não encontrado</h3>
        <p className="text-sm text-zinc-400 mt-1 mb-4">
          O campeonato solicitado não existe ou você não possui acesso nesta associação.
        </p>
        <Link
          href="/tournaments"
          className="text-sm font-semibold text-emerald-400 hover:underline flex items-center gap-1.5"
        >
          <ArrowLeft className="w-4 h-4" />
          Voltar para Lista de Torneios
        </Link>
      </div>
    );
  }

  const handleAddTeamSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!teamName.trim()) return;

    const payload = [
      {
        name: teamName.trim(),
        color: teamColor,
        group_name: tournament.tournament_format === "grupos_e_mata_mata" ? teamGroup : undefined,
      },
    ];

    addTeamsMutation.mutate(payload);
  };

  return (
    <div className="flex flex-col gap-6 animate-slide-down pb-16">
      {/* Top Breadcrumb & Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Link
            href="/tournaments"
            className="p-2 rounded-xl bg-surface border border-border text-muted hover:text-main hover:border-border-hover dark:bg-zinc-900 dark:border-zinc-800 transition-colors shadow-sm"
          >
            <ArrowLeft className="w-4 h-4" />
          </Link>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl sm:text-3xl font-bold text-main">
                {tournament.name || `Temporada #${tournament.number}`}
              </h1>
              <span
                className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${
                  tournament.is_active
                    ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/20"
                    : "bg-slate-100 text-muted dark:bg-zinc-800 dark:text-zinc-400 border border-border dark:border-transparent"
                }`}
              >
                {tournament.is_active ? "Em Andamento" : "Finalizado"}
              </span>
            </div>
            <div className="flex items-center gap-2 text-xs text-muted mt-1">
              <span>Edição #{tournament.number}</span>
              <span>•</span>
              <span className="capitalize">{tournament.tournament_format.replace(/_/g, " ")}</span>
              {tournament.has_legs && <span>• Jogos de Ida e Volta</span>}
            </div>
          </div>
        </div>

        {/* Botões de Ação para Administradores */}
        {isAdmin && (
          <div className="flex flex-wrap items-center gap-2.5">
            <button
              onClick={() => setIsTeamModalOpen(true)}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-border bg-surface hover:bg-nav-hover text-main dark:border-zinc-700 dark:bg-zinc-800/80 dark:text-zinc-200 font-semibold text-xs shadow-sm transition-all"
            >
              <Plus className="w-3.5 h-3.5" />
              Inscrever Equipe
            </button>

            {tournament.tournament_format === "mata_mata" && (
              <button
                onClick={() => drawBracketMutation.mutate("random")}
                disabled={drawBracketMutation.isPending}
                className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-border bg-surface hover:bg-nav-hover text-main dark:border-zinc-700 dark:bg-zinc-800/80 dark:text-zinc-200 font-semibold text-xs shadow-sm transition-all"
              >
                <Shuffle className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                {drawBracketMutation.isPending ? "Sorteando..." : "Sortear Chaves"}
              </button>
            )}

            <Button
              variant="primary"
              size="sm"
              disabled={generateFixturesMutation.isPending}
              onClick={() => generateFixturesMutation.mutate()}
              className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold"
            >
              <Play className="w-3.5 h-3.5" />
              {generateFixturesMutation.isPending ? "Gerando..." : "Gerar Tabela de Jogos"}
            </Button>
          </div>
        )}
      </div>

      {/* Banner de Feedback */}
      {feedbackMsg && (
        <div
          className={`p-3.5 rounded-xl text-sm flex items-center justify-between border ${
            feedbackMsg.type === "success"
              ? "bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-800/60 text-emerald-800 dark:text-emerald-300"
              : "bg-rose-50 dark:bg-rose-950/40 border-rose-200 dark:border-rose-800/60 text-rose-800 dark:text-rose-300"
          }`}
        >
          <span>{feedbackMsg.text}</span>
          <button
            onClick={() => setFeedbackMsg(null)}
            className="text-xs font-bold underline ml-3"
          >
            Fechar
          </button>
        </div>
      )}

      {/* Banner de Anúncios e Patrocínios para Plano Free */}
      <TournamentAdBanner placement="top_banner" />

      {/* Tabs de Navegação */}
      <div className="flex items-center gap-2 border-b border-border dark:border-zinc-800 pb-2 overflow-x-auto">
        {tournament.tournament_format !== "mata_mata" && (
          <button
            onClick={() => setActiveTab("standings")}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition-all ${
              activeTab === "standings"
                ? "bg-emerald-600 dark:bg-emerald-500 text-white dark:text-zinc-950 font-bold shadow-md shadow-emerald-500/20"
                : "text-muted hover:text-main hover:bg-nav-hover"
            }`}
          >
            <Shield className="w-4 h-4" />
            Classificação
          </button>
        )}

        {(tournament.tournament_format === "mata_mata" ||
          tournament.tournament_format === "grupos_e_mata_mata") && (
          <button
            onClick={() => setActiveTab("bracket")}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition-all ${
              activeTab === "bracket"
                ? "bg-emerald-600 dark:bg-emerald-500 text-white dark:text-zinc-950 font-bold shadow-md shadow-emerald-500/20"
                : "text-muted hover:text-main hover:bg-nav-hover"
            }`}
          >
            <Swords className="w-4 h-4" />
            Chaveamento (Playoffs)
          </button>
        )}

        <button
          onClick={() => setActiveTab("matches")}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition-all ${
            activeTab === "matches"
              ? "bg-emerald-600 dark:bg-emerald-500 text-white dark:text-zinc-950 font-bold shadow-md shadow-emerald-500/20"
              : "text-muted hover:text-main hover:bg-nav-hover"
          }`}
        >
          <Calendar className="w-4 h-4" />
          Rodadas & Jogos ({rounds.reduce((acc, r) => acc + r.matches.length, 0)})
        </button>

        <button
          onClick={() => setActiveTab("teams")}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition-all ${
            activeTab === "teams"
              ? "bg-emerald-600 dark:bg-emerald-500 text-white dark:text-zinc-950 font-bold shadow-md shadow-emerald-500/20"
              : "text-muted hover:text-main hover:bg-nav-hover"
          }`}
        >
          <Users className="w-4 h-4" />
          Equipes Inscritas ({teams.length})
        </button>
      </div>

      {/* Conteúdo da Tab Ativa */}
      {activeTab === "standings" && standings && (
        <TournamentStandingsTable
          standingsData={standings}
          advancingPerGroup={tournament.advancing_per_group}
        />
      )}

      {activeTab === "bracket" && bracket && (
        <TournamentBracketView
          bracket={bracket}
          isAdmin={isAdmin}
          onRefresh={() => {
            refetchBracket();
            refetchStandings();
          }}
        />
      )}

      {activeTab === "matches" && (
        <div className="flex flex-col gap-6">
          {rounds.length === 0 ? (
            <div className="p-8 text-center rounded-2xl border border-dashed border-border text-muted text-sm bg-surface/50">
              Nenhuma rodada ou confronto gerado ainda. Clique em &quot;Gerar Tabela de Jogos&quot; para criar os confrontos.
            </div>
          ) : (
            rounds.map((round) => (
              <div key={round.id_round} className="flex flex-col gap-3">
                <div className="flex items-center justify-between pb-2 border-b border-border">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-sm text-main">
                      Rodada #{round.round_number}
                    </span>
                    {round.location && (
                      <span className="text-xs text-muted">• {round.location}</span>
                    )}
                  </div>
                  <span className="text-xs text-muted">
                    {round.matches.length} {round.matches.length === 1 ? "partida" : "partidas"}
                  </span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                  {round.matches.map((m) => (
                    <div
                      key={m.id_match}
                      className="flex items-center justify-between p-3.5 rounded-xl border border-border bg-surface hover:border-border-hover dark:bg-zinc-900/60 dark:border-zinc-800 shadow-sm transition-all"
                    >
                      <div className="flex flex-col gap-2 flex-1 min-w-0 pr-3">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2 truncate">
                            <span
                              className="w-3 h-3 rounded-full shrink-0 border border-border"
                              style={{ backgroundColor: m.home_team_color || "#10b981" }}
                            />
                            <span className="text-sm font-medium text-main truncate">
                              {m.home_team_name}
                            </span>
                          </div>
                          <div className="flex items-center gap-1.5 ml-2 font-mono text-sm font-bold text-main">
                            <span>{m.score_home}</span>
                            {m.penalties_home > 0 && (
                              <span className="text-[11px] text-muted">({m.penalties_home})</span>
                            )}
                          </div>
                        </div>

                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2 truncate">
                            <span
                              className="w-3 h-3 rounded-full shrink-0 border border-border"
                              style={{ backgroundColor: m.away_team_color || "#3b82f6" }}
                            />
                            <span className="text-sm font-medium text-main truncate">
                              {m.away_team_name}
                            </span>
                          </div>
                          <div className="flex items-center gap-1.5 ml-2 font-mono text-sm font-bold text-main">
                            <span>{m.score_away}</span>
                            {m.penalties_away > 0 && (
                              <span className="text-[11px] text-muted">({m.penalties_away})</span>
                            )}
                          </div>
                        </div>
                      </div>

                      <div className="flex flex-col items-end gap-1.5 border-l border-border pl-3 shrink-0">
                        <span
                          className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                            m.is_finished
                              ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                              : "bg-amber-500/10 text-amber-600 dark:text-amber-400"
                          }`}
                        >
                          {m.is_finished ? "Encerrado" : "Aguardando"}
                        </span>

                        {isAdmin && (
                          <button
                            onClick={() =>
                              setEditingMatch({
                                id_match: m.id_match,
                                tournament_id: tournamentId,
                                home_team_id: m.home_team_id,
                                home_team_name: m.home_team_name,
                                home_team_color: m.home_team_color,
                                away_team_id: m.away_team_id,
                                away_team_name: m.away_team_name,
                                away_team_color: m.away_team_color,
                                score_home: m.score_home,
                                score_away: m.score_away,
                                penalties_home: m.penalties_home,
                                penalties_away: m.penalties_away,
                                stage: m.stage,
                                is_finished: m.is_finished,
                              })
                            }
                            className="flex items-center gap-1 text-[11px] font-semibold text-muted hover:text-emerald-500 transition-colors mt-0.5"
                          >
                            <Edit3 className="w-3 h-3" />
                            Súmula
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {activeTab === "teams" && (
        <div className="flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <h3 className="text-base font-bold text-main">Equipes do Campeonato</h3>
            {isAdmin && (
              <button
                onClick={() => setIsTeamModalOpen(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/20 text-xs font-semibold transition-colors"
              >
                <Plus className="w-3.5 h-3.5" />
                Adicionar Equipe
              </button>
            )}
          </div>

          {teams.length === 0 ? (
            <div className="p-8 text-center rounded-2xl border border-dashed border-border text-muted text-sm bg-surface/50">
              Nenhuma equipe inscrita neste campeonato ainda.
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3.5">
              {teams.map((t) => (
                <div
                  key={t.id_team}
                  className="flex items-center justify-between p-3.5 rounded-xl border border-border bg-surface dark:bg-zinc-900/60 shadow-sm"
                >
                  <div className="flex items-center gap-2.5 truncate">
                    <span
                      className="w-3.5 h-3.5 rounded-full shrink-0 border border-border"
                      style={{ backgroundColor: t.color || "#10b981" }}
                    />
                    <span className="text-sm font-semibold text-main truncate">{t.name}</span>
                  </div>
                  {t.group_name && (
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-background border border-border text-muted">
                      {t.group_name}
                    </span>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Modal de Lançamento de Placar e Súmula Rápida */}
      <MatchResultModal
        isOpen={Boolean(editingMatch)}
        onClose={() => setEditingMatch(null)}
        match={editingMatch}
        onSuccess={refetchAll}
      />

      {/* Modal de Inscrição de Equipes */}
      <Modal
        isOpen={isTeamModalOpen}
        onClose={() => setIsTeamModalOpen(false)}
        title="Inscrever Equipe no Campeonato"
      >
        <form onSubmit={handleAddTeamSubmit} className="flex flex-col gap-4">
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-muted mb-1.5">
              Nome da Equipe
            </label>
            <input
              type="text"
              value={teamName}
              onChange={(e) => setTeamName(e.target.value)}
              placeholder="Ex: Real Madrid da Pelada"
              className="w-full px-3.5 py-2.5 rounded-xl bg-background border border-border text-main text-sm focus:border-emerald-500 focus:outline-none dark:bg-zinc-950 dark:border-zinc-800"
              required
            />
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-muted mb-1.5">
              Cor do Uniforme
            </label>
            <div className="flex items-center gap-3">
              <input
                type="color"
                value={teamColor}
                onChange={(e) => setTeamColor(e.target.value)}
                className="w-10 h-10 rounded-lg cursor-pointer bg-transparent border-0"
              />
              <span className="text-xs font-mono text-muted uppercase">{teamColor}</span>
            </div>
          </div>

          {tournament.tournament_format === "grupos_e_mata_mata" && (
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-muted mb-1.5">
                Grupo Designado
              </label>
              <select
                value={teamGroup}
                onChange={(e) => setTeamGroup(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl bg-background border border-border text-main text-sm focus:border-emerald-500 focus:outline-none dark:bg-zinc-950 dark:border-zinc-800"
              >
                <option value="Grupo A">Grupo A</option>
                <option value="Grupo B">Grupo B</option>
                <option value="Grupo C">Grupo C</option>
                <option value="Grupo D">Grupo D</option>
              </select>
            </div>
          )}

          <div className="flex items-center justify-end gap-2 mt-4 pt-3 border-t border-border">
            <button
              type="button"
              onClick={() => setIsTeamModalOpen(false)}
              className="px-4 py-2 rounded-xl text-xs font-semibold text-muted hover:text-main transition-colors"
            >
              Cancelar
            </button>
            <Button
              type="submit"
              variant="primary"
              size="sm"
              disabled={addTeamsMutation.isPending}
              className="px-5 py-2 font-semibold"
            >
              {addTeamsMutation.isPending ? "Inscrevendo..." : "Confirmar Inscrição"}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
