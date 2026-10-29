import * as React from "react";
import { cn } from "@/lib/utils";

// Placeholder brand until the client supplies one (D7).
export const PRODUCT_NAME = "SmartBusiness Checks";

// The Check Printing mark: a white printer with a printed sheet on a sky-to-cobalt tile
// (ends on primary-600). The same drawing is public/favicon.svg and platform-web's
// CheckPrintingLogo; change all three together.
export function BrandMark({ className }: { className?: string }) {
  const id = React.useId();
  const tile = `url(#${id}-tile)`;
  return (
    <svg viewBox="0 0 64 64" className={cn("size-8", className)} aria-hidden="true">
      <defs>
        <linearGradient id={`${id}-tile`} x1="0" y1="0" x2="64" y2="64" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#62a8f2" />
          <stop offset="1" stopColor="#2156e8" />
        </linearGradient>
        <linearGradient id={`${id}-shine`} x1="0" y1="0" x2="0" y2="32" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#fff" stopOpacity="0.18" />
          <stop offset="1" stopColor="#fff" stopOpacity="0" />
        </linearGradient>
      </defs>
      <rect width="64" height="64" rx="15" fill={tile} />
      <rect width="64" height="32" rx="15" fill={`url(#${id}-shine)`} />
      {/* Paper tray, printer body, status light */}
      <rect x="21" y="12.5" width="22" height="13" rx="3.5" fill="none" stroke="#fff" strokeWidth="4" />
      <rect x="11" y="23" width="42" height="20" rx="5.5" fill="#fff" />
      <circle cx="46" cy="29.5" r="2.3" fill={tile} />
      {/* The printed sheet, set off from the body by a tile-coloured gap, with two lines */}
      <rect x="19" y="35" width="26" height="17.5" rx="3" fill="#fff" stroke={tile} strokeWidth="3" />
      <path d="M24.5 41.5h15M24.5 46.5h15" stroke={tile} strokeWidth="2.6" strokeLinecap="round" />
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
