"use client";

import React from "react";
import Link from "next/link";
import { 
  Gamepad2, 
  CircleDollarSign, 
  Sparkles, 
  Trophy, 
  CheckCircle2, 
  ArrowRight, 
  ShieldCheck, 
  Zap,
  Lock
} from "lucide-react";
import { useTenant } from "@/context/TenantContext";

interface ModuleConfig {
  name: string;
  tagline: string;
  description: string;
  icon: React.ElementType;
  badge: string;
  features: string[];
  estimatedCost: string;
}

const MODULE_DEFINITIONS: Record<string, ModuleConfig> = {
  fantasy: {
    name: "Fantasy Game Oficial",
    tagline: "Gamificação e engajamento máximo para os atletas da sua liga",
    description: "Permita que seus sócios e torcedores escalem os próprios atletas da associação rodada a rodada, pontuando com base nos gols, assistências e estatísticas reais da súmula.",
    icon: Gamepad2,
    badge: "Módulo Adicional",
    features: [
      "Mercado de valorização de jogadores automatizado",
      "Rankings dinâmicos por rodada e acumulado da temporada",
      "Simulador de patrimônio e pontuação em tempo real",
      "Disputa de ligas internas e mata-mata entre sócios",
    ],
    estimatedCost: "R$ 49,90 / mês",
  },
  financial: {
    name: "Gestão Financeira & Mensalidades",
    tagline: "Controle financeiro rigoroso e cobrança automática sem planilhas",
    description: "Automatize a arrecadação da associação esportiva. Emita cobranças mensais, acompanhe inadimplências, registre custos de arbitragem/campo e feche o mês com balancetes auditados.",
    icon: CircleDollarSign,
    badge: "Módulo de Gestão",
    features: [
      "Geração em lote de mensalidades para sócios associados",
      "Histórico de pagamentos com conciliação via PIX",
      "Controle minucioso de custos de arbitragem, quadra e bolas",
      "Demonstrativo de resultado do exercício (DRE) instantâneo",
    ],
    estimatedCost: "R$ 59,90 / mês",
  },
  gamification: {
    name: "Roleta de Prêmios & Gamificação",
    tagline: "Recompense craques e sócios com sorteios e premiações interativas",
    description: "Crie momentos de empolgação no encerramento de cada rodada com a roleta de prêmios interativa, distribuindo brindes, troféus e vantagens na associação.",
    icon: Sparkles,
    badge: "Engajamento",
    features: [
      "Roleta virtual com probabilidades customizáveis",
      "Premiação para o Craque da Rodada e Luva de Ouro",
      "Histórico auditado de contemplações e entregas",
      "Integração nativa com o painel de competições",
    ],
    estimatedCost: "R$ 29,90 / mês",
  },
  competitions: {
    name: "Gestão de Competições & Súmulas",
    tagline: "O coração operacional do seu campeonato esportivo",
    description: "Controle de tabelas, chaveamentos, súmulas digitais em tempo real, artilharia e cartões com precisão profissional.",
    icon: Trophy,
    badge: "Módulo Base",
    features: [
      "Tabelas de jogos e rodadas automáticas",
      "Súmula digital no celular para mesários e árbitros",
      "Classificação e estatísticas detalhadas de cada atleta",
    ],
    estimatedCost: "Incluso no Plano Base",
  },
};

interface ModuleUpgradeHeroProps {
  moduleCode: string;
}

