"use client";

import React, { useState } from "react";
import { Shield, Trophy } from "lucide-react";

export interface TeamStandingRow {
  position: number;
  team_id: number;
  team_name: string;
  color?: string | null;
  group_name?: string | null;
  matches_played: number;
  points: number;
  wins: number;
  draws: number;
  losses: number;
  goals_for: number;
  goals_against: number;
  goal_difference: number;
  win_percentage: number;
}

export interface TournamentStandingsData {
  tournament_id: number;
  tournament_name?: string | null;
  tournament_format: string;
  standings: TeamStandingRow[];
  groups?: Record<string, TeamStandingRow[]> | null;
}

interface TournamentStandingsTableProps {
  standingsData: TournamentStandingsData;
  advancingPerGroup?: number | null;
}

export function TournamentStandingsTable({
  standingsData,
  advancingPerGroup = 2,
}: TournamentStandingsTableProps) {
  const { standings, groups, tournament_format } = standingsData;

  const hasGroups =
    tournament_format === "grupos_e_mata_mata" && groups && Object.keys(groups).length > 0;

  const [selectedGroup, setSelectedGroup] = useState<string>(
    hasGroups ? Object.keys(groups!)[0] : ""
  );

  const renderTableRows = (rows: TeamStandingRow[], cutoff: number) => {
    if (!rows || rows.length === 0) {
      return (
        <tr>
          <td colSpan={10} className="text-center py-8 text-muted text-sm">
            Nenhuma partida disputada ainda.
          </td>
        </tr>
      );
    }

    return rows.map((row) => {
      const isAdvancing = cutoff > 0 && row.position <= cutoff;

      return (
        <tr
          key={row.team_id}
          className={`border-b border-border dark:border-zinc-800/60 hover:bg-slate-50/80 dark:hover:bg-zinc-800/30 transition-colors ${
            isAdvancing ? "bg-emerald-500/[0.04]" : ""
          }`}
        >
          {/* Posição */}
          <td className="py-3 px-3 text-center">
            <span
              className={`inline-flex items-center justify-center w-6 h-6 rounded-full text-xs font-bold ${
                row.position === 1
                  ? "bg-amber-500/20 text-amber-600 dark:text-amber-300 border border-amber-500/40"
                  : isAdvancing
                  ? "bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30"
                  : "bg-surface border border-border text-muted dark:bg-zinc-800 dark:text-zinc-400 dark:border-transparent"
              }`}
            >
              {row.position}
            </span>
          </td>

          {/* Time */}
          <td className="py-3 px-3 font-medium text-main">
            <div className="flex items-center gap-2.5">
              <div
                className="w-3.5 h-3.5 rounded-full shrink-0 border border-border dark:border-zinc-700 shadow-sm"
                style={{ backgroundColor: row.color || "#10b981" }}
              />
              <span className="truncate max-w-[140px] sm:max-w-none text-sm">{row.team_name}</span>
            </div>
          </td>

          {/* Pontos (P) */}
          <td className="py-3 px-2 text-center font-bold text-main bg-slate-50/60 dark:bg-zinc-800/20">
            {row.points}
          </td>

          {/* Jogos (J) */}
          <td className="py-3 px-2 text-center text-muted text-xs sm:text-sm">{row.matches_played}</td>

          {/* Vitórias (V) */}
          <td className="py-3 px-2 text-center text-emerald-600 dark:text-emerald-400 font-semibold text-xs sm:text-sm">
            {row.wins}
          </td>

          {/* Empates (E) */}
          <td className="py-3 px-2 text-center text-amber-600 dark:text-amber-400 font-medium text-xs sm:text-sm">
            {row.draws}
          </td>

          {/* Derrotas (D) */}
          <td className="py-3 px-2 text-center text-rose-600 dark:text-rose-400 font-medium text-xs sm:text-sm">
            {row.losses}
          </td>

          {/* Gols Pró (GP) */}
          <td className="py-3 px-2 text-center text-muted hidden md:table-cell text-xs sm:text-sm">
            {row.goals_for}
          </td>

          {/* Gols Contra (GC) */}
          <td className="py-3 px-2 text-center text-muted hidden md:table-cell text-xs sm:text-sm">
            {row.goals_against}
          </td>

          {/* Saldo de Gols (SG) */}
          <td className="py-3 px-2 text-center font-semibold text-xs sm:text-sm">
            <span
              className={
                row.goal_difference > 0
                  ? "text-emerald-600 dark:text-emerald-400"
                  : row.goal_difference < 0
                  ? "text-rose-600 dark:text-rose-400"
                  : "text-muted"
              }
            >
              {row.goal_difference > 0 ? `+${row.goal_difference}` : row.goal_difference}
            </span>
          </td>

          {/* % Aproveitamento */}
          <td className="py-3 px-3 text-center text-muted font-mono text-xs hidden sm:table-cell">
            {row.win_percentage.toFixed(1)}%
          </td>
        </tr>
      );
    });
  };

  return (
    <div className="flex flex-col gap-4">
      {/* Seletor de Grupos quando no formato grupos_e_mata_mata */}
      {hasGroups && (
        <div className="flex items-center gap-2 overflow-x-auto pb-1">
          {Object.keys(groups!).map((groupName) => (
            <button
              key={groupName}
              onClick={() => setSelectedGroup(groupName)}
              className={`px-4 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition-all ${
                selectedGroup === groupName
                  ? "bg-emerald-600 dark:bg-emerald-500 text-white dark:text-zinc-950 font-bold shadow-md shadow-emerald-500/20"
                  : "bg-surface text-muted hover:bg-nav-hover hover:text-main border border-border dark:bg-zinc-800/80 dark:text-zinc-300 dark:border-zinc-700/60"
              }`}
            >
              {groupName}
            </button>
          ))}
        </div>
      )}

      {/* Tabela de Classificação */}
      <div className="overflow-x-auto rounded-2xl border border-border bg-surface shadow-sm dark:border-zinc-800 dark:bg-zinc-900/60">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-border bg-slate-50 text-[11px] font-bold uppercase tracking-wider text-muted dark:border-zinc-800 dark:bg-zinc-900/90">
              <th className="py-3 px-3 text-center w-12">#</th>
              <th className="py-3 px-3">Equipe</th>
              <th className="py-3 px-2 text-center w-12 text-main">P</th>
              <th className="py-3 px-2 text-center w-10">J</th>
              <th className="py-3 px-2 text-center w-10">V</th>
              <th className="py-3 px-2 text-center w-10">E</th>
              <th className="py-3 px-2 text-center w-10">D</th>
              <th className="py-3 px-2 text-center w-10 hidden md:table-cell">GP</th>
              <th className="py-3 px-2 text-center w-10 hidden md:table-cell">GC</th>
              <th className="py-3 px-2 text-center w-12">SG</th>
              <th className="py-3 px-3 text-center w-16 hidden sm:table-cell">%</th>
            </tr>
          </thead>
          <tbody>
            {hasGroups && groups && groups[selectedGroup]
              ? renderTableRows(groups[selectedGroup], advancingPerGroup || 2)
              : renderTableRows(standings, 1)}
          </tbody>
        </table>
      </div>

      {/* Legenda */}
      <div className="flex flex-wrap items-center gap-4 text-xs text-muted px-1">
        <div className="flex items-center gap-2">
          <span className="w-3 h-3 rounded-full bg-emerald-500/30 border border-emerald-500" />
          <span>Zona de Classificação para Playoffs</span>
        </div>
        <span className="text-border dark:text-zinc-600">|</span>
        <span>P: Pontos • J: Jogos • V: Vitórias • E: Empates • D: Derrotas • SG: Saldo de Gols</span>
      </div>
    </div>
  );
}
