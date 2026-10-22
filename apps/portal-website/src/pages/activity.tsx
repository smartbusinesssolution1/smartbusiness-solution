import * as React from "react";
import { Link, useSearchParams } from "react-router";
import { AnimatePresence, motion } from "motion/react";
import { ArrowRight, ChevronDown, Code2, FileSearch, Globe, ShieldAlert, X } from "lucide-react";
import {
  ACTIVITY_CATEGORIES,
  exportActivity,
  useActivity,
  useActivityPeople,
  useSecurityLog,
  type ActivityFilters,
  type ActivityItem,
} from "@/api/activity";
import { useSession } from "@/api/auth";
import { useWorkspaceContext } from "@/app/workspace-context";
import { ExportMenu } from "@/components/app/export-menu";
import { EmptyState, ErrorState, Page, PageHeader, Panel, Skeleton } from "@/components/app/layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Segmented, Select, SelectItem } from "@/components/ui/controls";
import { tenantStore } from "@/lib/api";
import { initials } from "@/lib/format";
import { cn } from "@/lib/utils";

// ═══════════════════════════════════════════════════════════════
// ACTIVITY LOG
//
// Who did what, when, from where: the workspace's audit trail for its admins, and the
// company's sign-ins and security events for the company owner. Filters live in the
// address bar (shareable, and the check page links here with ?entityId=). The log
// itself can't be changed by anyone: the database only accepts new entries.
// ═══════════════════════════════════════════════════════════════

const FILTER_KEYS = ["userId", "category", "entityId", "from", "to", "outcome"] as const;
type Tab = "workspace" | "security";

const FAILED = new Set(["LOGIN_FAILED", "LOGIN_FAILED_INACTIVE", "LOGIN_FAILED_NO_TENANT", "REFRESH_FAILED", "ACCESS_DENIED", "ACCOUNT_LOCKED"]);

function useIsCompanyOwner(): boolean {
  const { data: session } = useSession();
  const current = tenantStore.get();
  return session?.tenants.find((t) => t.tenantId === current)?.role === "OWNER";
}

