import * as React from "react";
import { AnimatePresence, motion } from "motion/react";
import { Check, Clock, PenLine, Printer } from "lucide-react";
import { BrandCard } from "@/components/app/brand";
import { CheckFace } from "@/components/app/check-face";
import { cn } from "@/lib/utils";

export function AuthLayout({ title, subtitle, children, footer }: { title: string; subtitle?: React.ReactNode; children: React.ReactNode; footer?: React.ReactNode }) {
  return (
    <div className="grid min-h-dvh lg:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)]">
      <div className="flex flex-col px-5 py-6 sm:px-10">
        <BrandCard />
        <div className="flex flex-1 items-center justify-center py-10">
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
            className="w-full max-w-[25rem]"
          >
            <div className="rounded-[1.25rem] border border-line bg-panel shadow-[0_1px_2px_rgb(12_20_39/0.04),0_30px_60px_-30px_rgb(33_86_232/0.3)]">
              <div className="flex flex-col gap-6 p-7 sm:p-8">
                <div className="flex flex-col gap-1.5">
                  <h1 className="text-[1.375rem] font-semibold tracking-tight">{title}</h1>
                  {subtitle && <p className="text-sm text-muted">{subtitle}</p>}
                </div>
                {children}
              </div>
              {footer && <div className="rounded-b-[1.25rem] border-t border-line bg-subtle/60 px-7 py-4 text-center text-sm text-muted sm:px-8">{footer}</div>}
            </div>
          </motion.div>
        </div>
        <p className="text-xs text-faint">Bank details are encrypted at rest. Every action on a check is recorded.</p>
      </div>
      <Showcase />
    </div>
  );
}

const STEPS = [
  { label: "Written", detail: "Jennifer · bookkeeper", icon: PenLine },
  { label: "Approved", detail: "Maria · owner", icon: Clock },
  { label: "Printed", detail: "Office HP · Letter", icon: Printer },
  { label: "Confirmed", detail: "Came out clean", icon: Check },
];

// The product in one loop: a check moves from written to approved to printed.
function Showcase() {
  const [step, setStep] = React.useState(0);
  React.useEffect(() => {
    const t = setInterval(() => setStep((s) => (s + 1) % (STEPS.length + 1)), 1800);
    return () => clearInterval(t);
  }, []);
  const done = Math.min(step, STEPS.length);

  return (
    <div className="relative hidden overflow-hidden border-l border-line bg-subtle lg:flex lg:flex-col lg:justify-center">
      <div className="dot-grid absolute inset-0 opacity-70 [mask-image:radial-gradient(ellipse_at_center,black_30%,transparent_75%)]" />
      <svg className="absolute inset-0 h-full w-full text-line-strong/60" aria-hidden="true">
        {[140, 240, 340, 440].map((r) => (
          <circle key={r} cx="50%" cy="46%" r={r} fill="none" stroke="currentColor" strokeWidth="1" strokeDasharray="2 6" />
        ))}
      </svg>

      <div className="relative mx-auto flex w-full max-w-xl flex-col gap-8 px-10">
        <div className="flex flex-col gap-2">
          <span className="eyebrow">Print checks on plain paper</span>
          <p className="text-[1.65rem] leading-snug font-semibold tracking-tight text-balance">
            From the bookkeeper's draft to a bank-ready check, with every approval on record.
          </p>
        </div>

        <div className="relative">
          <motion.div
            animate={{ y: done >= 3 ? 0 : 10, rotate: done >= 3 ? -1.2 : 0 }}
            transition={{ type: "spring", stiffness: 120, damping: 18 }}
          >
            <CheckFace
              companyName="Green Acres Landscaping LLC"
              addressLine="4120 Ranch Road 620"
              cityLine="Austin, TX 78734"
              bankName="JPMorgan Chase Bank, N.A."
              checkNumber="001043"
              date="10/16/2026"
              payeeName={done >= 1 ? "Hill Country Supply Co." : ""}
              amount={done >= 1 ? "1,250.50" : ""}
              amountInWords={done >= 1 ? "One Thousand Two Hundred Fifty and 50/100" : null}
              memo={done >= 1 ? "Mulch and stone, INV-2231" : ""}
              routingLast4="0021"
              accountLast4="1012"
            />
          </motion.div>
          <AnimatePresence>
            {done >= 4 && (
              <motion.div
                initial={{ opacity: 0, scale: 0.8, y: 6 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className="absolute -top-3 -right-3 flex items-center gap-1.5 rounded-full bg-success-600 px-3 py-1.5 text-xs font-semibold text-white shadow-pop"
              >
                <Check className="size-3.5" strokeWidth={3} /> Printed and confirmed
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <ol className="grid grid-cols-4 gap-2">
          {STEPS.map((s, i) => {
            const reached = i < done;
            const Icon = s.icon;
            return (
              <li key={s.label} className={cn("flex flex-col gap-2 rounded-xl border bg-panel/80 p-3 backdrop-blur transition-all duration-300", reached ? "border-line-strong shadow-card" : "border-line opacity-60")}>
                <span className={cn("flex size-7 items-center justify-center rounded-lg transition-colors duration-300", reached ? "bg-ink text-white" : "bg-subtle text-faint")}>
                  <Icon className="size-3.5" />
                </span>
                <span className="text-[0.8125rem] font-semibold">{s.label}</span>
                <span className="text-[0.6875rem] leading-tight text-muted">{s.detail}</span>
              </li>
            );
          })}
        </ol>
      </div>
    </div>
  );
}
