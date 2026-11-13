import { InputHTMLAttributes } from "react";

export function Input({ className = "", type, max, ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      type={type}
      max={type === "date" ? (max ?? "9999-12-31") : max}
      className={`w-full px-3 py-2 bg-background/80 border border-border rounded-lg text-main text-sm focus:outline-none focus:border-primary transition-colors ${className}`}
      {...props}
    />
  );
}

