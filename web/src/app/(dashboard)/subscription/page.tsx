"use client";

import React, { useState } from "react";
import {
  Sparkles,
  Check,
  X,
  CreditCard,
  QrCode,
  Shield,
  Trophy,
  Zap,
  Users,
  Megaphone,
  Gamepad2,
  ArrowRight,
  HelpCircle,
  Copy,
  CheckCircle2,
  Lock,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { useTenant } from "@/context/TenantContext";
import { fetchAPI } from "@/lib/api";
import { Modal } from "@/components/Modal";
import { Button } from "@/components/Button";

interface PlanTier {
  code: string;
  name: string;
  tagline: string;
  monthlyPrice: number;
  annualPrice: number;
  isPopular?: boolean;
  maxTournaments: string;
  playersLabel: string;
  adsType: "all_ads" | "no_adsense_custom_banners" | "zero_ads";
  adsDescription: string;
  fantasyIncluded: boolean;
  features: string[];
  ctaLabel: string;
}

const PLANS: PlanTier[] = [
  {
    code: "free",
    name: "Plano Gratuito",
    tagline: "Para quem está começando e quer testar a plataforma.",
    monthlyPrice: 0,
    annualPrice: 0,
    maxTournaments: "2 Torneios Gratuitos",
    playersLabel: "Cadastro Ilimitado",
    adsType: "all_ads",
    adsDescription: "AdSense (Popups) e Banners",
    fantasyIncluded: false,
    features: [
      "2 Campeonatos ou Temporadas completas",
      "Cadastro Ilimitado de atletas e jogadores",
      "Tabelas de classificação e rodadas automáticas",
      "Súmula de partidas e chaveamento mata-mata",
      "Anúncios AdSense e banners de patrocinadores",
    ],
    ctaLabel: "Plano Atual",
  },
  {
    code: "basic",
    name: "Plano Esportivo Básico",
    tagline: "Ideal para ligas locais com mais times, sem popups e com patrocinadores próprios.",
    monthlyPrice: 59.9,
    annualPrice: 47.9,
    maxTournaments: "3 Torneios Simultâneos",
    playersLabel: "Cadastro Ilimitado",
    adsType: "no_adsense_custom_banners",
    adsDescription: "Livre de AdSense • Banners Próprios",
    fantasyIncluded: false,
    features: [
      "Até 3 Campeonatos simultâneos",
      "Cadastro Ilimitado de atletas e jogadores",
      "100% Livre de anúncios AdSense e popups",
      "Espaço para banners próprios de patrocínio da sua liga",
      "Chaveamento eliminatório de playoffs e fase de grupos",
      "Suporte via WhatsApp",
    ],
    ctaLabel: "Escolher Plano Básico",
  },
  {
    code: "pro_all_inclusive",
    name: "Plano Completo Pro",
    tagline: "A experiência definitiva com 0 anúncios, torneios ilimitados e Fantasy Game incluso.",
    monthlyPrice: 149.9,
    annualPrice: 119.9,
    isPopular: true,
    maxTournaments: "Torneios Ilimitados",
    playersLabel: "Cadastro Ilimitado",
    adsType: "zero_ads",
    adsDescription: "Zero Anúncios Total (100% Clean)",
    fantasyIncluded: true,
    features: [
      "Torneios & Campeonatos Ilimitados",
      "Cadastro Ilimitado de atletas e jogadores",
      "0 Anúncios Total (Zero AdSense e zero banners externos)",
      "Fantasy Game Oficial Incluso (Mercado & Escalação)",
      "Módulo Financeiro & Mensalidades Incluso",
      "Roleta de Prêmios & Gamificação Inclusa",
      "Sorteio automático e avanço de chaves",
      "Suporte prioritário VIP",
    ],
    ctaLabel: "Fazer Upgrade para o Pro",
  },
];

const COMPARISON_ROWS = [
  { feature: "Cota de Torneios / Campeonatos", free: "2 torneios", basic: "3 torneios simultâneos", pro: "Ilimitados (Sem limite)" },
  { feature: "Cadastro de Jogadores e Atletas", free: "Ilimitado", basic: "Ilimitado", pro: "Ilimitado" },
  { feature: "Anúncios em Rede (Google AdSense / Popups)", free: "Com anúncios e popups", basic: "Zero AdSense / Sem Popups", pro: "Zero AdSense / Sem Popups" },
  { feature: "Banners Próprios para Patrocinadores Diretos", free: "Espaço padrão", basic: "Liberado (Monetize sua Liga)", pro: "Painel 100% Clean (Sem Banners)" },
  { feature: "Módulo Fantasy Game Oficial", free: false, basic: "Adicional (+R$ 49,90)", pro: "Incluso (Sem Custo Extra)" },
  { feature: "Chaveamento Mata-Mata / Playoffs", free: true, basic: true, pro: true },
  { feature: "Fase de Grupos + Playoffs", free: true, basic: true, pro: true },
  { feature: "Sorteio Automático de Chaves", free: false, basic: true, pro: true },
  { feature: "Módulo Financeiro & Mensalidades", free: false, basic: "Adicional (+R$ 59,90)", pro: "Incluso" },
  { feature: "Roleta de Prêmios & Gamificação", free: false, basic: "Adicional (+R$ 29,90)", pro: "Incluso" },
  { feature: "Suporte Técnico", free: "Comunitário", basic: "WhatsApp", pro: "VIP Prioritário" },
];

const FAQS = [
  {
    q: "Como funciona a contagem de cotas de torneios?",
    a: "No plano Gratuito você pode criar até 2 torneios completos no histórico da sua associação. No plano Básico são até 3 torneios simultâneos, e no Plano Pro a criação de torneios e edições é 100% ilimitada.",
  },
  {
    q: "Existe limite de atletas ou jogadores cadastrados?",
    a: "Não! Em todos os planos (Gratuito, Básico e Pro) o cadastro de jogadores, atletas e sócios é 100% ilimitado, permitindo que sua liga cresça sem barreiras de atletas.",
  },
  {
    q: "Como funciona a política de anúncios e patrocínios?",
    a: "No Plano Gratuito, a plataforma exibe anúncios de rede (AdSense, popups) e banners padrão. No Plano Básico, sua associação fica 100% livre dos anúncios AdSense de popup e pode exibir banners próprios de patrocinadores diretos da sua liga (gerando receita para você). No Plano Pro, a experiência é 100% clean com zero anúncios total.",
  },
  {
    q: "Como funciona o Fantasy Game Oficial no Plano Pro?",
    a: "Ao assinar o Plano Pro, o Fantasy Game oficial da sua liga é liberado automaticamente sem nenhum custo adicional. Seus membros podem montar times, escalar os próprios atletas da associação e pontuar a cada rodada.",
  },
  {
    q: "Posso mudar de plano ou cancelar a qualquer momento?",
    a: "Sim! Você pode fazer upgrade a qualquer momento para liberar novos recursos e módulos na hora. Não há fidelidade obrigatória no plano mensal.",
  },
  {
    q: "Quais formas de pagamento são aceitas?",
    a: "Aceitamos PIX Instantâneo com liberação imediata e Cartão de Crédito (com parcelamento no ciclo anual).",
  },
];

export default function SubscriptionPage() {
  const { tenant, refreshTenant, isFreePlan } = useTenant();
  const [billingCycle, setBillingCycle] = useState<"monthly" | "annual">("annual");
  const [selectedPlanForCheckout, setSelectedPlanForCheckout] = useState<PlanTier | null>(null);
  const [paymentMethod, setPaymentMethod] = useState<"pix" | "credit_card">("pix");
  const [isProcessing, setIsProcessing] = useState(false);
  const [checkoutSuccess, setCheckoutSuccess] = useState(false);
  const [copiedPix, setCopiedPix] = useState(false);
  const [openFaqIndex, setOpenFaqIndex] = useState<number | null>(0);

  const currentPlanCode = tenant?.plan?.code || tenant?.tournament_quota?.plan_code || "free";

  const handleOpenCheckout = (plan: PlanTier) => {
    if (plan.code === currentPlanCode) return;
    setSelectedPlanForCheckout(plan);
    setCheckoutSuccess(false);
  };

  const handleConfirmUpgrade = async () => {
    if (!selectedPlanForCheckout) return;

    try {
      setIsProcessing(true);
      await fetchAPI("/tenant/upgrade-plan", {
        method: "POST",
        body: JSON.stringify({
          plan_code: selectedPlanForCheckout.code,
          billing_cycle: billingCycle,
        }),
      });

      await refreshTenant();
      setCheckoutSuccess(true);
    } catch (err: any) {
      alert(err?.message || "Erro ao processar upgrade de plano.");
    } finally {
      setIsProcessing(false);
    }
  };

  const fakePixCode = `00020126580014BR.GOV.BCB.PIX0136${tenant?.id || "baygon"}-pay5204000053039865802BR5913BAYGON SAAS6008SALVADOR62070503***6304`;

  const copyPixToClipboard = () => {
    navigator.clipboard.writeText(fakePixCode);
    setCopiedPix(true);
    setTimeout(() => setCopiedPix(false), 2500);
  };

  return (
    <div className="flex flex-col gap-10 animate-slide-down pb-20">
      {/* 1. Header & Current Plan Status Hero */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-surface via-surface to-emerald-500/10 border border-border p-6 sm:p-8 shadow-sm dark:shadow-xl dark:from-zinc-900 dark:via-zinc-900/90 dark:to-emerald-950/40 dark:border-zinc-800">
        <div className="absolute top-0 right-0 -mt-10 -mr-10 w-64 h-64 rounded-full bg-emerald-500/10 blur-3xl pointer-events-none" />

        <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-6 relative z-10">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <span className="p-1.5 rounded-lg bg-emerald-500/15 text-emerald-600 dark:text-emerald-400">
                <Sparkles className="w-4 h-4" />
              </span>
              <span className="text-xs font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">
                Assinatura & Planos da Associação
              </span>
            </div>
            <h1 className="text-2xl sm:text-4xl font-extrabold text-main tracking-tight">
              Escale sua liga com recursos profissionais
            </h1>
            <p className="text-sm sm:text-base text-muted mt-2 max-w-2xl">
              Gerencie campeonatos com atletas ilimitados em todos os planos, elimine anúncios invasivos e desbloqueie
              o Fantasy Game Oficial e torneios ilimitados no Plano Pro.
            </p>
          </div>

          {/* Card Resumo do Status Atual */}
          <div className="w-full lg:w-auto p-4 rounded-2xl bg-surface/90 border border-border shrink-0 min-w-[280px] shadow-sm dark:bg-zinc-950/70 dark:border-zinc-800/90">
            <div className="flex items-center justify-between gap-2 pb-2.5 border-b border-border dark:border-zinc-800/80">
              <span className="text-xs text-muted">Plano Atual:</span>
              <span
                className={`text-xs font-bold px-2.5 py-0.5 rounded-full ${
                  currentPlanCode === "pro_all_inclusive"
                    ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30"
                    : currentPlanCode === "basic"
                    ? "bg-blue-500/15 text-blue-700 dark:text-blue-300 border border-blue-500/30"
                    : "bg-surface border border-border text-muted dark:bg-zinc-800 dark:text-zinc-300 dark:border-zinc-700"
                }`}
              >
                {tenant?.plan?.name || tenant?.tournament_quota?.plan_name || "Plano Gratuito"}
              </span>
            </div>

            <div className="mt-3 flex flex-col gap-2">
              <div className="flex items-center justify-between text-xs">
                <span className="text-muted">Cota de Torneios:</span>
                <span className="font-semibold text-main">
                  {tenant?.tournament_quota?.tournaments_limit === -1
                    ? "Ilimitados"
                    : `${tenant?.tournament_quota?.tournaments_created || 0} / ${
                        tenant?.tournament_quota?.tournaments_limit || 2
                      }`}
                </span>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="text-muted">Módulos Ativos:</span>
                <span className="font-semibold text-emerald-600 dark:text-emerald-400">
                  {tenant?.modules ? `${tenant.modules.length} módulos` : "Competições"}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 2. Billing Cycle Switcher */}
      <div className="flex flex-col items-center justify-center gap-3">
        <div className="flex items-center p-1 rounded-2xl bg-surface border border-border shadow-sm dark:bg-zinc-900 dark:border-zinc-800">
          <button
            onClick={() => setBillingCycle("monthly")}
            className={`px-5 py-2 rounded-xl text-xs font-bold transition-all ${
              billingCycle === "monthly"
                ? "bg-emerald-600 dark:bg-emerald-500 text-white dark:text-zinc-950 shadow-md shadow-emerald-500/20"
                : "text-muted hover:text-main"
            }`}
          >
            Faturamento Mensal
          </button>
          <button
            onClick={() => setBillingCycle("annual")}
            className={`flex items-center gap-2 px-5 py-2 rounded-xl text-xs font-bold transition-all ${
              billingCycle === "annual"
                ? "bg-emerald-600 dark:bg-emerald-500 text-white dark:text-zinc-950 shadow-md shadow-emerald-500/20"
                : "text-muted hover:text-main"
            }`}
          >
            <span>Faturamento Anual</span>
            <span
              className={`px-1.5 py-0.5 rounded-md text-[10px] font-extrabold uppercase transition-all ${
                billingCycle === "annual"
                  ? "bg-white/25 text-white border border-white/40 dark:bg-zinc-950/25 dark:text-zinc-950 dark:border-zinc-950/30"
                  : "bg-emerald-500/15 text-emerald-700 border border-emerald-500/30 dark:bg-emerald-500/20 dark:text-emerald-300 dark:border-emerald-500/40"
              }`}
            >
              20% OFF
            </span>
          </button>
        </div>
        <span className="text-xs text-muted">
          {billingCycle === "annual"
            ? "Economize até 2 meses grátis optando pelo ciclo anual"
            : "Cancele ou mude de plano a qualquer momento sem fidelidade"}
        </span>
      </div>

      {/* 3. Pricing Grid (3 Cards) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-stretch pt-4">
        {PLANS.map((plan) => {
          const isCurrent = plan.code === currentPlanCode;
          const displayPrice =
            billingCycle === "annual" ? plan.annualPrice : plan.monthlyPrice;

          return (
            <div
              key={plan.code}
              className={`relative flex flex-col justify-between rounded-3xl p-6 sm:p-7 transition-all ${
                plan.isPopular
                  ? "bg-gradient-to-b from-surface via-surface to-emerald-500/5 border-2 border-emerald-500 shadow-xl shadow-emerald-500/10 dark:from-zinc-900 dark:via-zinc-900/90 dark:to-emerald-950/30 dark:border-emerald-500/80"
                  : "bg-surface border border-border hover:border-border-hover dark:bg-zinc-900/60 dark:border-zinc-800 dark:hover:border-zinc-700 shadow-sm hover:shadow-md"
              }`}
            >
              {plan.isPopular && (
                <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 px-4 py-1 rounded-full bg-emerald-600 dark:bg-emerald-500 text-white dark:text-zinc-950 text-[11px] font-extrabold tracking-wider uppercase shadow-md shadow-emerald-500/30">
                  Mais Escolhido • Tudo Incluso
                </div>
              )}

              <div>
                {/* Header do Card */}
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-xl font-bold text-main">{plan.name}</h3>
                  {isCurrent && (
                    <span className="px-2.5 py-0.5 rounded-full bg-surface border border-border text-muted text-[11px] font-semibold dark:bg-zinc-800 dark:text-zinc-300 dark:border-zinc-700">
                      Plano Atual
                    </span>
                  )}
                </div>

                <p className="text-xs text-muted min-h-[36px]">{plan.tagline}</p>

                {/* Preço */}
                <div className="my-6 pb-6 border-b border-border dark:border-zinc-800/80 flex items-baseline gap-1">
                  <span className="text-4xl font-extrabold text-main font-mono">
                    R$ {displayPrice.toFixed(2).replace(".", ",")}
                  </span>
                  <span className="text-xs text-muted font-medium">/ mês</span>
                </div>

                {/* Destaques Rápidos */}
                <div className="flex flex-col gap-2.5 mb-6 text-xs text-main">
                  <div className="flex items-center gap-2">
                    <Trophy className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                    <span>
                      Torneios: <strong className="font-semibold text-main">{plan.maxTournaments}</strong>
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Users className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                    <span>
                      Jogadores: <strong className="font-semibold text-main">{plan.playersLabel}</strong>
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Megaphone className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                    <span>
                      Anúncios:{" "}
                      <strong
                        className={`font-semibold ${
                          plan.adsType === "all_ads"
                            ? "text-amber-700 dark:text-amber-400"
                            : "text-emerald-700 dark:text-emerald-400"
                        }`}
                      >
                        {plan.adsDescription}
                      </strong>
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Gamepad2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                    <span>
                      Fantasy Game:{" "}
                      <strong
                        className={`font-semibold ${
                          plan.fantasyIncluded
                            ? "text-emerald-700 dark:text-emerald-400"
                            : "text-muted"
                        }`}
                      >
                        {plan.fantasyIncluded ? "Incluso no Plano" : "Módulo Opcional"}
                      </strong>
                    </span>
                  </div>
                </div>

                {/* Lista de Recursos */}
                <div className="space-y-2.5 pt-2">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-muted">
                    O que está incluso:
                  </span>
                  {plan.features.map((feature, fIdx) => (
                    <div key={fIdx} className="flex items-start gap-2.5 text-xs text-main dark:text-zinc-300">
                      <div className="w-4 h-4 rounded-full bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0 mt-0.5">
                        <Check className="w-3 h-3" />
                      </div>
                      <span>{feature}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Botão de Ação CTA */}
              <div className="mt-8 pt-4">
                {isCurrent ? (
                  <button
                    disabled
                    className="w-full py-3 rounded-xl bg-surface border border-border text-muted text-xs font-semibold cursor-default text-center dark:bg-zinc-800/60 dark:text-zinc-400 dark:border-transparent"
                  >
                    Plano Ativo da Sua Liga
                  </button>
                ) : (
                  <button
                    onClick={() => handleOpenCheckout(plan)}
                    className={`w-full py-3 rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 transition-all shadow-md ${
                      plan.isPopular
                        ? "bg-emerald-600 hover:bg-emerald-500 text-white shadow-emerald-600/20 hover:scale-[1.02] active:scale-[0.98] dark:bg-emerald-500 dark:hover:bg-emerald-400 dark:text-zinc-950"
                        : "bg-surface hover:bg-nav-hover border border-border hover:border-border-hover text-main dark:bg-zinc-800 dark:hover:bg-zinc-700 dark:text-zinc-100 dark:border-transparent hover:scale-[1.02]"
                    }`}
                  >
                    {plan.ctaLabel}
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* 4. Tabela Comparativa Detalhada */}
      <div className="flex flex-col gap-4">
        <div>
          <h2 className="text-xl font-bold text-main">Comparativo Completo de Recursos</h2>
          <p className="text-xs text-muted mt-0.5">
            Compare lado a lado as funcionalidades de cada plano.
          </p>
        </div>

        <div className="overflow-x-auto rounded-2xl border border-border bg-surface shadow-sm dark:border-zinc-800 dark:bg-zinc-900/40">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-border bg-slate-50 text-muted uppercase tracking-wider text-[11px] font-bold dark:border-zinc-800 dark:bg-zinc-900/80">
                <th className="py-3.5 px-4">Recurso / Funcionalidade</th>
                <th className="py-3.5 px-4 text-center">Gratuito</th>
                <th className="py-3.5 px-4 text-center">Básico</th>
                <th className="py-3.5 px-4 text-center text-emerald-700 dark:text-emerald-400">Pro Completo</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border dark:divide-zinc-800/60">
              {COMPARISON_ROWS.map((row, idx) => (
                <tr key={idx} className="hover:bg-slate-50/80 dark:hover:bg-zinc-800/20 transition-colors">
                  <td className="py-3 px-4 font-medium text-main">{row.feature}</td>

                  {/* Free */}
                  <td className="py-3 px-4 text-center text-muted">
                    {typeof row.free === "boolean" ? (
                      row.free ? (
                        <Check className="w-4 h-4 text-emerald-600 dark:text-emerald-400 mx-auto" />
                      ) : (
                        <X className="w-4 h-4 text-muted/60 dark:text-zinc-600 mx-auto" />
                      )
                    ) : (
                      row.free
                    )}
                  </td>

                  {/* Basic */}
                  <td className="py-3 px-4 text-center text-main dark:text-zinc-300">
                    {typeof row.basic === "boolean" ? (
                      row.basic ? (
                        <Check className="w-4 h-4 text-emerald-600 dark:text-emerald-400 mx-auto" />
                      ) : (
                        <X className="w-4 h-4 text-muted/60 dark:text-zinc-600 mx-auto" />
                      )
                    ) : (
                      row.basic
                    )}
                  </td>

                  {/* Pro */}
                  <td className="py-3 px-4 text-center font-bold text-emerald-700 dark:text-emerald-300 bg-emerald-500/[0.04]">
                    {typeof row.pro === "boolean" ? (
                      row.pro ? (
                        <Check className="w-4 h-4 text-emerald-600 dark:text-emerald-400 mx-auto" />
                      ) : (
                        <X className="w-4 h-4 text-muted/60 dark:text-zinc-600 mx-auto" />
                      )
                    ) : (
                      row.pro
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* 5. Seção de Perguntas Frequentes (FAQ) */}
      <div className="flex flex-col gap-4">
        <div>
          <h2 className="text-xl font-bold text-main">Dúvidas Frequentes</h2>
          <p className="text-xs text-muted mt-0.5">
            Tudo o que você precisa saber sobre a contratação e uso dos planos.
          </p>
        </div>

        <div className="flex flex-col gap-2.5">
          {FAQS.map((faq, idx) => {
            const isOpen = openFaqIndex === idx;
            return (
              <div
                key={idx}
                className="rounded-2xl border border-border bg-surface shadow-sm overflow-hidden transition-colors dark:border-zinc-800 dark:bg-zinc-900/50"
              >
                <button
                  onClick={() => setOpenFaqIndex(isOpen ? null : idx)}
                  className="w-full p-4 flex items-center justify-between text-left text-sm font-semibold text-main hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors"
                >
                  <div className="flex items-center gap-2.5">
                    <HelpCircle className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                    <span>{faq.q}</span>
                  </div>
                  {isOpen ? (
                    <ChevronUp className="w-4 h-4 text-muted" />
                  ) : (
                    <ChevronDown className="w-4 h-4 text-muted" />
                  )}
                </button>

                {isOpen && (
                  <div className="px-4 pb-4 pt-1 text-xs text-muted leading-relaxed border-t border-border dark:border-zinc-800/60">
                    {faq.a}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Modal de Checkout / Confirmação de Upgrade */}
      <Modal
        isOpen={Boolean(selectedPlanForCheckout)}
        onClose={() => setSelectedPlanForCheckout(null)}
        title={checkoutSuccess ? "Plano Ativado com Sucesso!" : "Assinatura do Plano"}
      >
        {selectedPlanForCheckout && !checkoutSuccess && (
          <div className="flex flex-col gap-5">
            {/* Resumo do Pedido */}
            <div className="p-4 rounded-xl bg-slate-50 border border-border flex items-center justify-between dark:bg-zinc-950 dark:border-zinc-800">
              <div>
                <span className="text-xs text-muted uppercase font-bold tracking-wider">
                  Plano Selecionado
                </span>
                <h4 className="text-base font-bold text-main">{selectedPlanForCheckout.name}</h4>
                <div className="flex items-center gap-1.5 mt-0.5">
                  <span className="text-xs font-semibold text-muted">
                    Ciclo: {billingCycle === "annual" ? "Anual" : "Mensal"}
                  </span>
                  {billingCycle === "annual" && (
                    <span className="px-1.5 py-0.5 rounded text-[10px] font-extrabold bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30 uppercase">
                      20% OFF
                    </span>
                  )}
                </div>
              </div>
              <div className="text-right">
                <span className="text-xl font-bold font-mono text-main">
                  R${" "}
                  {(billingCycle === "annual"
                    ? selectedPlanForCheckout.annualPrice
                    : selectedPlanForCheckout.monthlyPrice
                  )
                    .toFixed(2)
                    .replace(".", ",")}
                </span>
                <span className="block text-[11px] text-muted">/ mês</span>
              </div>
            </div>

            {/* Seleção do Método de Pagamento */}
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-muted mb-2">
                Método de Pagamento
              </label>
              <div className="grid grid-cols-2 gap-2.5">
                <button
                  type="button"
                  onClick={() => setPaymentMethod("pix")}
                  className={`flex items-center justify-center gap-2 p-3 rounded-xl border text-xs font-bold transition-all ${
                    paymentMethod === "pix"
                      ? "border-emerald-500 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
                      : "border-border bg-surface text-muted hover:border-border-hover hover:text-main dark:border-zinc-800 dark:bg-zinc-900/60 dark:text-zinc-400 dark:hover:border-zinc-700"
                  }`}
                >
                  <QrCode className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                  PIX Instantâneo
                </button>
                <button
                  type="button"
                  onClick={() => setPaymentMethod("credit_card")}
                  className={`flex items-center justify-center gap-2 p-3 rounded-xl border text-xs font-bold transition-all ${
                    paymentMethod === "credit_card"
                      ? "border-emerald-500 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
                      : "border-border bg-surface text-muted hover:border-border-hover hover:text-main dark:border-zinc-800 dark:bg-zinc-900/60 dark:text-zinc-400 dark:hover:border-zinc-700"
                  }`}
                >
                  <CreditCard className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                  Cartão de Crédito
                </button>
              </div>
            </div>

            {/* Detalhes de Acordo com o Pagamento */}
            {paymentMethod === "pix" ? (
              <div className="p-4 rounded-xl border border-border bg-slate-50 flex flex-col items-center gap-3 text-center dark:border-zinc-800 dark:bg-zinc-900/40">
                <div className="w-28 h-28 bg-white p-2 rounded-xl flex items-center justify-center shadow-sm border border-border dark:border-transparent">
                  {/* Mock QR Code visual */}
                  <QrCode className="w-24 h-24 text-zinc-950" />
                </div>
                <div className="w-full">
                  <span className="text-xs font-semibold text-main block mb-1">
                    Código Copia e Cola PIX:
                  </span>
                  <div className="flex items-center gap-2">
                    <input
                      readOnly
                      value={fakePixCode}
                      className="w-full px-3 py-1.5 rounded-lg bg-surface border border-border font-mono text-[11px] text-main truncate dark:bg-zinc-950 dark:border-zinc-800 dark:text-zinc-400"
                    />
                    <button
                      type="button"
                      onClick={copyPixToClipboard}
                      className="px-3 py-1.5 rounded-lg bg-emerald-500/15 border border-emerald-500/30 text-emerald-700 dark:text-emerald-400 hover:bg-emerald-500/25 text-xs font-semibold flex items-center gap-1 shrink-0"
                    >
                      {copiedPix ? <CheckCircle2 className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                      {copiedPix ? "Copiado!" : "Copiar"}
                    </button>
                  </div>
                </div>
                <span className="text-[11px] text-muted flex items-center gap-1 mt-1">
                  <Lock className="w-3 h-3 text-emerald-600 dark:text-emerald-500" />
                  Ativação imediata e segura via webhook do Banco Central
                </span>
              </div>
            ) : (
              <div className="flex flex-col gap-3 p-4 rounded-xl border border-border bg-slate-50 dark:border-zinc-800 dark:bg-zinc-900/40">
                <div>
                  <label className="block text-[11px] font-semibold text-muted mb-1">
                    Número do Cartão
                  </label>
                  <input
                    type="text"
                    placeholder="•••• •••• •••• ••••"
                    className="w-full px-3 py-2 rounded-lg bg-surface border border-border text-xs text-main font-mono placeholder:text-muted focus:border-emerald-500 focus:outline-none dark:bg-zinc-950 dark:border-zinc-800 dark:text-zinc-100"
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-semibold text-muted mb-1">Validade</label>
                    <input
                      type="text"
                      placeholder="MM/AA"
                      className="w-full px-3 py-2 rounded-lg bg-surface border border-border text-xs text-main font-mono placeholder:text-muted focus:border-emerald-500 focus:outline-none dark:bg-zinc-950 dark:border-zinc-800 dark:text-zinc-100"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-muted mb-1">CVV</label>
                    <input
                      type="text"
                      placeholder="123"
                      className="w-full px-3 py-2 rounded-lg bg-surface border border-border text-xs text-main font-mono placeholder:text-muted focus:border-emerald-500 focus:outline-none dark:bg-zinc-950 dark:border-zinc-800 dark:text-zinc-100"
                    />
                  </div>
                </div>
              </div>
            )}

            {/* Ações */}
            <div className="flex items-center justify-end gap-2 pt-2 border-t border-border dark:border-zinc-800">
              <button
                type="button"
                onClick={() => setSelectedPlanForCheckout(null)}
                className="px-4 py-2 text-xs font-semibold text-muted hover:text-main transition-colors"
              >
                Cancelar
              </button>
              <Button
                variant="primary"
                size="sm"
                disabled={isProcessing}
                onClick={handleConfirmUpgrade}
                className="px-5 py-2 font-bold text-xs"
              >
                {isProcessing ? "Confirmando..." : "Confirmar & Ativar Agora"}
              </Button>
            </div>
          </div>
        )}

        {/* Feedback de Sucesso */}
        {checkoutSuccess && selectedPlanForCheckout && (
          <div className="flex flex-col items-center text-center p-4">
            <div className="w-14 h-14 rounded-2xl bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-emerald-600 dark:text-emerald-400 mb-4 animate-bounce">
              <CheckCircle2 className="w-8 h-8" />
            </div>
            <h3 className="text-lg font-bold text-main">Parabéns! Seu Plano Foi Atualizado</h3>
            <p className="text-sm text-muted mt-2 max-w-sm">
              Sua associação agora está ativa no{" "}
              <strong className="text-emerald-600 dark:text-emerald-400">{selectedPlanForCheckout.name}</strong>. Todos os
              benefícios e módulos foram liberados instantaneamente!
            </p>

            <button
              onClick={() => setSelectedPlanForCheckout(null)}
              className="mt-6 w-full py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs shadow-lg shadow-emerald-600/20 transition-all dark:bg-emerald-500 dark:hover:bg-emerald-400 dark:text-zinc-950"
            >
              Concluir & Aproveitar Recursos
            </button>
          </div>
        )}
      </Modal>
    </div>
  );
}
