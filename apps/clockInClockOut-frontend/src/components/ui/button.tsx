import * as React from 'react';
import { Slot } from 'radix-ui';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '../../lib/utils';
import { Spinner } from './spinner';

const buttonVariants = cva(
  'inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-lg text-sm font-medium transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-1 disabled:pointer-events-none disabled:opacity-50 [&_svg]:size-4 [&_svg]:shrink-0 active:scale-[0.99] select-none cursor-pointer',
  {
    variants: {
      variant: {
        default:
          'bg-primary-600 text-white shadow-theme-btn hover:bg-primary-700 active:bg-primary-800',
        brand:
          'bg-theme-gradient text-white shadow-theme-btn hover:brightness-105 active:brightness-95',
        destructive:
          'bg-rose-600 text-white shadow-sm hover:bg-rose-700 active:bg-rose-800',
        outline:
          'border border-line bg-panel text-ink shadow-sm hover:bg-subtle hover:border-line-strong hover:text-ink',
        secondary:
          'bg-subtle text-ink shadow-sm hover:bg-slate-200/70',
        ghost:
          'text-ink-soft hover:bg-subtle hover:text-ink',
        link:
          'text-primary-600 underline-offset-4 hover:underline p-0 h-auto',
      },
      size: {
        default: 'h-9 px-4 py-2 text-xs',
        sm: 'h-8 rounded-lg px-3 text-xs',
        lg: 'h-10 rounded-xl px-6 text-sm',
        icon: 'size-9 rounded-lg p-0',
        'icon-sm': 'size-8 rounded-lg p-0',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  }
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
  loading?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, loading = false, disabled, children, ...props }, ref) => {
    const Comp = asChild ? Slot.Root : 'button';
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        disabled={disabled || loading}
        aria-busy={loading || undefined}
        ref={ref}
        {...props}
      >
        {asChild ? (
          children
        ) : (
          <>
            {loading && <Spinner className="size-3.5" />}
            {children}
          </>
        )}
      </Comp>
    );
  }
);
Button.displayName = 'Button';

export { Button, buttonVariants };
