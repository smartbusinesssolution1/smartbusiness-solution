import * as React from 'react';
import { cn } from '../../lib/utils';

export function Field({
  label,
  htmlFor,
  hint,
  error,
  optional,
  aside,
  className,
  children,
}: {
  label: React.ReactNode;
  htmlFor: string;
  hint?: React.ReactNode;
  error?: string;
  optional?: boolean;
  aside?: React.ReactNode;
  className?: string;
  children: React.ReactElement<{
    'aria-invalid'?: boolean;
    'aria-describedby'?: string;
    id?: string;
  }>;
}) {
  const hintId = hint ? `${htmlFor}-hint` : undefined;
  const errorId = error ? `${htmlFor}-error` : undefined;
  const describedBy = [hintId, errorId].filter(Boolean).join(' ') || undefined;

  return (
    <div className={cn('flex flex-col gap-1.5', className)}>
      <div className="flex items-baseline justify-between gap-2">
        <label htmlFor={htmlFor} className="text-[0.8125rem] font-medium text-ink-soft">
          {label}
        </label>
        {optional && <span className="text-xs text-faint">Optional</span>}
        {aside}
      </div>
      {React.cloneElement(children, {
        id: htmlFor,
        'aria-invalid': error ? true : undefined,
        'aria-describedby': describedBy,
      })}
      {hint && !error && (
        <p id={hintId} className="text-xs text-muted">
          {hint}
        </p>
      )}
      {error && (
        <p id={errorId} role="alert" className="text-xs font-medium text-rose-600 animate-in fade-in duration-150">
          {error}
        </p>
      )}
    </div>
  );
}
