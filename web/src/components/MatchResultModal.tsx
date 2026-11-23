"use client";

import React, { useState, useEffect } from "react";
import { Modal } from "@/components/Modal";
import { Button } from "@/components/Button";
import { fetchAPI } from "@/lib/api";
import { Trophy, CheckCircle2, Shield, AlertCircle } from "lucide-react";

export interface MatchToEdit {
  id_match: number;
  tournament_id: number;
  home_team_id: number;
  home_team_name: string;
  home_team_color?: string | null;
  away_team_id: number;
  away_team_name: string;
  away_team_color?: string | null;
  score_home: number;
  score_away: number;
  penalties_home?: number;
  penalties_away?: number;
  stage?: string;
  is_finished?: boolean;
}

interface MatchResultModalProps {
  isOpen: boolean;
  onClose: () => void;
  match: MatchToEdit | null;
  onSuccess: () => void;
}

export function MatchResultModal({
  isOpen,
  onClose,
  match,
  onSuccess,
}: MatchResultModalProps) {
  const [scoreHome, setScoreHome] = useState<number>(0);
  const [scoreAway, setScoreAway] = useState<number>(0);
  const [penaltiesHome, setPenaltiesHome] = useState<number>(0);
  const [penaltiesAway, setPenaltiesAway] = useState<number>(0);
  const [isFinished, setIsFinished] = useState<boolean>(true);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    if (match) {
      setScoreHome(match.score_home ?? 0);
      setScoreAway(match.score_away ?? 0);
      setPenaltiesHome(match.penalties_home ?? 0);
      setPenaltiesAway(match.penalties_away ?? 0);
      setIsFinished(match.is_finished ?? true);
      setErrorMessage(null);
    }
  }, [match]);

  if (!match) return null;

  const isPlayoff =
    match.stage &&
    match.stage !== "regular" &&
    match.stage !== "group";

  const isTied = scoreHome === scoreAway;
  const showPenalties = isPlayoff || (isTied && (penaltiesHome > 0 || penaltiesAway > 0));

  // Determina vencedor projetado
  let projectedWinner = null;
  if (scoreHome > scoreAway) {
    projectedWinner = match.home_team_name;
  } else if (scoreAway > scoreHome) {
    projectedWinner = match.away_team_name;
  } else if (showPenalties) {
    if (penaltiesHome > penaltiesAway) projectedWinner = match.home_team_name;
    else if (penaltiesAway > penaltiesHome) projectedWinner = match.away_team_name;
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isPlayoff && isFinished && isTied && penaltiesHome === penaltiesAway) {
      setErrorMessage("Em partidas eliminatórias de mata-mata com empate, defina o vencedor nos pênaltis.");
      return;
    }

    try {
      setIsLoading(true);
      setErrorMessage(null);

      await fetchAPI(
        `/tournaments/${match.tournament_id}/matches/${match.id_match}/result`,
        {
          method: "PUT",
          body: JSON.stringify({
            score_home: Number(scoreHome),
            score_away: Number(scoreAway),
            penalties_home: Number(penaltiesHome),
            penalties_away: Number(penaltiesAway),
            is_finished: Boolean(isFinished),
          }),
        }
      );

      onSuccess();
      onClose();
    } catch (err: any) {
      setErrorMessage(err?.message || "Erro ao salvar resultado da partida.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Súmula / Placar da Partida">
      <form onSubmit={handleSubmit} className="flex flex-col gap-5">
        {errorMessage && (
          <div className="p-3 text-sm text-rose-300 bg-rose-950/40 border border-rose-800/60 rounded-xl flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
            <span>{errorMessage}</span>
          </div>
        )}

        {/* Header do Confronto */}
        <div className="flex items-center justify-between text-xs text-muted border-b border-border dark:border-zinc-800 pb-2">
          <span>Partida #{match.id_match}</span>
          {match.stage && (
            <span className="capitalize px-2 py-0.5 rounded-full bg-slate-100 text-muted dark:bg-zinc-800 dark:text-zinc-300 border border-border dark:border-transparent font-semibold">
              {match.stage.replace(/_/g, " ")}
            </span>
          )}
        </div>

        {/* Placar Principal (Tempo Normal) */}
        <div className="grid grid-cols-5 items-center gap-2 py-2">
          {/* Mandante */}
          <div className="col-span-2 flex flex-col items-center text-center">
            <div
              className="w-8 h-8 rounded-full mb-2 border border-border dark:border-zinc-700 shadow-sm"
              style={{ backgroundColor: match.home_team_color || "#10b981" }}
            />
            <span className="text-sm font-bold text-main truncate w-full px-1">
              {match.home_team_name}
            </span>
            <span className="text-[10px] text-muted uppercase tracking-wider mt-0.5">Mandante</span>
            <input
              type="number"
              min={0}
              max={99}
              value={scoreHome}
              onChange={(e) => setScoreHome(parseInt(e.target.value) || 0)}
              className="w-16 h-12 text-center text-2xl font-mono font-bold rounded-xl bg-surface border border-border text-main focus:border-emerald-500 focus:outline-none dark:bg-zinc-950 dark:border-zinc-800 dark:text-zinc-100 mt-3 shadow-sm"
            />
          </div>

          {/* Divisor X */}
          <div className="col-span-1 flex flex-col items-center justify-center">
            <span className="text-xl font-bold text-muted/60 font-mono">VS</span>
          </div>

          {/* Visitante */}
          <div className="col-span-2 flex flex-col items-center text-center">
            <div
              className="w-8 h-8 rounded-full mb-2 border border-border dark:border-zinc-700 shadow-sm"
              style={{ backgroundColor: match.away_team_color || "#3b82f6" }}
            />
            <span className="text-sm font-bold text-main truncate w-full px-1">
              {match.away_team_name}
            </span>
            <span className="text-[10px] text-muted uppercase tracking-wider mt-0.5">Visitante</span>
            <input
              type="number"
              min={0}
              max={99}
              value={scoreAway}
              onChange={(e) => setScoreAway(parseInt(e.target.value) || 0)}
              className="w-16 h-12 text-center text-2xl font-mono font-bold rounded-xl bg-surface border border-border text-main focus:border-emerald-500 focus:outline-none dark:bg-zinc-950 dark:border-zinc-800 dark:text-zinc-100 mt-3 shadow-sm"
            />
          </div>
        </div>

        {/* Disputa de Pênaltis (Mata-mata ou desempate) */}
        {showPenalties && (
          <div className="p-3.5 rounded-xl border border-border bg-slate-50 dark:border-zinc-800 dark:bg-zinc-900/50 flex flex-col gap-2">
            <span className="text-xs font-semibold text-amber-600 dark:text-amber-400">
              Disputa de Pênaltis (Desempate Eliminatório)
            </span>
            <div className="grid grid-cols-5 items-center gap-2">
              <div className="col-span-2 flex items-center justify-center gap-2">
                <input
                  type="number"
                  min={0}
                  max={99}
                  value={penaltiesHome}
                  onChange={(e) => setPenaltiesHome(parseInt(e.target.value) || 0)}
                  className="w-12 h-9 text-center text-sm font-mono font-bold rounded-lg bg-surface border border-border text-amber-600 dark:text-amber-300 focus:border-amber-500 dark:bg-zinc-950 dark:border-zinc-800 shadow-sm"
                />
                <span className="text-xs text-muted truncate">{match.home_team_name}</span>
              </div>
              <span className="col-span-1 text-center text-xs text-muted font-bold">Pên.</span>
              <div className="col-span-2 flex items-center justify-center gap-2">
                <span className="text-xs text-muted truncate">{match.away_team_name}</span>
                <input
                  type="number"
                  min={0}
                  max={99}
                  value={penaltiesAway}
                  onChange={(e) => setPenaltiesAway(parseInt(e.target.value) || 0)}
                  className="w-12 h-9 text-center text-sm font-mono font-bold rounded-lg bg-surface border border-border text-amber-600 dark:text-amber-300 focus:border-amber-500 dark:bg-zinc-950 dark:border-zinc-800 shadow-sm"
                />
              </div>
            </div>
          </div>
        )}

        {/* Vencedor Projetado */}
        {projectedWinner && (
          <div className="flex items-center gap-2 p-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-700 dark:text-emerald-300 text-xs">
            <Trophy className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
            <span>
              Vencedor / Classificado: <strong>{projectedWinner}</strong>
            </span>
          </div>
        )}

        {/* Checkbox de Finalização */}
        <div className="flex items-center justify-between p-3 rounded-xl border border-border bg-slate-50 dark:border-zinc-800 dark:bg-zinc-900/30">
          <div>
            <span className="text-xs font-semibold text-main">Finalizar Partida</span>
            <p className="text-[11px] text-muted">
              Marca o jogo como encerrado e computa pontos na classificação e avanço do chaveamento.
            </p>
          </div>
          <input
            type="checkbox"
            checked={isFinished}
            onChange={(e) => setIsFinished(e.target.checked)}
            className="w-4 h-4 rounded text-emerald-600 dark:text-emerald-500 accent-emerald-500 cursor-pointer"
          />
        </div>

        {/* Ações */}
        <div className="flex items-center justify-end gap-2 pt-2 border-t border-border dark:border-zinc-800">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-xs font-semibold text-muted hover:text-main transition-colors"
          >
            Cancelar
          </button>
          <Button
            type="submit"
            variant="primary"
            size="sm"
            disabled={isLoading}
            className="px-5 py-2 font-semibold"
          >
            {isLoading ? "Salvando..." : "Salvar Placar"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
