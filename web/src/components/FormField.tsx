import { ReactNode } from "react";

interface FormFieldProps {
  label: string;
  children: ReactNode;
}

export function FormField({ label, children }: FormFieldProps) {
  return (
    <div className="flex flex-col gap-1.5 mb-3">
      <label className="text-xs font-medium text-muted">{label}</label>
      {children}
    </div>
  );
}
