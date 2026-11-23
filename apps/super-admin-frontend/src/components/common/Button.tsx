import React from 'react';
import { cn } from '../../utils/cn';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'outline' | 'danger' | 'ghost';
  size?: 'xs' | 'sm' | 'md' | 'lg';
  isLoading?: boolean;
  icon?: React.ReactNode;
}

export const Button: React.FC<ButtonProps> = ({
  children,
  className,
  variant = 'primary',
  size = 'md',
  isLoading = false,
  disabled,
  icon,
  ...props
}) => {
  const baseClasses =
    'inline-flex items-center justify-center font-semibold rounded-[var(--radius-control)] interactive-tap focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer select-none';

  const variantClasses = {
    primary:
      'bg-brand text-white shadow-button hover:brightness-[1.07] active:brightness-[0.96]',
    secondary:
      'bg-subtle text-ink-soft hover:bg-line hover:text-ink active:bg-line-strong',
    outline:
      'border border-line bg-panel text-ink-soft hover:bg-subtle hover:text-ink hover:border-line-strong active:bg-line shadow-2xs',
    danger:
      'bg-rose-600 text-white shadow-xs hover:bg-rose-700 active:bg-rose-800',
    ghost:
      'text-muted hover:text-ink hover:bg-subtle active:bg-line',
  };

  const sizeClasses = {
    xs: 'h-7 px-2.5 text-xs gap-1.5',
    sm: 'h-8 px-3 text-xs gap-1.5',
    md: 'h-9 px-4 text-xs sm:text-sm gap-2',
    lg: 'h-11 px-5 text-sm gap-2.5',
  };

  return (
    <button
      className={cn(baseClasses, variantClasses[variant], sizeClasses[size], className)}
      disabled={disabled || isLoading}
      {...props}
    >
      {isLoading ? (
        <span className="w-3.5 h-3.5 border-2 border-current border-t-transparent rounded-full animate-spin" />
      ) : (
        icon
      )}
      {children}
    </button>
  );
};
