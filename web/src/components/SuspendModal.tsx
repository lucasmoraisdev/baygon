"use client";

import { useState } from "react";
import { Button } from "@/components/Button";
import { FormField } from "@/components/FormField";
import { Input } from "@/components/Input";
import { Modal } from "@/components/Modal";
import { Select } from "@/components/Select";

interface SuspendModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (type: string, value: number) => void | Promise<void>;
}

const VALUE_LABEL: Record<string, string> = {
  days:  "dias",
  weeks: "semanas",
  games: "jogos",
};

export default function SuspendModal({ isOpen, onClose, onConfirm }: SuspendModalProps) {
  const [suspendType, setSuspendType]   = useState("days");
  const [suspendValue, setSuspendValue] = useState(1);

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Suspender Jogador">
      <FormField label="Tipo de Suspensão:">
        <Select value={suspendType} onChange={(e) => setSuspendType(e.target.value)}>
          <option value="days">Por Dias</option>
          <option value="weeks">Por Semanas</option>
          <option value="games">Por Jogos</option>
          <option value="indefinite">Indefinidamente</option>
        </Select>
      </FormField>

      {suspendType !== "indefinite" && (
        <FormField label={`Quantidade (${VALUE_LABEL[suspendType] ?? "dias"}):`}>
          <Input
            type="number"
            min={1}
            value={suspendValue}
            onChange={(e) => setSuspendValue(parseInt(e.target.value))}
          />
        </FormField>
      )}

      <div className="flex gap-3 mt-6">
        <Button variant="danger" onClick={() => onConfirm(suspendType, suspendValue)}>
          Confirmar Suspensão
        </Button>
        <Button variant="ghost" onClick={onClose}>
          Cancelar
        </Button>
      </div>
    </Modal>
  );
}
