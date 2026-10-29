import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '../../lib/utils';

const badgeVariants = cva(
  'inline-flex items-center rounded-full border px-2.5 py-0.5 text-[0.6875rem] font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2',
  {
    variants: {
      variant: {
        default:
          'border-transparent bg-primary-600 text-white hover:bg-primary-700',
        secondary:
          'border-transparent bg-subtle text-ink hover:bg-slate-200',
        destructive:
          'border-transparent bg-rose-50 text-rose-700 border-rose-200',
        outline:
          'border-line text-ink',
        success:
          'border-emerald-200 bg-emerald-50 text-emerald-700',
        warning:
          'border-amber-200 bg-amber-50 text-amber-700',
        brand:
          'border-transparent bg-primary-50 text-primary-700',
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  }
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return (
    <div className={cn(badgeVariants({ variant }), className)} {...props} />
  );
}

export { Badge, badgeVariants };
