import React from "react";
import ModuleGuard from "@/components/guards/ModuleGuard";

export const metadata = {
  title: "Fantasy Game - Associação Esportiva",
  description: "Escale seu time e dispute a pontuação oficial da rodada.",
};

export default function FantasyLayout({ children }: { children: React.ReactNode }) {
  return <ModuleGuard module="fantasy">{children}</ModuleGuard>;
}
