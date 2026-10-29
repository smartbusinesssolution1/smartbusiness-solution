import * as React from 'react';
import { Switch as S, Checkbox as C, Select as Sel } from 'radix-ui';
import { Check, ChevronDown } from 'lucide-react';
import { cn } from '../../lib/utils';
import { controlClass } from './input';

// ─── Switch ────────────────────────────────────────────────

export { Switch } from './switch';

// ─── Checkbox ──────────────────────────────────────────────

export function Checkbox({ className, ...props }: React.ComponentProps<typeof C.Root>) {
  return (
    <C.Root
      className={cn(
        'flex size-[1.125rem] shrink-0 items-center justify-center rounded-[0.3rem] border border-line-strong bg-panel transition-colors data-[state=checked]:border-primary-600 data-[state=checked]:bg-primary-600 disabled:opacity-50 cursor-pointer',
        className
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
  size = 'md',
  ...aria
}: {
  value?: string;
  onValueChange: (v: string) => void;
  placeholder?: string;
  children: React.ReactNode;
  id?: string;
  className?: string;
  disabled?: boolean;
  size?: 'sm' | 'md' | 'default';
  'aria-invalid'?: boolean;
  'aria-describedby'?: string;
  'aria-label'?: string;
}) {
  return (
    <Sel.Root value={value} onValueChange={onValueChange} disabled={disabled}>
      <Sel.Trigger
        id={id}
        className={cn(
          controlClass,
          'flex items-center justify-between gap-2 text-left data-[placeholder]:text-faint cursor-pointer',
          size === 'sm' ? 'h-8 text-xs px-2.5' : 'h-9 text-sm px-3',
          className
        )}
        {...aria}
      >
        <Sel.Value placeholder={placeholder} />
        <Sel.Icon>
          <ChevronDown className="size-4 text-muted shrink-0" />
        </Sel.Icon>
      </Sel.Trigger>
      <Sel.Portal>
        <Sel.Content
          position="popper"
          sideOffset={6}
          className="z-50 max-h-72 min-w-[var(--radix-select-trigger-width)] overflow-hidden rounded-xl border border-line bg-panel p-1 shadow-pop data-[state=open]:animate-drop-in"
        >
          <Sel.Viewport className="p-0.5">{children}</Sel.Viewport>
        </Sel.Content>
      </Sel.Portal>
    </Sel.Root>
  );
}

export function SelectItem({
  value,
  children,
  description,
  className,
}: {
  value: string;
  children: React.ReactNode;
  description?: React.ReactNode;
  className?: string;
}) {
  return (
    <Sel.Item
      value={value}
      className={cn(
        'relative flex cursor-pointer select-none flex-col rounded-lg py-1.5 pr-8 pl-2.5 text-xs text-ink outline-none transition-colors data-[highlighted]:bg-subtle data-[state=checked]:font-semibold data-[state=checked]:text-primary-700 dark:data-[state=checked]:text-primary-300',
        className
      )}
    >
      <Sel.ItemText>{children}</Sel.ItemText>
      {description && <span className="text-[11px] text-muted">{description}</span>}
      <Sel.ItemIndicator className="absolute top-2 right-2 flex items-center justify-center">
        <Check className="size-3.5 text-primary-600 dark:text-primary-400 stroke-[2.5]" />
      </Sel.ItemIndicator>
    </Sel.Item>
  );
}

// ─── Segmented control (pill tabs) ─────────────────────────

export function Segmented<T extends string>({
  value,
  onChange,
  options,
  className,
  size = 'md',
  'aria-label': ariaLabel,
}: {
  value: T;
  onChange: (v: T) => void;
  options: Array<{ value: T; label: React.ReactNode; count?: number }>;
  className?: string;
  size?: 'sm' | 'md';
  'aria-label'?: string;
}) {
  return (
    <div
      role="tablist"
      aria-label={ariaLabel}
      className={cn(
        'inline-flex max-w-full gap-0.5 overflow-x-auto rounded-xl bg-subtle p-1 [scrollbar-width:none]',
        className
      )}
    >
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
              'relative inline-flex shrink-0 items-center gap-1.5 rounded-lg font-medium transition-all duration-150 cursor-pointer',
              size === 'sm' ? 'h-7 px-2.5 text-[0.8125rem]' : 'h-8 px-3.5 text-sm',
              active
                ? 'bg-panel text-ink shadow-[0_1px_2px_rgb(10_10_11/0.08),0_0_0_1px_rgb(10_10_11/0.04)] font-semibold'
                : 'text-muted hover:text-ink hover:bg-panel/40'
            )}
          >
            <span className="relative">{o.label}</span>
            {o.count !== undefined && o.count > 0 && (
              <span
                className={cn(
                  'relative rounded-md px-1.5 font-mono text-[0.6875rem] num',
                  active ? 'bg-subtle text-ink-soft' : 'bg-line/70 text-muted'
                )}
              >
                {o.count}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
