import React, { useState } from "react";
import { Trophy, ChevronRight, Swords, CheckCircle2, Shield, ArrowRight, Edit3, Shuffle } from "lucide-react";
import { fetchAPI } from "@/lib/api";
import { Button } from "@/components/Button";
import { TournamentAdBanner } from "@/components/TournamentAdBanner";
import { MatchResultModal, MatchToEdit } from "@/components/MatchResultModal";

export interface BracketMatch {
  id_match: number;
  stage: string;
  bracket_position?: number | null;
  leg: number;
  home_team_id: number;
  home_team_name: string;
  away_team_id: number;
  away_team_name: string;
  score_home: number;
  score_away: number;
  penalties_home: number;
  penalties_away: number;
  is_finished: boolean;
  winner_team_id?: number | null;
}

export interface BracketData {
  tournament_id: number;
  tournament_name?: string | null;
  has_legs: boolean;
  stages: Record<string, BracketMatch[]>;
}

interface TournamentBracketViewProps {
  bracket: BracketData;
  isAdmin?: boolean;
  onRefresh?: () => void;
}

const STAGE_ORDER = [
  { key: "round_of_16", label: "Oitavas de Final" },
  { key: "quarterfinals", label: "Quartas de Final" },
  { key: "semifinais", label: "Semifinais" },
  { key: "semifinals", label: "Semifinais" },
  { key: "final", label: "Grande Final" },
  { key: "third_place", label: "3º Lugar" },
];

