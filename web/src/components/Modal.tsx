import { ReactNode } from "react";

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
}

export function Modal({ isOpen, onClose, title, children }: ModalProps) {
  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 bg-black/70 flex items-center justify-center z-[1000]"
      onClick={onClose}
    >
      <div
        className="bg-surface border border-border rounded-xl p-8 w-[90%] max-w-sm shadow-[0_10px_25px_rgba(0,0,0,0.5)] text-main animate-slide-down"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-xl font-semibold mb-6">{title}</h2>
        {children}
      </div>
    </div>
  );
}
