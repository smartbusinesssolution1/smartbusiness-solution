import * as React from "react";
import { Switch as S, Checkbox as C, Select as Sel } from "radix-ui";
import { motion } from "motion/react";
import { Check, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { controlClass } from "./input";

// ─── Switch ────────────────────────────────────────────────

export function Switch({ className, ...props }: React.ComponentProps<typeof S.Root>) {
  return (
    <S.Root
      className={cn(
        "relative inline-flex h-5 w-9 shrink-0 cursor-pointer items-center rounded-full bg-line-strong transition-colors data-[state=checked]:bg-ink disabled:cursor-not-allowed disabled:opacity-50",
        className,
      )}
      {...props}
    >
      <S.Thumb className="block size-4 translate-x-0.5 rounded-full bg-white shadow-sm transition-transform data-[state=checked]:translate-x-[1.125rem]" />
    </S.Root>
  );
}

// ─── Checkbox ──────────────────────────────────────────────

export function Checkbox({ className, ...props }: React.ComponentProps<typeof C.Root>) {
  return (
    <C.Root
      className={cn(
        "flex size-[1.125rem] shrink-0 items-center justify-center rounded-[0.3rem] border border-line-strong bg-panel transition-colors data-[state=checked]:border-ink data-[state=checked]:bg-ink disabled:opacity-50",
        className,
      )}
      {...props}
    >
      <C.Indicator>
        <Check className="size-3 text-white" strokeWidth={3} />
      </C.Indicator>
    </C.Root>
  );
}

// ─── Select ────────────────────────────────────────────────

export function Select({
  value,
  onValueChange,
  placeholder,
  children,
  id,
  className,
  disabled,
  ...aria
}: {
  value?: string;
  onValueChange: (v: string) => void;
  placeholder?: string;
  children: React.ReactNode;
  id?: string;
  className?: string;
  disabled?: boolean;
  "aria-invalid"?: boolean;
  "aria-describedby"?: string;
  "aria-label"?: string;
}) {
  return (
    <Sel.Root value={value} onValueChange={onValueChange} disabled={disabled}>
      <Sel.Trigger id={id} className={cn(controlClass, "flex h-10 items-center justify-between gap-2 text-left data-[placeholder]:text-faint", className)} {...aria}>
        <Sel.Value placeholder={placeholder} />
        <Sel.Icon>
          <ChevronDown className="size-4 text-muted" />
        </Sel.Icon>
      </Sel.Trigger>
      <Sel.Portal>
        <Sel.Content position="popper" sideOffset={6} className="z-50 max-h-72 min-w-[var(--radix-select-trigger-width)] overflow-hidden rounded-xl border border-line bg-panel p-1 shadow-pop data-[state=open]:animate-drop-in">
          <Sel.Viewport>{children}</Sel.Viewport>
        </Sel.Content>
      </Sel.Portal>
    </Sel.Root>
  );
}

export function SelectItem({ value, children, description }: { value: string; children: React.ReactNode; description?: React.ReactNode }) {
  return (
    <Sel.Item value={value} className="relative flex cursor-default flex-col rounded-lg py-2 pr-8 pl-2.5 text-sm outline-none select-none data-[highlighted]:bg-subtle">
      <Sel.ItemText>{children}</Sel.ItemText>
      {description && <span className="text-xs text-muted">{description}</span>}
      <Sel.ItemIndicator className="absolute top-2.5 right-2.5">
        <Check className="size-4" />
      </Sel.ItemIndicator>
    </Sel.Item>
  );
}

// ─── Segmented control (pill tabs with a sliding thumb) ────

export function Segmented<T extends string>({
  value,
  onChange,
  options,
  className,
  size = "md",
  layoutId,
  "aria-label": ariaLabel,
}: {
  value: T;
  onChange: (v: T) => void;
  options: Array<{ value: T; label: React.ReactNode; count?: number }>;
  className?: string;
  size?: "sm" | "md";
  layoutId: string;
  "aria-label": string;
}) {
  return (
    <div role="tablist" aria-label={ariaLabel} className={cn("inline-flex max-w-full gap-0.5 overflow-x-auto rounded-xl bg-subtle p-1 [scrollbar-width:none]", className)}>
      {options.map((o) => {
        const active = o.value === value;
        return (
          <button
            key={o.value}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(o.value)}
            className={cn(
              "relative inline-flex shrink-0 items-center gap-1.5 rounded-lg font-medium transition-colors",
              size === "sm" ? "h-7 px-2.5 text-[0.8125rem]" : "h-8 px-3.5 text-sm",
              active ? "text-ink" : "text-muted hover:text-ink",
            )}
          >
            {active && (
              <motion.span
                layoutId={layoutId}
                className="absolute inset-0 rounded-lg bg-panel shadow-[0_1px_2px_rgb(10_10_11/0.08),0_0_0_1px_rgb(10_10_11/0.04)]"
                transition={{ type: "spring", stiffness: 500, damping: 38 }}
              />
            )}
            <span className="relative">{o.label}</span>
            {o.count !== undefined && o.count > 0 && (
              <span className={cn("relative rounded-md px-1.5 font-mono text-[0.6875rem] num", active ? "bg-subtle text-ink-soft" : "bg-line/70 text-muted")}>{o.count}</span>
            )}
          </button>
        );
      })}
    </div>
  );
}
