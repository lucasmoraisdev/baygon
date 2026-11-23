"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Trophy,
  Plus,
  Shield,
  Swords,
  Users,
  Calendar,
  CheckCircle2,
  Sparkles,
  ArrowRight,
  Info,
  Layers,
} from "lucide-react";
import { fetchAPI } from "@/lib/api";
import { useTenant } from "@/context/TenantContext";
import { Loading } from "@/components/Loading";
import { Button } from "@/components/Button";
import { Modal } from "@/components/Modal";
import { TournamentAdBanner } from "@/components/TournamentAdBanner";

interface Tournament {
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

interface QuotaResponse {
  plan_code: string;
  plan_name: string;
  tournaments_created: number;
  tournaments_limit: number;
  tournaments_remaining: number;
  can_create: boolean;
  upgrade_required: boolean;
}

const FORMAT_CONFIGS = {
  pontos_corridos: {
    label: "Pontos Corridos",
    icon: Shield,
    badgeColor: "bg-blue-500/10 text-blue-400 border-blue-500/20",
    description: "Liga com equipes fixas, tabela de pontuação e classificação por vitórias e empates.",
  },
  mata_mata: {
    label: "Mata-Mata",
    icon: Swords,
    badgeColor: "bg-rose-500/10 text-rose-400 border-rose-500/20",
    description: "Chaveamento eliminatório com oitavas, quartas, semi e grande final. Jogo único ou ida e volta.",
  },
  grupos_e_mata_mata: {
    label: "Grupos + Mata-Mata",
    icon: Layers,
    badgeColor: "bg-amber-500/10 text-amber-400 border-amber-500/20",
    description: "Fase inicial de grupos com classificação para a fase final eliminatória dos playoffs.",
  },
  individual_points: {
    label: "Pelada Individual",
    icon: Users,
    badgeColor: "bg-purple-500/10 text-purple-400 border-purple-500/20",
    description: "Formato tradicional com pontuações individuais e sorteio de times a cada rodada.",
  },
};

export default function TournamentsPage() {
  const queryClient = useQueryClient();
  const { tenant, isFreePlan } = useTenant();

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isUpgradeModalOpen, setIsUpgradeModalOpen] = useState(false);

  // Form states
  const [name, setName] = useState("");
  const [tournamentFormat, setTournamentFormat] = useState<
    "pontos_corridos" | "mata_mata" | "grupos_e_mata_mata" | "individual_points"
  >("pontos_corridos");
  const [hasLegs, setHasLegs] = useState(false);
  const [teamsPerGroup, setTeamsPerGroup] = useState<number>(4);
  const [advancingPerGroup, setAdvancingPerGroup] = useState<number>(2);
  const [initialDate, setInitialDate] = useState(new Date().toISOString().split("T")[0]);
  const [formError, setFormError] = useState<string | null>(null);

  // Queries
  const { data: tournaments = [], isLoading } = useQuery<Tournament[]>({
    queryKey: ["tournaments"],
    queryFn: () => fetchAPI("/tournaments/"),
  });

  const { data: quota } = useQuery<QuotaResponse>({
    queryKey: ["tournament_quota"],
    queryFn: () => fetchAPI("/tournaments/quota"),
  });

  const createMutation = useMutation({
    mutationFn: (body: any) =>
      fetchAPI("/tournaments/", {
        method: "POST",
        body: JSON.stringify(body),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tournaments"] });
      queryClient.invalidateQueries({ queryKey: ["tournament_quota"] });
      setIsModalOpen(false);
      resetForm();
    },
    onError: (err: any) => {
      setFormError(err?.message || "Erro ao criar torneio. Verifique as regras e cotas do plano.");
    },
  });

  const resetForm = () => {
    setName("");
    setTournamentFormat("pontos_corridos");
    setHasLegs(false);
    setTeamsPerGroup(4);
    setAdvancingPerGroup(2);
    setInitialDate(new Date().toISOString().split("T")[0]);
    setFormError(null);
  };

  const handleOpenCreateModal = () => {
    // Se cota estourou, abre modal de upgrade
    if (quota && !quota.can_create) {
      setIsUpgradeModalOpen(true);
      return;
    }
    setFormError(null);
    setIsModalOpen(true);
  };

  const handleCreateSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setFormError("Informe o nome do torneio.");
      return;
    }

