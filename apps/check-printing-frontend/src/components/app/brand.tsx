import * as React from "react";
import { cn } from "@/lib/utils";

// Placeholder brand until the client supplies one (D7).
export const PRODUCT_NAME = "SmartBusiness Checks";

// A check on a navy-to-cobalt tile, with a soft light along the top edge.
export function BrandMark({ className }: { className?: string }) {
  const id = React.useId();
  return (
    <svg viewBox="0 0 32 32" className={cn("size-8", className)} aria-hidden="true">
      <defs>
        <linearGradient id={`${id}-tile`} x1="0" y1="0" x2="32" y2="32" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#0f1d4a" />
          <stop offset="0.5" stopColor="#19337a" />
          <stop offset="1" stopColor="#2156e8" />
        </linearGradient>
        <linearGradient id={`${id}-shine`} x1="0" y1="0" x2="0" y2="16" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#fff" stopOpacity="0.22" />
          <stop offset="1" stopColor="#fff" stopOpacity="0" />
        </linearGradient>
      </defs>
      <rect width="32" height="32" rx="9" fill={`url(#${id}-tile)`} />
      <rect width="32" height="16" rx="9" fill={`url(#${id}-shine)`} />
      <rect x="6.5" y="10" width="19" height="12" rx="2" fill="none" stroke="#fff" strokeWidth="1.7" />
      <path d="M9.5 18.5h6" stroke="#fff" strokeWidth="1.7" strokeLinecap="round" />
      <path d="M19 14.5h3.5" stroke="#a1bbff" strokeWidth="1.7" strokeLinecap="round" />
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
