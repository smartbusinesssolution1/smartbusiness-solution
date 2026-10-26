import { Ban, CheckCheck, CircleDashed, Clock, Printer, ThumbsUp, Undo2, TriangleAlert } from "lucide-react";
import type { CheckStatus, VoidType } from "@/api/types";
import { cn } from "@/lib/utils";

// Status is shown with an icon and words, never colour alone (WCAG 1.4.1).
const STATUS: Record<CheckStatus, { label: string; tone: string; icon: typeof Clock }> = {
  NEW: { label: "New", tone: "bg-subtle text-ink-soft ring-line", icon: CircleDashed },
  PENDING_APPROVAL: { label: "Awaiting approval", tone: "bg-warning-50 text-warning-700 ring-warning-500/25", icon: Clock },
  APPROVED: { label: "Approved", tone: "bg-success-50 text-success-700 ring-success-500/25", icon: ThumbsUp },
  REJECTED: { label: "Rejected", tone: "bg-danger-50 text-danger-700 ring-danger-500/20", icon: Undo2 },
  PRINTED: { label: "Printed", tone: "bg-primary-50 text-primary-700 ring-primary-500/20", icon: Printer },
  // Settled: the deep end of the blue lifecycle (Printed is the light end).
  CLEARED: { label: "Cleared", tone: "bg-primary-900 text-white ring-primary-900", icon: CheckCheck },
  VOID: { label: "Void", tone: "bg-danger-50 text-danger-700 ring-danger-500/20", icon: Ban },
};

const VOID_LABEL: Record<VoidType, string> = {
  CANCELLED: "Cancelled",
  SPOILED: "Spoiled",
  VOIDED_AFTER_PRINT: "Voided after print",
};

export function statusLabel(status: CheckStatus, voidType?: VoidType | null): string {
  if (status === "VOID" && voidType) return `Void · ${VOID_LABEL[voidType]}`;
  return STATUS[status].label;
}

export function StatusBadge({
  status,
  voidType,
  unconfirmed,
  className,
}: {
  status: CheckStatus;
  voidType?: VoidType | null;
  unconfirmed?: boolean;
  className?: string;
}) {
  if (status === "PRINTED" && unconfirmed) {
    return (
      <span className={cn("inline-flex items-center gap-1 rounded-full bg-warning-50 px-2 py-0.5 text-xs font-medium whitespace-nowrap text-warning-700 ring-1 ring-warning-500/30 ring-inset", className)}>
        <TriangleAlert className="size-3" aria-hidden="true" />
        Printed · not confirmed
      </span>
    );
  }
  const s = STATUS[status];
  const Icon = s.icon;
  return (
    <span className={cn("inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium whitespace-nowrap ring-1 ring-inset", s.tone, className)}>
      <Icon className="size-3" aria-hidden="true" />
      {statusLabel(status, voidType)}
    </span>
  );
}