export function ActivityPage() {
  const { wid } = useWorkspaceContext();
  const isOwner = useIsCompanyOwner();
  const [params, setParams] = useSearchParams();
  const tab: Tab = isOwner && params.get("tab") === "security" ? "security" : "workspace";
  const security = tab === "security";

  const all = Object.fromEntries(FILTER_KEYS.map((k) => [k, params.get(k) ?? undefined])) as Record<(typeof FILTER_KEYS)[number], string | undefined>;
  // Each tab takes only its own filters.
  const filters: ActivityFilters = security
    ? { userId: all.userId, outcome: all.outcome, from: all.from, to: all.to }
    : { userId: all.userId, category: all.category, entityId: all.entityId, from: all.from, to: all.to };
  const active = Object.values(filters).some(Boolean);

  const set = (patch: Record<string, string | undefined>) => {
    const next = new URLSearchParams(params);
    for (const [k, v] of Object.entries(patch)) {
      if (v) next.set(k, v);
      else next.delete(k);
    }
    setParams(next, { replace: true });
  };
  const clear = () => set(Object.fromEntries(FILTER_KEYS.map((k) => [k, undefined])));

  const workspaceLog = useActivity(wid, filters);
  const securityLog = useSecurityLog(wid, filters, security);
  const log = security ? securityLog : workspaceLog;
  const people = useActivityPeople(wid, security);
  const items = log.data?.pages.flatMap((p) => p.data) ?? [];
  const badRange = Boolean(filters.from && filters.to && filters.from > filters.to);

  return (
    <Page className="max-w-5xl">
      <PageHeader
        eyebrow="Settings"
        title="Activity log"
        description={
          security
            ? "Sign-ins, failed attempts and refused access for everyone in your company. Only the company owner sees this."
            : "Everything that happened in this workspace: who did it, when, and from where. Entries can never be edited or deleted."
        }
        actions={
          <ExportMenu
            disabled={items.length === 0}
            note={active ? "Every entry matching these filters, newest first. Up to 10,000 per file." : "Every entry, newest first. Up to 10,000 per file; choose dates for more."}
            onExport={(format) => exportActivity(wid, security, filters, format)}
          />
        }
      />

      {isOwner && (
        <Segmented<Tab>
          layoutId="activity-tab"
          aria-label="Which log"
          value={tab}
          onChange={(t) => set({ tab: t === "security" ? "security" : undefined, category: undefined, entityId: undefined, outcome: undefined, userId: undefined })}
          options={[
            { value: "workspace", label: "Workspace activity" },
            { value: "security", label: "Sign-ins and security" },
          ]}
          className="self-start"
        />
      )}

      <div className="flex flex-wrap items-end gap-3">
        <label className="flex flex-col gap-1 text-xs text-muted">
          Who
          <Select value={filters.userId ?? "all"} onValueChange={(v) => set({ userId: v === "all" ? undefined : v })} aria-label="Who" className="h-9 w-52">
            <SelectItem value="all">Everyone</SelectItem>
            {(people.data ?? []).map((p) => (
              <SelectItem key={p.id} value={p.id} description={p.email}>{p.fullName}</SelectItem>
            ))}
          </Select>
        </label>
        {security ? (
          <div className="flex flex-col gap-1 text-xs text-muted">
            Show
            <Segmented
              layoutId="activity-outcome"
              size="sm"
              aria-label="Which events"
              value={filters.outcome ?? "all"}
              onChange={(v) => set({ outcome: v === "failed" ? "failed" : undefined })}
              options={[
                { value: "all", label: "All events" },
                { value: "failed", label: "Failed only" },
              ]}
            />
          </div>
        ) : (
          <label className="flex flex-col gap-1 text-xs text-muted">
            What
            <Select value={filters.category ?? "all"} onValueChange={(v) => set({ category: v === "all" ? undefined : v })} aria-label="Category" className="h-9 w-56">
              <SelectItem value="all">All activity</SelectItem>
              {ACTIVITY_CATEGORIES.map((c) => (
                <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
              ))}
            </Select>
          </label>
        )}
        <label className="flex flex-col gap-1 text-xs text-muted">
          From
          <Input type="date" className="h-9 w-40" value={filters.from ?? ""} max={filters.to} onChange={(e) => set({ from: e.target.value || undefined })} />
        </label>
        <label className="flex flex-col gap-1 text-xs text-muted">
          To
          <Input type="date" className="h-9 w-40" value={filters.to ?? ""} min={filters.from} onChange={(e) => set({ to: e.target.value || undefined })} />
        </label>
        {active && (
          <Button variant="ghost" size="sm" className="mb-0.5" onClick={clear}>
            <X /> Clear
          </Button>
        )}
      </div>

      {filters.entityId && (
        <div className="-mt-2 flex">
          <span className="inline-flex items-center gap-2 rounded-full bg-subtle py-1 pr-1 pl-3 text-xs text-ink-soft">
            Showing one record only
            <button type="button" onClick={() => set({ entityId: undefined })} className="rounded-full p-0.5 hover:bg-line" aria-label="Show all records">
              <X className="size-3.5" />
            </button>
          </span>
        </div>
      )}

      {badRange ? (
        <p className="text-sm text-danger-700">The "To" date is before the "From" date.</p>
      ) : log.error ? (
        <ErrorState error={log.error} onRetry={() => log.refetch()} />
      ) : log.isPending ? (
        <Panel className="flex flex-col gap-3 p-5">{Array.from({ length: 6 }, (_, i) => <Skeleton key={i} className="h-12" />)}</Panel>
      ) : items.length === 0 ? (
        <EmptyState
          icon={security ? <ShieldAlert /> : <FileSearch />}
          title={active ? "Nothing matches these filters" : security ? "No sign-in events yet" : "No activity yet"}
          description={active ? "Try a wider date range or another person." : "Entries appear here as people work."}
        />
      ) : (
        <>
          <DayGroups items={items} wid={wid} />
          {log.hasNextPage && (
            <div className="flex justify-center">
              <Button variant="secondary" loading={log.isFetchingNextPage} onClick={() => log.fetchNextPage()}>
                Show older entries
              </Button>
            </div>
          )}
        </>
      )}
    </Page>
  );
}

// ─── The list, one panel per day ─────────────────────────────

const dayKey = (iso: string) => {
  const d = new Date(iso);
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
};

function dayTitle(iso: string): string {
  const d = new Date(iso);
  const today = new Date();
  const yesterday = new Date(Date.now() - 86_400_000);
  if (dayKey(iso) === dayKey(today.toISOString())) return "Today";
  if (dayKey(iso) === dayKey(yesterday.toISOString())) return "Yesterday";
  return d.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" });
}

