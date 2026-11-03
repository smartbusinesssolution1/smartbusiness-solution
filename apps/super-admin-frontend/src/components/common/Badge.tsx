import React from 'react';
import { cn } from '../../utils/cn';

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: 'blue' | 'purple' | 'emerald' | 'amber' | 'rose' | 'slate' | 'indigo';
  size?: 'xs' | 'sm';
  dot?: boolean;
}

export const Badge: React.FC<BadgeProps> = ({
  children,
  className,
  variant = 'slate',
  size = 'xs',
  dot = false,
  ...props
}) => {
  const variantStyles = {
    blue: 'bg-primary-50 text-primary-700 border-primary-200/80',
    purple: 'bg-purple-50 text-purple-700 border-purple-200/80',
    emerald: 'bg-emerald-50 text-emerald-700 border-emerald-200/80',
    amber: 'bg-amber-50 text-amber-800 border-amber-200/80',
    rose: 'bg-rose-50 text-rose-700 border-rose-200/80',
    slate: 'bg-subtle text-muted border-line',
    indigo: 'bg-indigo-50 text-indigo-700 border-indigo-200/80',
  };

  const dotColors = {
    blue: 'bg-primary-500',
    purple: 'bg-purple-500',
    emerald: 'bg-emerald-500',
    amber: 'bg-amber-500',
    rose: 'bg-rose-500',
    slate: 'bg-faint',
    indigo: 'bg-indigo-500',
  };

  const sizeStyles = {
    xs: 'text-[10px] px-2 py-0.5 rounded-md font-bold uppercase tracking-wider',
    sm: 'text-xs px-2.5 py-0.5 rounded-full font-semibold',
  };

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 border leading-none shrink-0 select-none font-mono',
        variantStyles[variant],
        sizeStyles[size],
        className
      )}
      {...props}
    >
      {dot && <span className={cn('w-1.5 h-1.5 rounded-full', dotColors[variant])} />}
      {children}
    </span>
  );
};
