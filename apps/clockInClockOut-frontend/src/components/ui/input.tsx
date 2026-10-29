import * as React from 'react';
import { cn } from '../../lib/utils';

export const controlClass =
  'w-full rounded-[var(--radius-control)] border border-line bg-panel px-3 text-sm text-ink placeholder:text-faint shadow-[0_1px_2px_rgb(10_10_11/0.03)] transition-[border-color,box-shadow] outline-none hover:border-line-strong focus-visible:border-accent focus-visible:ring-4 focus-visible:ring-primary-100 dark:focus-visible:ring-primary-950/60 focus-visible:outline-none disabled:cursor-not-allowed disabled:bg-subtle disabled:text-muted aria-[invalid=true]:border-rose-500 aria-[invalid=true]:focus-visible:ring-rose-50';

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  leading?: React.ReactNode;
  trailing?: React.ReactNode;
  error?: boolean;
}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, leading, trailing, error, ...props }, ref) => {
    if (!leading && !trailing) {
      return (
        <input
          ref={ref}
          aria-invalid={error ? true : undefined}
          className={cn(
            controlClass,
            'h-9',
            error && 'border-rose-500 focus-visible:ring-rose-100 dark:focus-visible:ring-rose-950/60',
            className
          )}
          {...props}
        />
      );
    }
    return (
      <div className="relative w-full">
        {leading && (
          <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-muted [&_svg]:size-4">
            {leading}
          </span>
        )}
        <input
          ref={ref}
          aria-invalid={error ? true : undefined}
          className={cn(
            controlClass,
            'h-9',
            leading && 'pl-9',
            trailing && 'pr-10',
            error && 'border-rose-500 focus-visible:ring-rose-100 dark:focus-visible:ring-rose-950/60',
            className
          )}
          {...props}
        />
        {trailing && (
          <span className="absolute inset-y-0 right-2.5 flex items-center text-muted">
            {trailing}
          </span>
        )}
      </div>
    );
  }
);
Input.displayName = 'Input';

export const Textarea = React.forwardRef<
  HTMLTextAreaElement,
  React.TextareaHTMLAttributes<HTMLTextAreaElement>
>(({ className, ...props }, ref) => (
  <textarea
    ref={ref}
    className={cn(controlClass, 'min-h-20 py-2 leading-relaxed', className)}
    {...props}
  />
));
Textarea.displayName = 'Textarea';