export default function ModuleUpgradeHero({ moduleCode }: ModuleUpgradeHeroProps) {
  const { tenant } = useTenant();
  const config = MODULE_DEFINITIONS[moduleCode] || {
    name: `Módulo Especial (${moduleCode})`,
    tagline: "Recurso avançado da plataforma esportiva",
    description: "Este módulo fornece ferramentas complementares para enriquecer a experiência da sua associação.",
    icon: Zap,
    badge: "Expansão",
    features: ["Recursos dedicados", "Suporte prioritário"],
    estimatedCost: "Consulte nossos planos",
  };

  const IconComponent = config.icon;

  return (
    <div className="w-full max-w-5xl mx-auto py-10 px-4 sm:px-6">
      {/* Card Principal */}
      <div className="relative overflow-hidden rounded-3xl border border-[#e2e8f0] dark:border-white/10 bg-gradient-to-b from-white to-slate-50 dark:from-slate-900/90 dark:to-slate-950 p-8 sm:p-12 shadow-xl shadow-slate-200/50 dark:shadow-black/40">
        
        {/* Glow decorativo de fundo */}
        <div className="absolute top-0 right-0 -mr-20 -mt-20 w-80 h-80 rounded-full bg-emerald-500/10 dark:bg-emerald-500/20 blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 left-0 -ml-20 -mb-20 w-80 h-80 rounded-full bg-indigo-500/10 dark:bg-indigo-500/15 blur-3xl pointer-events-none" />

        <div className="relative z-10">
          {/* Header com Badge */}
          <div className="flex flex-wrap items-center gap-3 mb-6">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800 dark:bg-emerald-500/20 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-500/30">
              <Sparkles size={13} className="text-emerald-600 dark:text-emerald-400" />
              {config.badge}
            </span>
            <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-medium bg-slate-100 text-slate-700 dark:bg-white/5 dark:text-slate-300">
              <ShieldCheck size={13} className="text-indigo-500" />
              Exclusivo para Diretoria & Administradores
            </span>
          </div>

          {/* Título & Descrição */}
          <div className="flex items-start gap-5 mb-8">
            <div className="p-4 rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-600 text-white shadow-lg shadow-emerald-500/25 shrink-0">
              <IconComponent size={36} />
            </div>
            <div>
              <h1 className="text-2xl sm:text-4xl font-extrabold text-slate-900 dark:text-white tracking-tight">
                {config.name}
              </h1>
              <p className="mt-2 text-base sm:text-lg text-slate-600 dark:text-slate-300 max-w-2xl leading-relaxed">
                {config.description}
              </p>
            </div>
          </div>

          {/* Grid de Benefícios */}
          <div className="my-8 pt-8 border-t border-slate-200 dark:border-white/10">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-400 mb-5">
              O que está incluído neste módulo
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {config.features.map((feature, idx) => (
                <div 
                  key={idx} 
                  className="flex items-start gap-3 p-3.5 rounded-xl bg-white dark:bg-white/[0.03] border border-slate-200/80 dark:border-white/5 shadow-sm"
                >
                  <CheckCircle2 size={18} className="text-emerald-500 shrink-0 mt-0.5" />
                  <span className="text-sm font-medium text-slate-700 dark:text-slate-200">
                    {feature}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Caixa de Upsell / CTA */}
          <div className="mt-10 p-6 rounded-2xl bg-slate-100/90 dark:bg-white/[0.04] border border-slate-200 dark:border-white/10 flex flex-col sm:flex-row items-center justify-between gap-6">
            <div>
              <div className="flex items-center gap-2">
                <Lock size={16} className="text-amber-500" />
                <span className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                  Status Atual da Associação:
                </span>
                <span className="text-xs font-bold px-2 py-0.5 rounded bg-amber-100 dark:bg-amber-500/20 text-amber-800 dark:text-amber-300">
                  Não Contratado no Plano {tenant?.plan?.name || "Atual"}
                </span>
              </div>
              <div className="mt-2 text-xl font-bold text-slate-900 dark:text-white flex items-baseline gap-2">
                <span>Adicione por apenas</span>
                <span className="text-emerald-600 dark:text-emerald-400 text-2xl font-black">
                  {config.estimatedCost}
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                Ativação instantânea no seu subdomínio sem interrupção dos jogos em andamento.
              </p>
            </div>

            <div className="flex flex-col sm:flex-row items-center gap-3 w-full sm:w-auto">
              <Link
                href="/admin/planos"
                className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-3.5 rounded-xl font-bold text-white bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 shadow-lg shadow-emerald-600/30 transition-all hover:scale-[1.02] active:scale-[0.98] text-sm cursor-pointer"
              >
                <span>Contratar Módulo</span>
                <ArrowRight size={16} />
              </Link>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}
