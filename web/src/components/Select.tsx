import { ReactNode, SelectHTMLAttributes } from "react";

interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  children: ReactNode;
}

export function Select({ children, ...props }: SelectProps) {
  return (
    <select
      className="w-full px-3 py-2.5 bg-background/80 border border-border rounded-md text-main text-sm focus:outline-none focus:border-primary transition-colors"
      {...props}
    >
      {children}
    </select>
  );
}
