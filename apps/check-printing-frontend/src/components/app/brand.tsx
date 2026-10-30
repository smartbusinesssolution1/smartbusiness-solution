import { cn } from "@/lib/utils";

// Placeholder brand until the client supplies one (D7).
export const PRODUCT_NAME = "SmartBusiness Checks";

// The Check Printing mark: an outlined printer with a tick (Lucide "printer-check", ISC)
// in primary-600 on a pale blue tile. platform-web's CheckPrintingLogo draws it white on
// the button blue, and public/favicon.svg is a copy of that one (it stands out in a browser
// tab). Change them together.
export function BrandMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 64 64" className={cn("size-8", className)} aria-hidden="true">
      <rect x="0.75" y="0.75" width="62.5" height="62.5" rx="15" fill="#eef4ff" stroke="#d6e3fd" strokeWidth="1.5" />
      <g
        transform="translate(16 16) scale(1.3333)"
        fill="none"
        stroke="#2156e8"
        strokeWidth="2.1"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M13.5 22H7a1 1 0 0 1-1-1v-6a1 1 0 0 1 1-1h10a1 1 0 0 1 1 1v.5" />
        <path d="m16 19 2 2 4-4" />
        <path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v2" />
        <path d="M6 9V3a1 1 0 0 1 1-1h10a1 1 0 0 1 1 1v6" />
      </g>
    </svg>
  );
}

// The sign-in pages' top-left brand: the mark, the company name with a product badge and a
// small caption, straight on the page (no card around it, so it doesn't read as a button).
export function BrandCard({ className }: { className?: string }) {
  return (
    <div className={cn("flex w-fit items-center gap-3", className)}>
      <BrandMark className="size-9" />
      <div className="flex flex-col gap-1 leading-none">
        <div className="flex items-center gap-2">
          <span className="text-[0.9375rem] font-bold tracking-tight">SmartBusiness</span>
          <span className="rounded-full border border-primary-200 bg-primary-50 px-2 py-0.5 text-[0.625rem] font-semibold text-primary-700">
            Check Printing SaaS
          </span>
        </div>
        <span className="font-mono text-[0.625rem] tracking-wider text-muted uppercase">Enterprise check printing</span>
      </div>
    </div>
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
