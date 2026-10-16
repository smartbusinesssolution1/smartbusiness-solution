import { Link, useNavigate } from "react-router";
import { motion } from "motion/react";
import { ArrowRight, ArrowUpRight, Check, FileCheck2, PenLine, Printer, Stamp, TriangleAlert, Wallet, Inbox } from "lucide-react";
import { useSession } from "@/api/auth";
import { useCheckList, useViews } from "@/api/checks";
import type { RegisterView, ViewCount } from "@/api/types";
import { useWorkspaceContext } from "@/app/workspace-context";
import { Button } from "@/components/ui/button";
import { EmptyState, ErrorState, Page, PageHeader, Panel, PanelHeader, Skeleton } from "@/components/app/layout";
import { StatusBadge } from "@/components/app/status";
import { useSetupStatus } from "@/features/setup-status";
import { ago, checkNo, firstName, money } from "@/lib/format";
import { cn } from "@/lib/utils";

const TILES: Array<{ view: RegisterView; title: string; icon: typeof Stamp; to: (wid: string) => string; cta: string; tone?: "warning" }> = [
  { view: "print-unconfirmed", title: "Printed, not confirmed", icon: TriangleAlert, to: (w) => `/w/${w}/print?tab=unconfirmed`, cta: "Report what printed", tone: "warning" },
  { view: "awaiting-my-approval", title: "Awaiting my approval", icon: Stamp, to: (w) => `/w/${w}/approvals`, cta: "Review" },
  { view: "ready-to-print", title: "Ready to print", icon: Printer, to: (w) => `/w/${w}/print`, cta: "Open print station" },
  { view: "my-drafts", title: "My drafts and rejected", icon: PenLine, to: (w) => `/w/${w}/checks?view=my-drafts`, cta: "Continue" },
  { view: "outstanding", title: "Outstanding", icon: Wallet, to: (w) => `/w/${w}/checks?view=outstanding`, cta: "Reconcile" },
];

function greeting(): string {
  const h = new Date().getHours();
  return h < 12 ? "Good morning" : h < 18 ? "Good afternoon" : "Good evening";
}

