import { Link } from "react-router";
import { motion } from "motion/react";
import { ArrowRight, Building2, Check, Landmark, PenTool, Printer, ScanLine, PartyPopper } from "lucide-react";
import { useWorkspaceContext } from "@/app/workspace-context";
import { Button } from "@/components/ui/button";
import { Page, PageHeader, Panel, Skeleton } from "@/components/app/layout";
import { useSetupStatus, type SetupStepKey } from "@/features/setup-status";
import { cn } from "@/lib/utils";

const ICONS: Record<SetupStepKey, typeof Landmark> = {
  business: Building2,
  bank: Landmark,
  signature: PenTool,
  printer: Printer,
  verify: ScanLine,
};

const TIME: Record<SetupStepKey, string> = {
  business: "Done",
  bank: "2 min",
  signature: "1 min",
  printer: "5 min · needs a ruler",
  verify: "3 min · needs a ruler",
};

export function SetupGuidePage() {
  const { wid } = useWorkspaceContext();
  const setup = useSetupStatus();

  return (
    <Page className="max-w-3xl">
      <PageHeader
        eyebrow="Setup"
        title="Get ready to print checks"
        description="Five steps, about ten minutes. Your team can start writing checks before you finish; printing waits until the printer is verified."
      />

      {setup.complete && (
        <motion.div initial={{ opacity: 0, scale: 0.98 }} animate={{ opacity: 1, scale: 1 }}>
          <Panel className="flex flex-wrap items-center justify-between gap-4 p-5">
            <div className="flex items-center gap-3">
              <span className="flex size-10 items-center justify-center rounded-xl bg-success-50 text-success-600 ring-1 ring-success-500/20">
                <PartyPopper className="size-5" />
              </span>
              <div>
                <p className="font-semibold">You're ready to print</p>
                <p className="text-sm text-muted">Bank account, signature and a verified printer are in place.</p>
              </div>
            </div>
            <Button asChild>
              <Link to={`/w/${wid}/checks/new`}>Write a check <ArrowRight /></Link>
            </Button>
          </Panel>
        </motion.div>
      )}

      <ol className="relative flex flex-col gap-3">
        <span className="absolute top-6 bottom-6 left-[1.6rem] w-px bg-line" aria-hidden="true" />
        {setup.isLoading
          ? Array.from({ length: 5 }, (_, i) => <Skeleton key={i} className="h-24 rounded-[var(--radius-card)]" />)
          : setup.steps.map((s, i) => {
              const Icon = ICONS[s.key];
              const isNext = setup.next?.key === s.key;
              return (
                <motion.li
                  key={s.key}
                  initial={{ opacity: 0, x: -6 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.05 }}
                  className={cn(
                    "relative flex flex-col gap-4 rounded-[var(--radius-card)] border bg-panel p-4 shadow-card sm:flex-row sm:items-center sm:p-5",
                    isNext ? "border-ink/80 ring-4 ring-ink/5" : "border-line",
                  )}
                >
                  <span
                    className={cn(
                      "relative z-10 flex size-[2.2rem] shrink-0 items-center justify-center rounded-xl",
                      s.done ? "bg-success-600 text-white" : isNext ? "bg-ink text-white" : "bg-subtle text-muted",
                    )}
                  >
                    {s.done ? <Check className="size-4" strokeWidth={3} /> : <Icon className="size-4" />}
                  </span>
                  <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-mono text-xs text-faint">0{i + 1}</span>
                      <p className="font-semibold">{s.label}</p>
                      <span className="rounded-full bg-subtle px-2 py-0.5 font-mono text-[0.6875rem] text-muted">{s.done ? "Done" : TIME[s.key]}</span>
                    </div>
                    <p className="text-sm text-muted">{s.description}</p>
                  </div>
                  {s.canAct ? (
                    <Button variant={isNext ? "primary" : "secondary"} asChild className="shrink-0">
                      <Link to={`/w/${wid}/${s.to}`}>
                        {s.done ? "Review" : s.cta} <ArrowRight />
                      </Link>
                    </Button>
                  ) : (
                    !s.done && <span className="shrink-0 text-xs text-muted">{s.waitingFor ?? "Needs an admin"}</span>
                  )}
                </motion.li>
              );
            })}
      </ol>
    </Page>
  );
}
