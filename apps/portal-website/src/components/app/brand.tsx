import { cn } from "@/lib/utils";

// Placeholder brand until the client supplies one (D7).
export const PRODUCT_NAME = "SmartBusiness Checks";

export function BrandMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" className={cn("size-8", className)} aria-hidden="true">
      <rect width="32" height="32" rx="9" fill="#0a0a0b" />
      <rect x="6.5" y="10" width="19" height="12" rx="2" fill="none" stroke="#fff" strokeWidth="1.7" />
      <path d="M9.5 18.5h6M19 14.5h3.5" stroke="#fff" strokeWidth="1.7" strokeLinecap="round" />
    </svg>
  );
}

export function Brand({ className, subtitle = "Check Printing" }: { className?: string; subtitle?: string }) {
  return (
    <div className={cn("flex items-center gap-2.5", className)}>
      <BrandMark />
      <div className="flex flex-col leading-none">
        <span className="text-[0.9375rem] font-semibold tracking-tight">SmartBusiness</span>
        <span className="mt-1 font-mono text-[0.625rem] tracking-wider text-muted uppercase">{subtitle}</span>
      </div>
    </div>
  );
}
