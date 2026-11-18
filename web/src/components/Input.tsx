'use client';

import { useState, InputHTMLAttributes, forwardRef, ChangeEvent } from 'react';
import { Eye, EyeOff } from 'lucide-react';
import { formatPhone, formatEmail } from '@/lib/masks';

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  mask?: 'phone' | 'email';
  showPasswordToggle?: boolean;
  containerClassName?: string;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  (
    {
      className = '',
      containerClassName = '',
      type,
      max,
      mask,
      showPasswordToggle = true,
      onChange,
      onBlur,
      ...props
    },
    ref,
  ) => {
    const isPassword = type === 'password';
    const [showPassword, setShowPassword] = useState(false);

    const actualType = isPassword ? (showPassword ? 'text' : 'password') : type;
    const isPhone = mask === 'phone' || type === 'tel';
    const isEmail = mask === 'email' || type === 'email';

    const handleChange = (e: ChangeEvent<HTMLInputElement>) => {
      if (isPhone) {
        e.target.value = formatPhone(e.target.value);
      }
      onChange?.(e);
    };

    const handleBlur = (e: React.FocusEvent<HTMLInputElement>) => {
      if (isEmail && e.target.value) {
        e.target.value = formatEmail(e.target.value);
      }
      onBlur?.(e);
    };

    return (
      <div className={`relative w-full ${containerClassName}`}>
        <input
          ref={ref}
          type={actualType}
          max={actualType === 'date' ? (max ?? '9999-12-31') : max}
          onChange={handleChange}
          onBlur={handleBlur}
          className={`w-full px-3.5 py-2 bg-background/80 hover:bg-background border border-border rounded-lg text-main text-sm focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/20 transition-all placeholder:text-muted/60 ${
            isPassword && showPasswordToggle ? 'pr-10' : ''
          } ${className}`}
          {...props}
        />
        {isPassword && showPasswordToggle && (
          <button
            type="button"
            tabIndex={-1}
            onClick={() => setShowPassword((prev) => !prev)}
            aria-label={showPassword ? 'Ocultar senha' : 'Exibir senha'}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted hover:text-main transition-colors p-1 rounded cursor-pointer"
          >
            {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
          </button>
        )}
      </div>
    );
  },
);

Input.displayName = 'Input';
