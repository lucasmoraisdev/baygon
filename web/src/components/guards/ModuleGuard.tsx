"use client";

import React from "react";
import Link from "next/link";
import { ArrowLeft, ShieldAlert, Loader2 } from "lucide-react";
import { useTenant } from "@/context/TenantContext";
import { useAuth } from "@/context/AuthContext";
import ModuleUpgradeHero from "./ModuleUpgradeHero";

interface ModuleGuardProps {
  module: "fantasy" | "financial" | "gamification" | "competitions" | string;
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

export default function ModuleGuard({ module, children, fallback }: ModuleGuardProps) {
  const { hasModule, isLoading, tenant } = useTenant();
  const { user } = useAuth();
  const isAdmin = Boolean(user?.is_admin || user?.role === "admin");

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh] p-8 text-slate-400">
        <Loader2 className="w-8 h-8 animate-spin text-emerald-500 mb-3" />
        <p className="text-sm">Verificando permissões da associação...</p>
      </div>
    );
  }

  // Se a associação possui o módulo ativo, renderiza normalmente
  if (hasModule(module)) {
    return <>{children}</>;
  }

  // Se foi fornecido um fallback customizado, respeita o fallback
  if (fallback) {
    return <>{fallback}</>;
  }

  // Se o usuário logado for Administrador/Diretoria -> Exibe Hero de Apresentação e Upsell
  if (isAdmin) {
    return <ModuleUpgradeHero moduleCode={module} />;
  }

  // Se for Sócio/Atleta comum -> Experiência neutra, sem ruído de vendas
  return (
    <div className="w-full max-w-xl mx-auto py-16 px-4 text-center">
      <div className="p-8 rounded-3xl border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-900/60 shadow-lg">
        <div className="w-14 h-14 rounded-2xl bg-slate-100 dark:bg-white/5 text-slate-500 dark:text-slate-400 flex items-center justify-center mx-auto mb-4">
          <ShieldAlert size={28} />
        </div>
        <h2 className="text-xl font-bold text-slate-900 dark:text-white tracking-tight">
          Recurso Indisponível
        </h2>
        <p className="mt-2 text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
          Esta funcionalidade não está habilitada para a associação{" "}
          <strong className="text-slate-900 dark:text-white">{tenant?.name || "atual"}</strong>.
          Caso tenha dúvidas sobre a programação ou regras do torneio, procure a diretoria da liga.
        </p>
        <div className="mt-6">
          <Link
            href="/"
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold text-slate-700 dark:text-slate-200 bg-slate-100 dark:bg-white/10 hover:bg-slate-200 dark:hover:bg-white/20 transition-colors cursor-pointer"
          >
            <ArrowLeft size={16} />
            <span>Voltar ao Início</span>
          </Link>
        </div>
      </div>
    </div>
  );
}
