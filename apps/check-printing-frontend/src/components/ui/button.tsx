import * as React from "react";
import { Slot } from "radix-ui";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";
import { Spinner } from "./spinner";

const buttonVariants = cva(
  "relative inline-flex items-center justify-center gap-2 whitespace-nowrap font-medium select-none transition-[background-color,box-shadow,transform,color,border-color] duration-150 active:translate-y-px disabled:pointer-events-none disabled:opacity-50 [&_svg]:size-4 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        primary: "bg-brand text-white shadow-button hover:brightness-[1.07] active:brightness-95",
        secondary: "bg-panel text-ink border border-line shadow-[0_1px_2px_rgb(12_20_39/0.04)] hover:border-primary-200 hover:bg-primary-50/40 hover:text-primary-800",
        ghost: "text-ink-soft hover:bg-subtle hover:text-ink",
        danger: "bg-danger-600 text-white shadow-[0_1px_2px_rgb(185_28_28/0.3)] hover:bg-danger-700",
        "danger-soft": "bg-danger-50 text-danger-700 hover:bg-danger-50/70 border border-danger-500/20",
        link: "text-accent underline-offset-4 hover:underline px-0 h-auto",
      },
      size: {
        sm: "h-8 rounded-lg px-3 text-[0.8125rem]",
        md: "h-9 rounded-[var(--radius-control)] px-3.5 text-sm",
        lg: "h-11 rounded-xl px-5 text-[0.9375rem]",
        icon: "size-9 rounded-[var(--radius-control)]",
        "icon-sm": "size-8 rounded-lg",
      },
    },
    defaultVariants: { variant: "primary", size: "md" },
  },
);

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement>, VariantProps<typeof buttonVariants> {
  asChild?: boolean;
  loading?: boolean;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild, loading, disabled, children, ...props }, ref) => {
    const Comp = asChild ? Slot.Root : "button";
    return (
      <Comp
        ref={ref}
        className={cn(buttonVariants({ variant, size }), className)}
        disabled={disabled || loading}
        aria-busy={loading || undefined}
        {...props}
      >
        {asChild ? (
          children
        ) : (
          <>
            {loading && (
              <span className="absolute inset-0 flex items-center justify-center">
                <Spinner />
              </span>
            )}
            <span className={cn("inline-flex items-center gap-2", loading && "invisible")}>{children}</span>
          </>
        )}
      </Comp>
    );
  },
);
Button.displayName = "Button";

export { buttonVariants };
