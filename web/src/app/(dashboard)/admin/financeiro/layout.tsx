import React from "react";
import ModuleGuard from "@/components/guards/ModuleGuard";

export const metadata = {
  title: "Gestão Financeira - Painel Administrativo",
  description: "Controle de mensalidades, custos e fluxo de caixa da associação.",
};

export default function FinanceiroLayout({ children }: { children: React.ReactNode }) {
  return <ModuleGuard module="financial">{children}</ModuleGuard>;
}
