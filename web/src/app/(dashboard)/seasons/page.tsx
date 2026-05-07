"use client";

import { useState } from "react";
import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { fetchAPI } from "@/lib/api";
import { Loading } from "@/components/Loading";
import { Button } from "@/components/Button";
import { Input } from "@/components/Input";
import { FormField } from "@/components/FormField";
import { Modal } from "@/components/Modal";

interface Season {
  id_season: number;
  initial_date: string;
  end_date: string;
  number: number;
}

export default function SeasonsPage() {
  const queryClient = useQueryClient();
  const [isCreating, setIsCreating] = useState(false);
  const [newNumber, setNewNumber] = useState("");
  const [newDate, setNewDate] = useState("");
  const [newEndDate, setNewEndDate] = useState("");

  const { data: season, isLoading, isError } = useQuery<Season | null>({
    queryKey: ["seasons", "current"],
    queryFn: async () => {
      try {
        return await fetchAPI("/seasons/current");
      } catch (err: any) {
        if (err.message === "Nenhuma temporada ativa") return null;
        throw err;
      }
    },
  });

  const createMutation = useMutation({
    mutationFn: (body: object) =>
      fetchAPI("/seasons/", { method: "POST", body: JSON.stringify(body) }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["seasons"] });
      setIsCreating(false);
      setNewNumber("");
      setNewDate("");
      setNewEndDate("");
    },
  });

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    const body: any = { initial_date: new Date(newDate).toISOString() };
    if (newNumber) body.number = parseInt(newNumber, 10);
    if (newEndDate) body.end_date = new Date(newEndDate).toISOString();
    createMutation.mutate(body);
  };

  if (isLoading) return <Loading />;
  if (isError)
    return <div className="text-red-500 p-4">Erro ao carregar temporada.</div>;

  return (
    <div className="flex flex-col gap-6 animate-slide-down">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl text-main">Temporadas</h1>
        {!season ? (
          <Button onClick={() => setIsCreating(true)} className="w-auto">
            Nova Temporada
          </Button>
        ) : (
          <Link
            href={`/seasons/${season.id_season}`}
            className="px-4 py-2.5 text-[15px] bg-primary text-white hover:bg-primary-hover rounded-lg font-medium cursor-pointer transition-all duration-200"
          >
            Ver temporada ativa
          </Link>
        )}
      </div>

      {!season && (
        <div className="bg-surface border border-border rounded-xl p-6 text-muted">
          <p>Nenhuma temporada ativa. Crie uma nova para começar.</p>
        </div>
      )}

      {season && (
        <div className="bg-surface border border-border rounded-xl p-6">
          <h2 className="text-xl font-semibold mb-4">Temporada #{season.number}</h2>
          <p className="text-muted text-sm">
            <strong>Início:</strong>{" "}
            {new Date(season.initial_date).toLocaleDateString("pt-BR")}
          </p>
          <p className="text-muted text-sm">
            <strong>Fim:</strong>{" "}
            {new Date(season.end_date).toLocaleDateString("pt-BR")}
          </p>
        </div>
      )}

      <Modal
        isOpen={isCreating}
        onClose={() => setIsCreating(false)}
        title="Criar Temporada"
      >
        <form onSubmit={handleCreate} className="flex flex-col gap-2">
          <FormField label="Número da Temporada">
            <Input
              type="number"
              value={newNumber}
              onChange={(e) => setNewNumber(e.target.value)}
              min={1}
              placeholder="Opcional"
            />
          </FormField>
          <FormField label="Data Inicial">
            <Input
              type="date"
              value={newDate}
              onChange={(e) => setNewDate(e.target.value)}
              required
            />
          </FormField>
          <FormField label="Data de Encerramento">
            <Input
              type="date"
              value={newEndDate}
              onChange={(e) => setNewEndDate(e.target.value)}
            />
          </FormField>
          <div className="flex gap-3 mt-2">
            <Button type="submit" disabled={createMutation.isPending}>
              {createMutation.isPending ? "Salvando..." : "Salvar"}
            </Button>
            <Button
              type="button"
              variant="ghost"
              onClick={() => setIsCreating(false)}
            >
              Cancelar
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