export function HomePage() {
  const { wid, can, workspace } = useWorkspaceContext();
  const { data: session } = useSession();
  const views = useViews(wid);
  const recent = useCheckList(wid, { limit: 6, sortBy: "createdAt", sortOrder: "desc" }, { enabled: can("check:view") });
  const navigate = useNavigate();

  const byView = new Map(views.data?.map((v) => [v.view, v]) ?? []);
  const tiles = TILES.filter((t) => byView.has(t.view)).filter((t) => t.view !== "print-unconfirmed" || (byView.get(t.view)?.count ?? 0) > 0);

  return (
    <Page>
      <PageHeader
        eyebrow={new Intl.DateTimeFormat("en-US", { weekday: "long", month: "long", day: "numeric" }).format(new Date())}
        title={`${greeting()}, ${session ? firstName(session.user.fullName) : ""}`}
        description={`Here's what needs attention at ${workspace.businessName}.`}
        actions={
          can("check:create") && (
            <Button asChild>
              <Link to={`/w/${wid}/checks/new`}>
                <PenLine /> Write check
              </Link>
            </Button>
          )
        }
      />

      <SetupCard />

      {views.error ? (
        <ErrorState error={views.error} onRetry={() => views.refetch()} />
      ) : (
        <div className="grid grid-cols-[repeat(auto-fill,minmax(12.5rem,1fr))] gap-3">
          {views.isPending
            ? Array.from({ length: 4 }, (_, i) => <Skeleton key={i} className="h-[8.5rem] rounded-[var(--radius-card)]" />)
            : tiles.map((t, i) => <QueueTile key={t.view} tile={t} data={byView.get(t.view)!} index={i} onOpen={() => navigate(t.to(wid))} />)}
        </div>
      )}

      {can("check:view") && (
        <Panel>
          <PanelHeader
            title="Recent checks"
            description="The latest checks written in this workspace."
            action={
              <Button variant="ghost" size="sm" asChild>
                <Link to={`/w/${wid}/checks`}>
                  View all <ArrowRight />
                </Link>
              </Button>
            }
          />
          {recent.isPending ? (
            <div className="flex flex-col gap-3 p-5">
              {Array.from({ length: 4 }, (_, i) => <Skeleton key={i} className="h-9" />)}
            </div>
          ) : recent.error ? (
            <div className="p-5"><ErrorState error={recent.error} onRetry={() => recent.refetch()} /></div>
          ) : recent.data.data.length === 0 ? (
            <div className="p-5">
              <EmptyState
                icon={<Inbox />}
                title="No checks yet"
                description="Checks you write appear here with their status, from draft to cleared."
                action={can("check:create") && <Button asChild size="sm"><Link to={`/w/${wid}/checks/new`}><PenLine /> Write your first check</Link></Button>}
              />
            </div>
          ) : (
            <ul className="divide-y divide-line">
              {recent.data.data.map((c) => (
                <li key={c.id}>
                  <Link to={`/w/${wid}/checks/${c.id}`} className="grid grid-cols-[4.5rem_minmax(0,1fr)_auto] items-center gap-3 px-5 py-3 transition-colors hover:bg-subtle/60 sm:grid-cols-[4.5rem_minmax(0,1fr)_8rem_10rem_6rem]">
                    <span className="font-mono text-[0.8125rem] text-muted num">#{checkNo(c.checkNumber)}</span>
                    <span className="truncate text-sm font-medium">{c.payeeName}</span>
                    <span className="text-right font-mono text-sm num">{money(c.amount)}</span>
                    <span className="hidden sm:block"><StatusBadge status={c.status} voidType={c.voidType} unconfirmed={c.status === "PRINTED" && !c.printConfirmedAt} /></span>
                    <span className="hidden text-right text-xs text-muted sm:block">{ago(c.createdAt)}</span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      )}
    </Page>
  );
}

function QueueTile({ tile, data, index, onOpen }: { tile: (typeof TILES)[number]; data: ViewCount; index: number; onOpen: () => void }) {
  const Icon = tile.icon;
  const warning = tile.tone === "warning";
  const empty = data.count === 0;
  return (
    <motion.button
      type="button"
      onClick={onOpen}
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.05, duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
      className={cn(
        "group flex flex-col gap-3 rounded-[var(--radius-card)] border p-4 text-left shadow-card transition-all hover:-translate-y-0.5",
        warning ? "border-warning-500/40 bg-warning-50" : "border-line bg-panel hover:border-line-strong",
      )}
    >
      <div className="flex items-center justify-between">
        <span className={cn("flex size-8 items-center justify-center rounded-lg", warning ? "bg-warning-500/15 text-warning-700" : "bg-subtle text-ink-soft")}>
          <Icon className="size-4" />
        </span>
        <ArrowUpRight className={cn("size-4 transition-all group-hover:translate-x-0.5 group-hover:-translate-y-0.5", warning ? "text-warning-700" : "text-faint group-hover:text-ink")} />
      </div>
      <div className="flex flex-col gap-0.5">
        <span className={cn("text-[0.8125rem]", warning ? "font-medium text-warning-700" : "text-muted")}>{tile.title}</span>
        <div className="flex items-baseline gap-2">
          <span className={cn("font-mono text-[1.75rem] leading-none font-medium tracking-tight num", empty && !warning && "text-faint")}>{data.count}</span>
          {!empty && <span className="font-mono text-xs text-muted num">{money(data.amount)}</span>}
        </div>
      </div>
      <span className={cn("text-xs font-medium", warning ? "text-warning-700" : empty ? "text-faint" : "text-accent")}>{empty ? "Nothing waiting" : tile.cta}</span>
    </motion.button>
  );
}

function SetupCard() {
  const { wid } = useWorkspaceContext();
  const setup = useSetupStatus();
  if (setup.isLoading || setup.complete || !setup.known) return null;
  const pct = Math.round((setup.doneCount / setup.total) * 100);

  return (
    <Panel className="relative overflow-hidden">
      <div className="dot-grid absolute inset-y-0 right-0 w-1/2 opacity-60 [mask-image:linear-gradient(to_left,black,transparent)]" />
      <div className="relative flex flex-col gap-5 p-5 sm:p-6 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex max-w-md flex-col gap-2">
          <span className="eyebrow">Get ready to print · {setup.doneCount} of {setup.total}</span>
          <h2 className="text-lg font-semibold tracking-tight">{setup.next ? `Next: ${setup.next.label.toLowerCase()}` : "Almost there"}</h2>
          <p className="text-sm text-muted">{setup.next?.description ?? "Someone with the right access needs to finish the remaining steps."}</p>
          <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-line">
            <motion.div className="h-full rounded-full bg-ink" initial={{ width: 0 }} animate={{ width: `${pct}%` }} transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }} />
          </div>
        </div>
        <div className="flex flex-col gap-3 lg:items-end">
          <ol className="flex flex-wrap gap-1.5">
            {setup.steps.map((s) => (
              <li key={s.key} className={cn("inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ring-1 ring-inset", s.done ? "bg-success-50 text-success-700 ring-success-500/25" : "bg-panel text-muted ring-line")}>
                {s.done ? <Check className="size-3" strokeWidth={3} /> : <span className="size-1.5 rounded-full bg-current opacity-50" />}
                {s.label}
              </li>
            ))}
          </ol>
          <div className="flex gap-2">
            <Button variant="secondary" asChild>
              <Link to={`/w/${wid}/setup`}>
                <FileCheck2 /> See all steps
              </Link>
            </Button>
            {setup.next && (
              <Button asChild>
                <Link to={`/w/${wid}/${setup.next.to}`}>
                  {setup.next.cta} <ArrowRight />
                </Link>
              </Button>
            )}
          </div>
        </div>
      </div>
    </Panel>
  );
}