export function TournamentBracketView({
  bracket,
  isAdmin = false,
  onRefresh,
}: TournamentBracketViewProps) {
  const [advancingStage, setAdvancingStage] = useState<string | null>(null);
  const [isDrawingBracket, setIsDrawingBracket] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);
  const [editingMatch, setEditingMatch] = useState<MatchToEdit | null>(null);

  // Normalizar chaves de stages (ex: semifinais vs semifinals)
  const availableStages = STAGE_ORDER.filter(
    (s) => bracket.stages[s.key] && bracket.stages[s.key].length > 0
  );

  const handleAdvance = async (currentStage: string) => {
    let nextStage = "";
    if (currentStage === "round_of_16") nextStage = "quarterfinals";
    else if (currentStage === "quarterfinals") nextStage = "semifinals";
    else if (currentStage === "semifinals" || currentStage === "semifinais") nextStage = "final";

    if (!nextStage) return;

    try {
      setAdvancingStage(currentStage);
      setActionError(null);
      setActionSuccess(null);

      await fetchAPI(`/tournaments/${bracket.tournament_id}/advance-stage`, {
        method: "POST",
        body: JSON.stringify({
          current_stage: currentStage,
          next_stage: nextStage,
        }),
      });

      setActionSuccess(`Fase ${nextStage} gerada com sucesso a partir dos vencedores!`);
      if (onRefresh) onRefresh();
    } catch (err: any) {
      setActionError(err?.message || "Erro ao avançar fase do chaveamento.");
    } finally {
      setAdvancingStage(null);
    }
  };

  const handleDrawBracket = async (mode: "random" | "seeded" = "random") => {
    try {
      setIsDrawingBracket(true);
      setActionError(null);
      setActionSuccess(null);

      const res: any = await fetchAPI(`/tournaments/${bracket.tournament_id}/draw-bracket`, {
        method: "POST",
        body: JSON.stringify({ seed_mode: mode }),
      });

      setActionSuccess(res?.message || "Chaveamento dos playoffs sorteado com sucesso!");
      if (onRefresh) onRefresh();
    } catch (err: any) {
      setActionError(err?.message || "Erro ao sortear chaveamento. Verifique se há equipes cadastradas.");
    } finally {
      setIsDrawingBracket(false);
    }
  };

  if (!availableStages || availableStages.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center p-12 text-center border border-dashed border-border rounded-2xl bg-surface/50">
        <Swords className="w-12 h-12 text-muted mb-3" />
        <h3 className="text-lg font-semibold text-main">Chaveamento ainda não iniciado</h3>
        <p className="text-sm text-muted max-w-md mt-1 mb-5">
          Cadastre as equipes e realize o sorteio para gerar os confrontos eliminatórios de mata-mata.
        </p>

        {isAdmin && (
          <div className="flex items-center gap-3">
            <Button
              variant="primary"
              size="sm"
              disabled={isDrawingBracket}
              onClick={() => handleDrawBracket("random")}
              className="flex items-center gap-1.5 px-4 py-2 font-semibold text-xs"
            >
              <Shuffle className="w-3.5 h-3.5" />
              {isDrawingBracket ? "Sorteando..." : "Sortear Chaves Aleatórias"}
            </Button>
          </div>
        )}

        {actionError && (
          <div className="mt-4 p-3 text-xs text-rose-700 dark:text-rose-300 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800/60 rounded-xl">
            {actionError}
          </div>
        )}
      </div>
    );
  }

  // Verifica se alguma partida já foi encerrada
  const anyMatchFinished = Object.values(bracket.stages).some((matches) =>
    matches.some((m) => m.is_finished)
  );

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Swords className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
          <h3 className="text-sm font-bold text-main uppercase tracking-wider">
            Chaveamento dos Playoffs
          </h3>
        </div>

        {isAdmin && !anyMatchFinished && (
          <button
            onClick={() => handleDrawBracket("random")}
            disabled={isDrawingBracket}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border bg-surface hover:bg-nav-hover text-main dark:border-zinc-700 dark:bg-zinc-800/70 dark:text-zinc-300 text-xs font-semibold transition-all self-start sm:self-auto"
          >
            <Shuffle className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
            {isDrawingBracket ? "Re-sorteando..." : "Re-sortear Chaves"}
          </button>
        )}
      </div>

      {actionError && (
        <div className="p-3 text-sm text-rose-700 dark:text-rose-300 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800/60 rounded-xl">
          {actionError}
        </div>
      )}
      {actionSuccess && (
        <div className="p-3 text-sm text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/60 rounded-xl">
          {actionSuccess}
        </div>
      )}

      {/* Árvore de Chaveamento Responsiva com Scroll Horizontal */}
      <div className="overflow-x-auto pb-4 pt-1">
        <div className="flex items-start gap-8 min-w-max px-2">
          {availableStages.map((stageObj) => {
            const matches = bracket.stages[stageObj.key] || [];
            const canAdvanceThisStage =
              isAdmin &&
              matches.length > 0 &&
              matches.every((m) => m.is_finished) &&
              stageObj.key !== "final" &&
              stageObj.key !== "third_place";

            return (
              <div key={stageObj.key} className="flex flex-col w-72 sm:w-80 shrink-0">
                {/* Header da Fase */}
                <div className="flex items-center justify-between pb-3 mb-4 border-b border-border dark:border-zinc-800">
                  <div className="flex items-center gap-2">
                    {stageObj.key === "final" ? (
                      <Trophy className="w-4 h-4 text-amber-500 dark:text-amber-400" />
                    ) : (
                      <Shield className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                    )}
                    <span className="font-bold text-sm tracking-wide text-main uppercase">
                      {stageObj.label}
                    </span>
                  </div>
                  <span className="text-xs px-2 py-0.5 rounded-full bg-slate-100 text-muted dark:bg-zinc-800 dark:text-zinc-400 border border-border dark:border-transparent">
                    {matches.length} {matches.length === 1 ? "jogo" : "jogos"}
                  </span>
                </div>

                {/* Lista de Partidas da Fase */}
                <div className="flex flex-col gap-4">
                  {matches.map((match) => {
                    const homeWon = match.is_finished && match.winner_team_id === match.home_team_id;
                    const awayWon = match.is_finished && match.winner_team_id === match.away_team_id;

                    return (
                      <div
                        key={match.id_match}
                        className="rounded-xl border border-border bg-surface p-3.5 shadow-sm hover:border-border-hover dark:border-zinc-800/90 dark:bg-zinc-900/80 transition-all"
                      >
                        <div className="flex items-center justify-between text-[11px] text-muted mb-2 border-b border-border dark:border-zinc-800/60 pb-1.5">
                          <span>Jogo #{match.id_match}</span>
                          {match.leg > 1 && (
                            <span className="text-amber-600 dark:text-amber-400/90 font-medium">Volta (Ida & Volta)</span>
                          )}

                          <div className="flex items-center gap-2">
                            <span
                              className={`px-1.5 py-0.5 rounded text-[10px] font-semibold ${
                                match.is_finished
                                  ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400"
                                  : "bg-amber-500/10 text-amber-700 dark:text-amber-400"
                              }`}
                            >
                              {match.is_finished ? "Encerrado" : "A Disputar"}
                            </span>

                            {isAdmin && (
                              <button
                                onClick={() =>
                                  setEditingMatch({
                                    id_match: match.id_match,
                                    tournament_id: bracket.tournament_id,
                                    home_team_id: match.home_team_id,
                                    home_team_name: match.home_team_name,
                                    away_team_id: match.away_team_id,
                                    away_team_name: match.away_team_name,
                                    score_home: match.score_home,
                                    score_away: match.score_away,
                                    penalties_home: match.penalties_home,
                                    penalties_away: match.penalties_away,
                                    stage: match.stage,
                                    is_finished: match.is_finished,
                                  })
                                }
                                title="Editar Placar / Súmula"
                                className="p-1 rounded hover:bg-nav-hover text-muted hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors"
                              >
                                <Edit3 className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>
                        </div>

                        {/* Equipe Mandante */}
                        <div
                          className={`flex items-center justify-between py-1.5 px-2 rounded-lg transition-colors ${
                            homeWon ? "bg-emerald-500/15 font-semibold text-emerald-700 dark:text-emerald-300" : "text-main"
                          }`}
                        >
                          <div className="flex items-center gap-2 truncate">
                            {homeWon && <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />}
                            <span className="text-sm truncate">{match.home_team_name}</span>
                          </div>
                          <div className="flex items-center gap-1.5 text-sm font-mono shrink-0 ml-2">
                            <span>{match.score_home}</span>
                            {match.penalties_home > 0 && (
                              <span className="text-[11px] text-muted">({match.penalties_home})</span>
                            )}
                          </div>
                        </div>

                        {/* Equipe Visitante */}
                        <div
                          className={`flex items-center justify-between py-1.5 px-2 rounded-lg mt-1 transition-colors ${
                            awayWon ? "bg-emerald-500/15 font-semibold text-emerald-700 dark:text-emerald-300" : "text-main"
                          }`}
                        >
                          <div className="flex items-center gap-2 truncate">
                            {awayWon && <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />}
                            <span className="text-sm truncate">{match.away_team_name}</span>
                          </div>
                          <div className="flex items-center gap-1.5 text-sm font-mono shrink-0 ml-2">
                            <span>{match.score_away}</span>
                            {match.penalties_away > 0 && (
                              <span className="text-[11px] text-muted">({match.penalties_away})</span>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Ação de Avançar Fase para Administradores */}
                {canAdvanceThisStage && (
                  <div className="mt-4 pt-3 border-t border-border dark:border-zinc-800">
                    <Button
                      variant="primary"
                      size="sm"
                      className="w-full text-xs font-semibold"
                      disabled={advancingStage === stageObj.key}
                      onClick={() => handleAdvance(stageObj.key)}
                    >
                      {advancingStage === stageObj.key ? "Avançando..." : "Avançar Vencedores"}
                      <ChevronRight className="w-3.5 h-3.5 ml-1" />
                    </Button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Modal de Lançamento de Placar e Súmula Rápida */}
      <MatchResultModal
        isOpen={Boolean(editingMatch)}
        onClose={() => setEditingMatch(null)}
        match={editingMatch}
        onSuccess={() => {
          if (onRefresh) onRefresh();
        }}
      />

      {/* Espaço de Patrocínio / Banner de Anúncio para Plano Free */}
      <TournamentAdBanner placement="bracket_inline" />
    </div>
  );
}

