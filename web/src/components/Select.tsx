'use client';

import { ReactNode, SelectHTMLAttributes, forwardRef } from 'react';
import { ChevronDown } from 'lucide-react';

export interface SelectProps extends Omit<SelectHTMLAttributes<HTMLSelectElement>, 'size'> {
  children: ReactNode;
  containerClassName?: string;
  size?: 'sm' | 'md' | 'lg';
}

export const Select = forwardRef<HTMLSelectElement, SelectProps>(
  (
    {
      children,
      className = '',
      containerClassName = '',
      disabled,
      size = 'md',
      ...props
    },
    ref,
  ) => {
    const sizeStyles = {
      sm: 'py-1.5 pl-3 pr-8 text-xs',
      md: 'py-2 pl-3.5 pr-9 text-sm',
      lg: 'py-2.5 pl-4 pr-10 text-base',
    };

    const chevronSizes = {
      sm: 'w-3.5 h-3.5 right-2.5',
      md: 'w-4 h-4 right-3',
      lg: 'w-4.5 h-4.5 right-3.5',
    };

    return (
      <div className={`relative w-full ${containerClassName}`}>
        <select
          ref={ref}
          disabled={disabled}
          className={`w-full appearance-none bg-background/80 hover:bg-background border border-border rounded-lg text-main font-medium focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/20 transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed ${sizeStyles[size]} ${className}`}
          {...props}
        >
          {children}
        </select>
        <ChevronDown
          className={`absolute top-1/2 -translate-y-1/2 text-muted pointer-events-none transition-colors ${chevronSizes[size]}`}
        />
      </div>
    );
  },
);

Select.displayName = 'Select';
