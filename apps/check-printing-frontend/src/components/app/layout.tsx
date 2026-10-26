import * as React from "react";
import { motion } from "motion/react";
import { AlertCircle, RotateCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { errorMessage } from "@/lib/api";
import { cn } from "@/lib/utils";

// A white surface on the grey canvas. Used for the one block that needs separating, not
// wrapped around everything.
export function Panel({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("rounded-[var(--radius-card)] border border-line bg-panel shadow-card", className)} {...props} />;
}

export function PanelHeader({ title, description, action, className }: { title: React.ReactNode; description?: React.ReactNode; action?: React.ReactNode; className?: string }) {
  return (
    <div className={cn("flex flex-wrap items-start justify-between gap-3 border-b border-line px-5 py-4", className)}>
      <div className="flex min-w-0 flex-col gap-0.5">
        <h2 className="text-[0.9375rem] font-semibold tracking-tight">{title}</h2>
        {description && <p className="text-[0.8125rem] text-muted">{description}</p>}
      </div>
      {action}
    </div>
  );
}

export function PageHeader({
  eyebrow,
  title,
  description,
  actions,
  back,
}: {
  eyebrow?: React.ReactNode;
  title: React.ReactNode;
  description?: React.ReactNode;
  actions?: React.ReactNode;
  back?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-4">
      {back}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="flex min-w-0 flex-col gap-1.5">
          {eyebrow && <span className="eyebrow">{eyebrow}</span>}
          <h1 className="text-[1.625rem] leading-tight font-semibold tracking-[-0.02em] sm:text-[1.75rem]">{title}</h1>
          {description && <p className="max-w-2xl text-sm leading-relaxed text-muted">{description}</p>}
        </div>
        {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
      </div>
    </div>
  );
}

// Each page fades up slightly on arrival; long enough to read as a change of place,
// short enough never to slow anyone down.
export function Page({ className, children }: { className?: string; children: React.ReactNode }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
      className={cn("mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 py-6 sm:px-6 lg:px-8 lg:py-8", className)}
    >
      {children}
    </motion.div>
  );
}

export function EmptyState({
  icon,
  title,
  description,
  action,
  className,
}: {
  icon: React.ReactNode;
  title: React.ReactNode;
  description?: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("dot-grid flex flex-col items-center justify-center gap-3 rounded-[var(--radius-card)] border border-dashed border-line-strong px-6 py-12 text-center", className)}>
      <div className="flex size-11 items-center justify-center rounded-xl border border-primary-100 bg-panel text-primary-600 shadow-card [&_svg]:size-5">{icon}</div>
      <div className="flex max-w-sm flex-col gap-1">
        <p className="font-semibold">{title}</p>
        {description && <p className="text-sm leading-relaxed text-muted">{description}</p>}
      </div>
      {action && <div className="mt-1">{action}</div>}
    </div>
  );
}

export function ErrorState({ error, onRetry, className }: { error: unknown; onRetry?: () => void; className?: string }) {
  return (
    <div role="alert" className={cn("flex flex-col items-center justify-center gap-3 rounded-[var(--radius-card)] border border-danger-500/20 bg-danger-50/50 px-6 py-10 text-center", className)}>
      <AlertCircle className="size-5 text-danger-600" />
      <div className="flex max-w-md flex-col gap-1">
        <p className="font-semibold">This didn't load</p>
        <p className="text-sm text-muted">{errorMessage(error)}</p>
      </div>
      {onRetry && (
        <Button variant="secondary" size="sm" onClick={onRetry}>
          <RotateCw /> Try again
        </Button>
      )}
    </div>
  );
}

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn("skeleton h-4", className)} aria-hidden="true" />;
}

export function InlineAlert({ tone = "info", title, children, action, className }: { tone?: "info" | "warning" | "danger" | "success"; title?: React.ReactNode; children?: React.ReactNode; action?: React.ReactNode; className?: string }) {
  const tones = {
    info: "border-primary-500/20 bg-primary-50/60 text-primary-900",
    warning: "border-warning-500/30 bg-warning-50 text-warning-700",
    danger: "border-danger-500/25 bg-danger-50 text-danger-700",
    success: "border-success-500/25 bg-success-50 text-success-700",
  };
  return (
    <div role={tone === "danger" ? "alert" : "status"} className={cn("flex flex-wrap items-start justify-between gap-3 rounded-xl border px-4 py-3 text-sm", tones[tone], className)}>
      <div className="flex min-w-0 flex-col gap-0.5">
        {title && <p className="font-semibold">{title}</p>}
        {children && <div className="leading-relaxed opacity-90">{children}</div>}
      </div>
      {action}
    </div>
  );
}