    const payload: any = {
      name: name.trim(),
      tournament_format: tournamentFormat,
      has_legs: hasLegs,
      initial_date: new Date(initialDate).toISOString(),
    };

    if (tournamentFormat === "grupos_e_mata_mata") {
      payload.teams_per_group = teamsPerGroup;
      payload.advancing_per_group = advancingPerGroup;
    }

    createMutation.mutate(payload);
  };

  if (isLoading) return <Loading />;

  const isUnlimited = quota?.tournaments_limit === -1;

  return (
    <div className="flex flex-col gap-6 animate-slide-down pb-12">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-2xl sm:text-3xl font-bold text-zinc-100">Torneios & Ligas</h1>
            <span className="p-1.5 rounded-lg bg-emerald-500/10 text-emerald-400">
              <Trophy className="w-5 h-5" />
            </span>
          </div>
          <p className="text-xs sm:text-sm text-zinc-400 mt-1">
            Crie e gerencie competições em Pontos Corridos, Mata-Mata e Fase de Grupos.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {/* Badge de Cota do Plano */}
          {quota && (
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl border border-border bg-surface text-xs dark:border-zinc-800 dark:bg-zinc-900/80 shadow-sm">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              <span className="text-muted font-medium">
                {isUnlimited ? (
                  <span className="text-main font-semibold">Torneios Ilimitados</span>
                ) : (
                  <>
                    <strong className="text-emerald-600 dark:text-emerald-400 font-bold">{quota.tournaments_created}</strong>
                    {" / "}
                    <span className="text-main">{quota.tournaments_limit}</span> torneios criados ({quota.plan_name})
                  </>
                )}
              </span>
            </div>
          )}

          <button
            onClick={handleOpenCreateModal}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-sm shadow-md shadow-emerald-600/20 transition-all hover:scale-[1.02] active:scale-[0.98] dark:bg-emerald-500 dark:hover:bg-emerald-400 dark:text-zinc-950"
          >
            <Plus className="w-4 h-4" />
            Novo Torneio
          </button>
        </div>
      </div>

      {/* Banner de Anúncios e Patrocínios para Plano Free */}
      <TournamentAdBanner placement="top_banner" />

      {/* Grid de Torneios */}
      {tournaments.length === 0 ? (
        <div className="flex flex-col items-center justify-center p-12 text-center border border-dashed border-border rounded-2xl bg-surface/50">
          <Trophy className="w-12 h-12 text-muted mb-3" />
          <h3 className="text-lg font-semibold text-main">Nenhum torneio cadastrado</h3>
          <p className="text-sm text-muted max-w-md mt-1 mb-5">
            Crie seu primeiro campeonato de pontos corridos, mata-mata ou fase de grupos agora mesmo!
          </p>
          <button
            onClick={handleOpenCreateModal}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-sm dark:bg-emerald-500 dark:hover:bg-emerald-400 dark:text-zinc-950"
          >
            <Plus className="w-4 h-4" />
            Criar Primeiro Torneio
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {tournaments.map((tourn) => {
            const config = FORMAT_CONFIGS[tourn.tournament_format] || FORMAT_CONFIGS.pontos_corridos;
            const FormatIcon = config.icon;

            return (
              <div
                key={tourn.id_season}
                className="group relative flex flex-col justify-between rounded-2xl border border-border bg-surface p-5 hover:border-emerald-500/40 hover:bg-nav-hover dark:border-zinc-800/90 dark:bg-zinc-900/70 dark:hover:bg-zinc-900 transition-all shadow-sm"
              >
                <div>
                  {/* Top tags */}
                  <div className="flex items-center justify-between gap-2 mb-3">
                    <span
                      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border ${config.badgeColor}`}
                    >
                      <FormatIcon className="w-3.5 h-3.5" />
                      {config.label}
                    </span>

                    <span
                      className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${
                        tourn.is_active
                          ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/20"
                          : "bg-slate-100 text-muted dark:bg-zinc-800 dark:text-zinc-400 border border-border dark:border-transparent"
                      }`}
                    >
                      {tourn.is_active ? "Em Andamento" : "Finalizado"}
                    </span>
                  </div>

                  {/* Nome e Edição */}
                  <h3 className="text-lg font-bold text-main group-hover:text-emerald-600 dark:group-hover:text-emerald-400 transition-colors">
                    {tourn.name || `Temporada #${tourn.number}`}
                  </h3>
                  <p className="text-xs text-muted mt-0.5">Edição #{tourn.number}</p>

                  <p className="text-xs text-muted mt-2.5 line-clamp-2">
                    {config.description}
                  </p>
                </div>

                <div className="mt-5 pt-4 border-t border-border dark:border-zinc-800/80 flex items-center justify-between">
                  <div className="flex items-center gap-1.5 text-xs text-muted">
                    <Calendar className="w-3.5 h-3.5 text-muted" />
                    <span>
                      {new Date(tourn.initial_date).toLocaleDateString("pt-BR", {
                        day: "2-digit",
                        month: "short",
                        year: "numeric",
                      })}
                    </span>
                  </div>

                  <Link
                    href={`/tournaments/${tourn.id_season}`}
                    className="flex items-center gap-1 text-xs font-semibold text-emerald-600 dark:text-emerald-400 group-hover:translate-x-0.5 transition-transform"
                  >
                    Abrir Torneio
                    <ArrowRight className="w-3.5 h-3.5" />
                  </Link>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Modal de Criação de Novo Torneio */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title="Novo Campeonato / Torneio"
      >
        <form onSubmit={handleCreateSubmit} className="flex flex-col gap-4">
          {formError && (
            <div className="p-3 text-sm text-rose-700 dark:text-rose-300 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800/60 rounded-xl">
              {formError}
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-muted mb-1.5">
              Nome do Torneio
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ex: Copa Baygon dos Campeões 2026"
              className="w-full px-3.5 py-2.5 rounded-xl bg-surface border border-border text-main text-sm focus:border-emerald-500 focus:outline-none dark:bg-zinc-950 dark:border-zinc-800 dark:text-zinc-100 shadow-sm"
              required
            />
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-muted mb-2">
              Selecione o Formato da Competição
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {(
                [
                  "pontos_corridos",
                  "mata_mata",
                  "grupos_e_mata_mata",
                  "individual_points",
                ] as const
              ).map((fmt) => {
                const cfg = FORMAT_CONFIGS[fmt];
                const Icon = cfg.icon;
                const isSelected = tournamentFormat === fmt;

                return (
                  <button
                    key={fmt}
                    type="button"
                    onClick={() => setTournamentFormat(fmt)}
                    className={`flex flex-col text-left p-3 rounded-xl border transition-all ${
                      isSelected
                        ? "border-emerald-500 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 font-medium"
                        : "border-border bg-surface text-main hover:border-border-hover dark:border-zinc-800 dark:bg-zinc-900/60 dark:text-zinc-300 dark:hover:border-zinc-700"
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <Icon className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                      <span className="text-xs font-bold text-main">{cfg.label}</span>
                    </div>
                    <span className="text-[11px] text-muted mt-1 line-clamp-2">
                      {cfg.description}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Configurações extras de acordo com o formato */}
          {(tournamentFormat === "mata_mata" || tournamentFormat === "grupos_e_mata_mata") && (
            <div className="p-3.5 rounded-xl border border-border bg-slate-50 dark:border-zinc-800 dark:bg-zinc-900/40 flex items-center justify-between">
              <div>
                <span className="text-xs font-semibold text-main">Jogos de Ida e Volta?</span>
                <p className="text-[11px] text-muted">
                  Habilita 2 confrontos por chave com critérios de desempate
                </p>
              </div>
              <input
                type="checkbox"
                checked={hasLegs}
                onChange={(e) => setHasLegs(e.target.checked)}
                className="w-4 h-4 rounded text-emerald-600 dark:text-emerald-500 accent-emerald-500 cursor-pointer"
              />
            </div>
          )}

          {tournamentFormat === "grupos_e_mata_mata" && (
            <div className="grid grid-cols-2 gap-3 p-3.5 rounded-xl border border-border bg-slate-50 dark:border-zinc-800 dark:bg-zinc-900/40">
              <div>
                <label className="block text-[11px] font-semibold text-muted mb-1">
                  Times por Grupo
                </label>
                <input
                  type="number"
                  min={2}
                  max={16}
                  value={teamsPerGroup}
                  onChange={(e) => setTeamsPerGroup(parseInt(e.target.value) || 4)}
                  className="w-full px-3 py-1.5 rounded-lg bg-surface border border-border text-sm text-main dark:bg-zinc-950 dark:border-zinc-800 dark:text-zinc-100"
                />
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-muted mb-1">
                  Classificados por Grupo
                </label>
                <input
                  type="number"
                  min={1}
                  max={8}
                  value={advancingPerGroup}
                  onChange={(e) => setAdvancingPerGroup(parseInt(e.target.value) || 2)}
                  className="w-full px-3 py-1.5 rounded-lg bg-surface border border-border text-sm text-main dark:bg-zinc-950 dark:border-zinc-800 dark:text-zinc-100"
                />
              </div>
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-muted mb-1.5">
              Data de Início
            </label>
            <input
              type="date"
              value={initialDate}
              onChange={(e) => setInitialDate(e.target.value)}
              className="w-full px-3.5 py-2 rounded-xl bg-surface border border-border text-main text-sm focus:border-emerald-500 focus:outline-none dark:bg-zinc-950 dark:border-zinc-800 dark:text-zinc-100 shadow-sm"
            />
          </div>

          <div className="flex items-center justify-end gap-2 mt-4 pt-3 border-t border-border dark:border-zinc-800">
            <button
              type="button"
              onClick={() => setIsModalOpen(false)}
              className="px-4 py-2 rounded-xl text-xs font-semibold text-muted hover:text-main transition-colors"
            >
              Cancelar
            </button>
            <Button
              type="submit"
              variant="primary"
              size="sm"
              disabled={createMutation.isPending}
              className="px-5 py-2 font-semibold"
            >
              {createMutation.isPending ? "Criando..." : "Criar Torneio"}
            </Button>
          </div>
        </form>
      </Modal>

      {/* Modal de Alerta de Upgrade de Plano */}
      <Modal
        isOpen={isUpgradeModalOpen}
        onClose={() => setIsUpgradeModalOpen(false)}
        title="Limite de Torneios Atingido"
      >
        <div className="flex flex-col items-center text-center p-2">
          <div className="w-14 h-14 rounded-2xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-500 dark:text-amber-400 mb-4">
            <Sparkles className="w-7 h-7" />
          </div>

          <h3 className="text-lg font-bold text-main">
            Você atingiu o limite do {quota?.plan_name || "seu plano"}
          </h3>
          <p className="text-sm text-muted mt-2 max-w-sm">
            Seu plano atual permite criar até <strong>{quota?.tournaments_limit} torneios</strong>.
            Faça upgrade para o Plano Pro para criar torneios ilimitados e desbloquear chaveamentos
            avançados sem anúncios.
          </p>

          <div className="w-full mt-6 flex flex-col gap-2">
            <a
              href="/subscription"
              className="w-full py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-sm text-center shadow-lg shadow-emerald-600/20 transition-all dark:bg-emerald-500 dark:hover:bg-emerald-400 dark:text-zinc-950"
            >
              Conhecer Planos & Fazer Upgrade
            </a>
            <button
              onClick={() => setIsUpgradeModalOpen(false)}
              className="w-full py-2 text-xs font-semibold text-muted hover:text-main transition-colors"
            >
              Talvez mais tarde
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
