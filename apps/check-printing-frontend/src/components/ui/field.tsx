import * as React from "react";
import { AnimatePresence, motion } from "motion/react";
import { cn } from "@/lib/utils";

// A labelled form control with an optional hint and an error that is announced to screen
// readers and tied to the control with aria-describedby.
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
  // Shown at the end of the label row but outside the label (e.g. a "Forgot password?" link).
  aside?: React.ReactNode;
  className?: string;
  children: React.ReactElement<{ "aria-invalid"?: boolean; "aria-describedby"?: string; id?: string }>;
}) {
  const hintId = hint ? `${htmlFor}-hint` : undefined;
  const errorId = error ? `${htmlFor}-error` : undefined;
  const describedBy = [hintId, errorId].filter(Boolean).join(" ") || undefined;
  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      <div className="flex items-baseline justify-between gap-2">
        <label htmlFor={htmlFor} className="text-[0.8125rem] font-medium text-ink-soft">{label}</label>
        {optional && <span className="text-xs text-faint">Optional</span>}
        {aside}
      </div>
      {React.cloneElement(children, { id: htmlFor, "aria-invalid": error ? true : undefined, "aria-describedby": describedBy })}
      {hint && !error && (
        <p id={hintId} className="text-xs text-muted">
          {hint}
        </p>
      )}
      <AnimatePresence initial={false}>
        {error && (
          <motion.p
            id={errorId}
            role="alert"
            initial={{ opacity: 0, y: -2, height: 0 }}
            animate={{ opacity: 1, y: 0, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.15 }}
            className="text-xs font-medium text-danger-600"
          >
            {error}
          </motion.p>
        )}
      </AnimatePresence>
    </div>
  );
}
