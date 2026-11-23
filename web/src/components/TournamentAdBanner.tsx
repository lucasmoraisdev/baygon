"use client";

import React from "react";
import { Sparkles, ArrowRight, ShieldCheck, Megaphone } from "lucide-react";
import { useTenant } from "@/context/TenantContext";

interface TournamentAdBannerProps {
  placement?: "top_banner" | "bracket_inline" | "standings_footer";
  customMessage?: string;
}

export function TournamentAdBanner({
  placement = "top_banner",
  customMessage,
}: TournamentAdBannerProps) {
  const { tenant } = useTenant();
  const currentPlanCode =
    tenant?.plan?.code || tenant?.tournament_quota?.plan_code || "free";
  const isPro = currentPlanCode === "pro_all_inclusive";
  const isBasic = currentPlanCode === "basic";

  // Plano Completo Pro: 0 anúncios total (zero AdSense e zero banners)
  if (isPro) {
    return null;
  }

  // Plano Básico (Plano 2): Livre de anúncios AdSense e popups de rede.
  // Permite apenas banners próprios para patrocínios diretos da liga (bracket_inline / sponsor direct).
  if (isBasic && placement !== "bracket_inline") {
    return null;
  }

  if (placement === "bracket_inline") {
    return (
      <div className="w-full my-6 p-4 rounded-xl border border-dashed border-emerald-500/30 bg-emerald-500/5 text-emerald-800 dark:text-emerald-200 flex flex-col md:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
            <Megaphone className="w-5 h-5" />
          </div>
          <div>
            <span className="text-xs uppercase font-bold tracking-wider text-emerald-600 dark:text-emerald-400/80">
              Espaço Patrocinador Oficial
            </span>
            <p className="text-sm text-main dark:text-zinc-300">
              {customMessage || "Anuncie a marca da sua empresa na maior liga da região!"}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <a
            href="mailto:parcerias@baygon.com.br?subject=Patrocinio%20Liga"
            className="text-xs font-semibold px-3 py-1.5 rounded-lg bg-emerald-600/15 hover:bg-emerald-600/25 text-emerald-700 dark:bg-emerald-600/30 dark:hover:bg-emerald-600/50 dark:text-emerald-300 transition-colors"
          >
            Seja um Patrocinador
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="relative overflow-hidden w-full my-4 rounded-2xl bg-gradient-to-r from-surface via-surface to-emerald-500/10 border border-border p-4 sm:p-5 shadow-sm dark:shadow-lg dark:from-zinc-900 dark:via-zinc-900/90 dark:to-emerald-950/40 dark:border-zinc-800/80">
      <div className="absolute top-0 right-0 -mt-8 -mr-8 w-32 h-32 rounded-full bg-emerald-500/10 blur-2xl pointer-events-none" />

      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 relative z-10">
        <div className="flex items-start sm:items-center gap-3.5">
          <div className="w-10 h-10 rounded-xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-emerald-600 dark:text-emerald-400 shrink-0">
            <Sparkles className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/20">
                Plano Gratuito
              </span>
              <span className="text-xs text-muted">
                {tenant?.tournament_quota
                  ? `${tenant.tournament_quota.tournaments_created}/${tenant.tournament_quota.tournaments_limit} torneios utilizados`
                  : "Cota de 2 torneios"}
              </span>
            </div>
            <p className="text-sm font-medium text-main mt-1">
              Gere torneios ilimitados, remova todos os anúncios e libere chaveamento Pro!
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3 self-end sm:self-center shrink-0">
          <a
            href="/subscription"
            className="flex items-center gap-1.5 text-xs font-semibold px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white shadow-md shadow-emerald-600/20 transition-all hover:scale-[1.02] active:scale-[0.98] dark:bg-emerald-500 dark:hover:bg-emerald-400 dark:text-zinc-950"
          >
            Fazer Upgrade Pro
            <ArrowRight className="w-3.5 h-3.5" />
          </a>
        </div>
      </div>
    </div>
  );
}
