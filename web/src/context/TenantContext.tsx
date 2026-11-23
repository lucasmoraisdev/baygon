"use client";

import React, { createContext, useContext, useEffect, useState, useCallback } from "react";
import { fetchAPI, getActiveTenantSlug } from "@/lib/api";

export interface TenantPlan {
  id?: number;
  code: string;
  name: string;
  max_players?: number;
  max_seasons?: number;
}

export interface TournamentQuotaInfo {
  plan_code: string;
  plan_name: string;
  tournaments_created: number;
  tournaments_limit: number;
  tournaments_remaining: number;
  can_create: boolean;
  upgrade_required: boolean;
}

export interface TenantData {
  id: string;
  name: string;
  slug: string;
  custom_domain?: string | null;
  logo_url?: string | null;
  primary_color: string;
  secondary_color: string;
  status: "active" | "suspended" | "pending";
  plan: TenantPlan | null;
  modules: string[];
  tournament_quota?: TournamentQuotaInfo;
}

export interface TenantContextType {
  tenant: TenantData | null;
  isLoading: boolean;
  error: string | null;
  isFreePlan: boolean;
  hasModule: (moduleCode: string) => boolean;
  refreshTenant: () => Promise<void>;
}

const TenantContext = createContext<TenantContextType | undefined>(undefined);

// Tenant padrão de fallback (Baygon) enquanto carrega ou em caso de erro transitório
const DEFAULT_TENANT_FALLBACK: TenantData = {
  id: "00000000-0000-0000-0000-000000000001",
  name: "Associação Baygon",
  slug: "baygon",
  logo_url: null,
  primary_color: "#059669",
  secondary_color: "#10b981",
  status: "active",
  plan: {
    code: "pro_all_inclusive",
    name: "Plano Completo Pro",
    max_players: 200,
    max_seasons: 10,
  },
  modules: ["competitions", "financial", "fantasy", "gamification"],
};

export function TenantProvider({ children }: { children: React.ReactNode }) {
  const [tenant, setTenant] = useState<TenantData | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const applyThemeColors = useCallback((primary: string, secondary: string) => {
    if (typeof document !== "undefined") {
      const root = document.documentElement;
      root.style.setProperty("--tenant-primary", primary);
      root.style.setProperty("--tenant-secondary", secondary);
    }
  }, []);

  const loadTenant = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      const data: TenantData = await fetchAPI("/tenant/me");
      setTenant(data);
      applyThemeColors(data.primary_color || "#059669", data.secondary_color || "#10b981");
    } catch (err: any) {
      console.warn("TenantProvider: Não foi possível carregar tenant remoto, aplicando fallback:", err?.message);
      setError(err?.message || "Erro ao carregar dados da associação");
      setTenant(DEFAULT_TENANT_FALLBACK);
      applyThemeColors(DEFAULT_TENANT_FALLBACK.primary_color, DEFAULT_TENANT_FALLBACK.secondary_color);
    } finally {
      setIsLoading(false);
    }
  }, [applyThemeColors]);

  useEffect(() => {
    loadTenant();
  }, [loadTenant]);

  const hasModule = useCallback(
    (moduleCode: string): boolean => {
      if (!tenant || !tenant.modules) return false;
      return tenant.modules.includes(moduleCode);
    },
    [tenant]
  );

  const isFreePlan = React.useMemo(() => {
    if (!tenant) return false;
    const planCode = tenant.plan?.code || tenant.tournament_quota?.plan_code;
    return planCode === "free";
  }, [tenant]);

  return (
    <TenantContext.Provider
      value={{
        tenant: tenant || DEFAULT_TENANT_FALLBACK,
        isLoading,
        error,
        isFreePlan,
        hasModule,
        refreshTenant: loadTenant,
      }}
    >
      {children}
    </TenantContext.Provider>
  );
}

export function useTenant(): TenantContextType {
  const context = useContext(TenantContext);
  if (!context) {
    throw new Error("useTenant deve ser utilizado dentro de um TenantProvider");
  }
  return context;
}
