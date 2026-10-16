import * as React from "react";
import { Check, Eye, EyeOff } from "lucide-react";
import { Input, type InputProps } from "@/components/ui/input";
import { cn } from "@/lib/utils";

export const PasswordInput = React.forwardRef<HTMLInputElement, InputProps>((props, ref) => {
  const [shown, setShown] = React.useState(false);
  return (
    <Input
      ref={ref}
      type={shown ? "text" : "password"}
      trailing={
        <button
          type="button"
          onClick={() => setShown((s) => !s)}
          className="rounded-md p-1.5 text-muted hover:bg-subtle hover:text-ink"
          aria-label={shown ? "Hide password" : "Show password"}
          aria-pressed={shown}
        >
          {shown ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
        </button>
      }
      {...props}
    />
  );
});
PasswordInput.displayName = "PasswordInput";

// The same rules the server applies (platform-api passwordSchema).
export const PASSWORD_RULES = [
  { label: "8+ characters", test: (v: string) => v.length >= 8 },
  { label: "Uppercase", test: (v: string) => /[A-Z]/.test(v) },
  { label: "Lowercase", test: (v: string) => /[a-z]/.test(v) },
  { label: "Number", test: (v: string) => /[0-9]/.test(v) },
  { label: "Symbol", test: (v: string) => /[^A-Za-z0-9]/.test(v) },
];

export function passwordProblem(v: string): string | true {
  const missing = PASSWORD_RULES.filter((r) => !r.test(v));
  return missing.length === 0 ? true : `Add: ${missing.map((r) => r.label.toLowerCase()).join(", ")}`;
}

export function PasswordRules({ value }: { value: string }) {
  return (
    <ul className="flex flex-wrap gap-1.5" aria-label="Password requirements">
      {PASSWORD_RULES.map((r) => {
        const ok = r.test(value);
        return (
          <li key={r.label} className={cn("inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[0.6875rem] font-medium ring-1 ring-inset transition-colors", ok ? "bg-success-50 text-success-700 ring-success-500/25" : "bg-subtle text-muted ring-line")}>
            <Check className={cn("size-3 transition-opacity", ok ? "opacity-100" : "opacity-30")} strokeWidth={3} />
            {r.label}
            <span className="sr-only">{ok ? "(met)" : "(not met)"}</span>
          </li>
        );
      })}
    </ul>
  );
}
