import { InputHTMLAttributes } from "react";

export function Input(props: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      className="w-full px-3 py-2.5 bg-background/80 border border-border rounded-md text-main text-sm focus:outline-none focus:border-primary transition-colors"
      {...props}
    />
  );
}