function DayGroups({ items, wid }: { items: ActivityItem[]; wid: string }) {
  const groups: Array<{ key: string; title: string; items: ActivityItem[] }> = [];
  for (const item of items) {
    const key = dayKey(item.at);
    const last = groups[groups.length - 1];
    if (last?.key === key) last.items.push(item);
    else groups.push({ key, title: dayTitle(item.at), items: [item] });
  }
  return (
    <div className="flex flex-col gap-5">
      {groups.map((g) => (
        <section key={g.key} className="flex flex-col gap-2">
          <h2 className="eyebrow">{g.title}</h2>
          <Panel className="overflow-hidden">
            <ul className="divide-y divide-line">
              {g.items.map((item) => <Entry key={item.id} item={item} wid={wid} />)}
            </ul>
          </Panel>
        </section>
      ))}
    </div>
  );
}

const LINK_PATH: Record<NonNullable<ActivityItem["link"]>["kind"], (id: string) => string> = {
  check: (id) => `checks/${id}`,
  "bank-account": (id) => `settings/bank-accounts/${id}`,
  payee: () => "payees",
};
const LINK_LABEL: Record<NonNullable<ActivityItem["link"]>["kind"], string> = {
  check: "Open check",
  "bank-account": "Open bank account",
  payee: "Open payees",
};

function Entry({ item, wid }: { item: ActivityItem; wid: string }) {
  const [open, setOpen] = React.useState(false);
  const failed = FAILED.has(item.action);
  const time = new Date(item.at).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
  const hasDetails = Object.keys(item.details).length > 0;

  return (
    <li className={cn("flex gap-3 px-5 py-3.5", failed && "bg-danger-50/40")}>
      <span
        className={cn(
          "mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-full text-[0.6875rem] font-semibold text-white",
          failed ? "bg-danger-600" : "bg-gradient-to-br from-zinc-600 to-zinc-900",
        )}
        aria-hidden
      >
        {initials(item.actor.name)}
      </span>
      <div className="flex min-w-0 flex-1 flex-col gap-1.5">
        <p className="text-sm leading-snug">
          <span className="font-medium">{item.actor.name}</span> <span className={cn(failed ? "text-danger-700" : "text-ink-soft")}>{item.summary}</span>
        </p>

        {item.changes.length > 0 && (
          <dl className="grid w-fit grid-cols-[auto_minmax(0,1fr)] gap-x-4 gap-y-1 rounded-lg bg-subtle/70 px-3 py-2 text-xs">
            {item.changes.map((c) => (
              <React.Fragment key={c.field}>
                <dt className="text-muted">{c.label}</dt>
                <dd className="flex flex-wrap items-center gap-1.5">
                  <span className="text-muted line-through decoration-faint">{c.from}</span>
                  <ArrowRight className="size-3 shrink-0 text-faint" aria-label="changed to" />
                  <span className="font-medium text-ink">{c.to}</span>
                </dd>
              </React.Fragment>
            ))}
          </dl>
        )}

        {item.reason && <p className="border-l-2 border-line-strong pl-2.5 text-xs text-ink-soft italic">“{item.reason}”</p>}

        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted">
          <time dateTime={item.at} title={new Date(item.at).toUTCString()}>{time}</time>
          <span className="rounded-full bg-subtle px-2 py-0.5 text-[0.6875rem] font-medium text-ink-soft">{item.categoryLabel}</span>
          {item.ipAddress && (
            <span className="inline-flex items-center gap-1 font-mono" title="IP address the request came from">
              <Globe className="size-3" /> {item.ipAddress}
            </span>
          )}
          {item.link && (
            <Link to={`/w/${wid}/${LINK_PATH[item.link.kind](item.link.id)}`} className="font-medium text-accent hover:underline">
              {LINK_LABEL[item.link.kind]}
            </Link>
          )}
          {hasDetails && (
            <button type="button" onClick={() => setOpen((o) => !o)} className="inline-flex items-center gap-1 hover:text-ink" aria-expanded={open}>
              <Code2 className="size-3" /> Technical details
              <ChevronDown className={cn("size-3 transition-transform", open && "rotate-180")} />
            </button>
          )}
        </div>

        <AnimatePresence initial={false}>
          {open && (
            <motion.pre
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.18 }}
              className="overflow-hidden rounded-lg bg-ink px-3 py-2 font-mono text-[0.6875rem] leading-relaxed whitespace-pre-wrap break-all text-white/85"
            >
              {item.action}
              {"\n"}
              {JSON.stringify(item.details, null, 2)}
            </motion.pre>
          )}
        </AnimatePresence>
      </div>
    </li>
  );
}
