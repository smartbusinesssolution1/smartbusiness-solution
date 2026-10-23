import * as React from "react";
import { CalendarDays } from "lucide-react";
import { Input, type InputProps } from "@/components/ui/input";
import { caretFromEnd, formatAmountTyping, formatDateTyping, isIsoDate, isoToUs } from "@/lib/check-inputs";

// The amount and date fields of a check, formatted as you type the way the check prints them:
// 1,250.50 and 10/22/2026, whatever the computer's own region settings are.

type BaseProps = Omit<InputProps, "value" | "onChange" | "type" | "max" | "min">;

// Reformatting moves the caret to the end; this puts it back where the person was typing.
function useCaret(ref: React.ForwardedRef<HTMLInputElement>) {
  const inner = React.useRef<HTMLInputElement>(null);
  React.useImperativeHandle(ref, () => inner.current!);
  const caret = React.useRef<number | null>(null);
  // Forces a render even when the value didn't change (a refused keystroke), so the caret
  // is restored after React puts the old value back.
  const [, rerender] = React.useReducer((n: number) => n + 1, 0);
  React.useLayoutEffect(() => {
    const el = inner.current;
    if (caret.current !== null && el && document.activeElement === el) el.setSelectionRange(caret.current, caret.current);
    caret.current = null;
  });
  const place = (at: number) => {
    caret.current = at;
    rerender();
  };
  return { inner, place };
}

// Backspace just after a separator (the comma in 1,250) deletes the digit before it instead
// of doing nothing visible; Delete just before one does the same forwards.
function skipSeparator(e: React.KeyboardEvent<HTMLInputElement>, separator: string) {
  const el = e.currentTarget;
  const at = el.selectionStart;
  if (at === null || at !== el.selectionEnd) return;
  if (e.key === "Backspace" && el.value[at - 1] === separator) el.setSelectionRange(at - 1, at - 1);
  if (e.key === "Delete" && el.value[at] === separator) el.setSelectionRange(at + 1, at + 1);
}

export interface AmountInputProps extends BaseProps {
  value: string;
  onChange: (value: string) => void;
  max: number;
  // A keystroke would have taken the amount over `max`, so it was refused.
  onRefuse?: () => void;
}

export const AmountInput = React.forwardRef<HTMLInputElement, AmountInputProps>(({ value, onChange, max, onRefuse, onKeyDown, ...props }, ref) => {
  const { inner, place } = useCaret(ref);
  return (
    <Input
      ref={inner}
      inputMode="decimal"
      autoComplete="off"
      value={value}
      onKeyDown={(e) => {
        skipSeparator(e, ",");
        onKeyDown?.(e);
      }}
      onChange={(e) => {
        const el = e.target;
        const at = el.selectionStart ?? el.value.length;
        const next = formatAmountTyping(el.value, max);
        if (next === null) {
          // Keep the caret where it was before the refused characters went in.
          place(Math.max(0, at - (el.value.length - value.length)));
          onRefuse?.();
          return;
        }
        place(caretFromEnd(next, el.value.slice(at), /[\d.]/));
        onChange(next);
      }}
      {...props}
    />
  );
});
AmountInput.displayName = "AmountInput";

export interface CheckDateInputProps extends BaseProps {
  // The ISO date ("2026-10-22") once a real day is typed or picked; until then the text typed so far.
  value: string;
  onChange: (value: string) => void;
  min?: string;
  max?: string;
}

export const CheckDateInput = React.forwardRef<HTMLInputElement, CheckDateInputProps>(({ value, onChange, min, max, onKeyDown, className, ...props }, ref) => {
  const { inner, place } = useCaret(ref);
  const picker = React.useRef<HTMLInputElement>(null);
  const iso = isIsoDate(value) ? value : "";

  const openCalendar = () => {
    try {
      picker.current?.showPicker();
    } catch {
      inner.current?.focus();
    }
  };

  return (
    <div className="relative">
      <Input
        ref={inner}
        inputMode="numeric"
        autoComplete="off"
        placeholder="MM/DD/YYYY"
        value={iso ? isoToUs(iso) : value}
        className={className}
        onKeyDown={(e) => {
          skipSeparator(e, "/");
          onKeyDown?.(e);
        }}
        onChange={(e) => {
          const el = e.target;
          const at = el.selectionStart ?? el.value.length;
          const next = formatDateTyping(el.value);
          place(caretFromEnd(next.text, el.value.slice(at), /\d/));
          onChange(next.iso ?? next.text);
        }}
        trailing={
          <button type="button" aria-label="Choose from a calendar" onClick={openCalendar} className="rounded-md p-1 text-muted hover:bg-subtle hover:text-ink">
            <CalendarDays className="size-4" />
          </button>
        }
        {...props}
      />
      {/* The browser's own calendar, opened by the button; its own text box is never shown,
          because it would display the date in the computer's region format. */}
      <input
        ref={picker}
        type="date"
        tabIndex={-1}
        aria-hidden="true"
        min={min}
        max={max}
        value={iso}
        onChange={(e) => e.target.value && onChange(e.target.value)}
        className="pointer-events-none absolute right-0 bottom-0 h-px w-px opacity-0"
      />
    </div>
  );
});
CheckDateInput.displayName = "CheckDateInput";
