import * as React from "react";
import { Link } from "react-router";
import { motion } from "motion/react";
import { toast } from "sonner";
import { Download, Hash, Hourglass, Landmark } from "lucide-react";
import { downloadPositivePay, exportNumberAudit, exportOutstanding, useAging, useCheckList, useNumberIntegrity } from "@/api/checks";
import { useBankAccounts } from "@/api/setup";
import { useWorkspaceContext } from "@/app/workspace-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectItem } from "@/components/ui/controls";
import { Tooltip } from "@/components/ui/menu";
import { ErrorState, Page, PageHeader, Panel, PanelHeader, Skeleton } from "@/components/app/layout";
import { ExportMenu } from "@/components/app/export-menu";
import { errorMessage } from "@/lib/api";
import { money, todayIso } from "@/lib/format";
import { cn } from "@/lib/utils";

export function ReportsPage() {
  const { can } = useWorkspaceContext();
  return (
    <Page>
      <PageHeader eyebrow="Reports" title="Reports" description="Outstanding checks for reconciliation, and an audit of every check number. Each report downloads as Excel, CSV or PDF; the full check register exports from the Checks page." />
      <AgingReport />
      <NumberIntegrityReport />
      {can("bank-account:manage") && <PositivePayPanel />}
    </Page>
  );
}

interface ReportAccount {
  id: string;
  bankName: string;
  accountNumber: string;
  nextCheckNumber: number;
  // false when worked out from checks (viewers can't list bank accounts)
  exact: boolean;
}

// Admins and writers can list bank accounts. Viewers can't (the A1 rule), so for them the
// accounts come from the checks they may already see, and the endpoint isn't called at all:
// a refused call would write an ACCESS_DENIED entry to the audit log on every visit.
function useReportAccounts(): { data: ReportAccount[] | undefined } {
  const { wid, canAny } = useWorkspaceContext();
  const canList = canAny("bank-account:manage", "check:create");
  const banks = useBankAccounts(wid, canList);
  const checks = useCheckList(wid, { limit: 100, sortBy: "checkNumber", sortOrder: "desc" }, { enabled: !canList });
  if (canList) return { data: banks.data?.map((b) => ({ id: b.id, bankName: b.bankName, accountNumber: b.accountNumber, nextCheckNumber: b.nextCheckNumber, exact: true })) };
  if (!checks.data) return { data: undefined };
  const byId = new Map<string, ReportAccount>();
  for (const c of checks.data.data) {
    const seen = byId.get(c.bankAccount.id);
    if (!seen) byId.set(c.bankAccount.id, { id: c.bankAccount.id, bankName: c.bankAccount.bankName, accountNumber: c.bankAccount.accountNumber, nextCheckNumber: c.checkNumber + 1, exact: false });
    else if (c.checkNumber + 1 > seen.nextCheckNumber) seen.nextCheckNumber = c.checkNumber + 1;
  }
  return { data: [...byId.values()] };
}
function AgingReport() {
  const { wid } = useWorkspaceContext();
  const banks = useReportAccounts();
  const [bankId, setBankId] = React.useState<string>("all");
  const aging = useAging(wid, bankId === "all" ? undefined : bankId);
  const max = Math.max(1, ...(aging.data?.buckets.map((b) => Number(b.amount)) ?? [1]));

  return (
    <Panel>
      <PanelHeader
        title={<span className="inline-flex items-center gap-2"><Hourglass className="size-4 text-muted" /> Outstanding checks by age</span>}
        description="Printed and not yet cleared. Compare with your bank statement; stale checks may need to be voided and reissued."
        action={
          <div className="flex items-center gap-2">
            {(banks.data?.length ?? 0) > 1 && (
              <div className="w-56">
                <Select value={bankId} onValueChange={setBankId} aria-label="Bank account">
                  <SelectItem value="all">All accounts</SelectItem>
                  {banks.data!.map((b) => <SelectItem key={b.id} value={b.id}>{b.bankName.split(",")[0]} {b.accountNumber}</SelectItem>)}
                </Select>
              </div>
            )}
            <ExportMenu
              disabled={!aging.data || aging.data.total.count === 0}
              note="Every outstanding check, oldest first, with how many days it has been out."
              onExport={(format) => exportOutstanding(wid, bankId === "all" ? undefined : bankId, format)}
            />
          </div>
        }
      />
      {aging.error ? (
        <div className="p-5"><ErrorState error={aging.error} onRetry={() => aging.refetch()} /></div>
      ) : aging.isPending ? (
        <div className="flex flex-col gap-3 p-5">{Array.from({ length: 4 }, (_, i) => <Skeleton key={i} className="h-9" />)}</div>
      ) : (
        <div className="flex flex-col gap-4 p-5">
          <div className="flex flex-wrap items-baseline gap-x-6 gap-y-1">
            <span className="font-mono text-3xl font-medium tracking-tight num">{money(aging.data.total.amount)}</span>
            <span className="text-sm text-muted">{aging.data.total.count} outstanding check{aging.data.total.count === 1 ? "" : "s"}</span>
          </div>
          <ul className="flex flex-col gap-2.5">
            {aging.data.buckets.map((b, i) => {
              const stale = b.maxDays === null;
              const pct = (Number(b.amount) / max) * 100;
              return (
                <li key={b.label} className="grid grid-cols-[8.5rem_minmax(0,1fr)_7.5rem_3rem] items-center gap-3 text-sm">
                  <span className={cn(stale ? "font-medium text-warning-700" : "text-muted")}>{b.label}</span>
                  <span className="h-6 overflow-hidden rounded-md bg-subtle">
                    <motion.span
                      className={cn("block h-full rounded-md", stale ? "bg-warning-500" : "bg-ink")}
                      initial={{ width: 0 }}
                      animate={{ width: `${Math.max(pct, Number(b.amount) > 0 ? 1.5 : 0)}%` }}
                      transition={{ delay: i * 0.08, duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
                    />
                  </span>
                  <span className="text-right font-mono num">{money(b.amount)}</span>
                  <span className="text-right font-mono text-xs text-muted num">{b.count}</span>
                </li>
              );
            })}
          </ul>
          <div className="flex gap-2">
            <Button variant="secondary" size="sm" asChild><Link to={`/w/${wid}/checks?view=outstanding`}>See outstanding checks</Link></Button>
            <Button variant="ghost" size="sm" asChild><Link to={`/w/${wid}/checks?view=stale`}>See stale checks</Link></Button>
          </div>
        </div>
      )}
    </Panel>
  );
}

const STATE_STYLE: Record<string, { label: string; className: string }> = {
  NEW: { label: "Draft", className: "bg-subtle text-ink-soft" },
  PENDING_APPROVAL: { label: "Awaiting approval", className: "bg-warning-50 text-warning-700" },
  APPROVED: { label: "Approved", className: "bg-success-50 text-success-700" },
  REJECTED: { label: "Rejected", className: "bg-danger-50 text-danger-700" },
  PRINTED: { label: "Printed", className: "bg-primary-50 text-primary-700" },
  CLEARED: { label: "Cleared", className: "bg-ink text-white" },
  VOID: { label: "Void", className: "bg-danger-50 text-danger-700 line-through" },
  DELETED_DRAFT: { label: "Deleted draft", className: "bg-subtle text-faint line-through" },
  NOT_ISSUED: { label: "Not issued yet", className: "bg-transparent text-faint ring-1 ring-line ring-dashed" },
  MISSING: { label: "Missing: no record", className: "bg-danger-600 text-white" },
};

function NumberIntegrityReport() {
  const { wid } = useWorkspaceContext();
  const banks = useReportAccounts();
  const [bankId, setBankId] = React.useState<string | undefined>();
  const bank = banks.data?.find((b) => b.id === bankId) ?? banks.data?.[0];
  const defaultTo = bank ? Math.max(bank.nextCheckNumber - 1, 1) : undefined;
  const [range, setRange] = React.useState<{ from?: number; to?: number }>({});
  const to = range.to ?? defaultTo;
  // Start at the account's first check (not 100 numbers back into numbers never issued).
  const first = useCheckList(wid, { bankAccountId: bank?.id, sortBy: "checkNumber", sortOrder: "asc", limit: 1 }, { enabled: Boolean(bank) });
  const lowest = first.data?.data[0]?.checkNumber;
  const from = range.from ?? (to ? Math.max(to - 99, lowest ?? 1) : undefined);
  const report = useNumberIntegrity(wid, { bankAccountId: bank?.id, from, to });

  return (
    <Panel>
      <PanelHeader
        title={<span className="inline-flex items-center gap-2"><Hash className="size-4 text-muted" /> Check-number audit</span>}
        description="Every number in a range and what happened to it. Auditors ask about gaps; a void or a deleted draft explains them. A missing number should never appear."
      />
      <div className="flex flex-col gap-4 p-5">
        <div className="flex flex-wrap items-end gap-3">
          {(banks.data?.length ?? 0) > 1 && (
            <div className="w-56">
              <Select value={bank?.id} onValueChange={(b) => { setBankId(b); setRange({}); }} aria-label="Bank account">
                {banks.data!.map((b) => <SelectItem key={b.id} value={b.id}>{b.bankName.split(",")[0]} {b.accountNumber}</SelectItem>)}
              </Select>
            </div>
          )}
          <label className="flex flex-col gap-1 text-xs text-muted">From<Input type="number" min={1} className="h-9 w-28 font-mono" value={from ?? ""} onChange={(e) => setRange((r) => ({ ...r, from: Number(e.target.value) || undefined }))} /></label>
          <label className="flex flex-col gap-1 text-xs text-muted">To<Input type="number" min={1} className="h-9 w-28 font-mono" value={to ?? ""} onChange={(e) => setRange((r) => ({ ...r, to: Number(e.target.value) || undefined }))} /></label>
          {bank?.exact && <span className="pb-2 text-xs text-muted">Next number to issue: <span className="font-mono text-ink">{bank.nextCheckNumber}</span></span>}
          <div className="ml-auto pb-0.5">
            <ExportMenu
              disabled={!bank || !from || !to || !report.data}
              note={from && to ? `Numbers ${from} to ${to}: each one and what became of it, for your auditor.` : undefined}
              onExport={(format) => exportNumberAudit(wid, { bankAccountId: bank!.id, from: from!, to: to! }, format)}
            />
          </div>
        </div>

        {!bank ? (
          <p className="text-sm text-muted">Add a bank account to audit its check numbers.</p>
        ) : report.error ? (
          <ErrorState error={report.error} onRetry={() => report.refetch()} />
        ) : report.isPending ? (
          <Skeleton className="h-40" />
        ) : (
          <>
            <div className="flex flex-wrap gap-1.5">
              {Object.entries(report.data.summary).map(([state, n]) => (
                <span key={state} className={cn("inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium", STATE_STYLE[state]?.className)}>
                  {STATE_STYLE[state]?.label ?? state} <span className="font-mono">{n}</span>
                </span>
              ))}
            </div>
            <div className="grid grid-cols-[repeat(auto-fill,minmax(4.25rem,1fr))] gap-1.5">
              {report.data.rows.map((r) => {
                const style = STATE_STYLE[r.state] ?? STATE_STYLE.NEW!;
                const cell = (
                  <span className={cn("flex h-9 items-center justify-center rounded-md font-mono text-xs num", style.className)}>{r.checkNumber}</span>
                );
                const tip = `#${r.checkNumber} · ${style.label}${r.payeeName ? ` · ${r.payeeName} ${money(r.amount)}` : ""}${r.voidReason ? ` · ${r.voidReason}` : ""}`;
                return r.checkId ? (
                  <Tooltip key={r.checkNumber} content={tip}><Link to={`/w/${wid}/checks/${r.checkId}`} className="transition-transform hover:-translate-y-0.5">{cell}</Link></Tooltip>
                ) : (
                  <Tooltip key={r.checkNumber} content={tip}><span tabIndex={0}>{cell}</span></Tooltip>
                );
              })}
            </div>
          </>
        )}
      </div>
    </Panel>
  );
}

// "YYYY-MM-DD" for the first day of this month (local time, like the date inputs).
function monthStartIso(): string {
  return `${todayIso().slice(0, 8)}01`;
}

// The issued-checks file a bank's Positive Pay service compares every presented check
// against. Admins only: it carries the full account and routing numbers.
function PositivePayPanel() {
  const { wid } = useWorkspaceContext();
  const banks = useReportAccounts();
  const [bankId, setBankId] = React.useState<string | undefined>();
  const bank = banks.data?.find((b) => b.id === bankId) ?? banks.data?.[0];
  const [from, setFrom] = React.useState(monthStartIso);
  const [to, setTo] = React.useState(todayIso);
  const [busy, setBusy] = React.useState(false);
  const invalid = !from || !to || from > to;

  const run = async () => {
    if (!bank || invalid) return;
    setBusy(true);
    try {
      await downloadPositivePay(wid, { bankAccountId: bank.id, from, to });
    } catch (err) {
      toast.error("Couldn't create the Positive Pay file", { description: errorMessage(err) });
    } finally {
      setBusy(false);
    }
  };

  return (
    <Panel>
      <PanelHeader
        title={<span className="inline-flex items-center gap-2"><Landmark className="size-4 text-muted" /> Positive Pay file</span>}
        description="Upload this to your bank's Positive Pay service. The bank pays a check only if it is on this list with the same number and amount; checks marked V (printed, then voided) are refused."
      />
      <div className="flex flex-col gap-4 p-5">
        {!bank ? (
          <p className="text-sm text-muted">Add a bank account to create its Positive Pay file.</p>
        ) : (
          <div className="flex flex-wrap items-end gap-3">
            {(banks.data?.length ?? 0) > 1 && (
              <div className="w-56">
                <Select value={bank.id} onValueChange={setBankId} aria-label="Bank account">
                  {banks.data!.map((b) => <SelectItem key={b.id} value={b.id}>{b.bankName.split(",")[0]} {b.accountNumber}</SelectItem>)}
                </Select>
              </div>
            )}
            <label className="flex flex-col gap-1 text-xs text-muted">Printed from<Input type="date" className="h-9 w-40" value={from} max={to || undefined} onChange={(e) => setFrom(e.target.value)} /></label>
            <label className="flex flex-col gap-1 text-xs text-muted">to<Input type="date" className="h-9 w-40" value={to} min={from || undefined} onChange={(e) => setTo(e.target.value)} /></label>
            <Button variant="ghost" size="sm" className="mb-0.5" onClick={() => { setFrom(todayIso()); setTo(todayIso()); }}>Today only</Button>
            <Button size="sm" className="mb-0.5 ml-auto" loading={busy} disabled={invalid} onClick={() => void run()}>
              <Download /> Download CSV
            </Button>
          </div>
        )}
        <p className="rounded-lg bg-warning-50 px-3 py-2 text-xs leading-snug text-warning-700">
          This file contains the full account and routing numbers. Upload it straight to the bank and delete the copy; every download is recorded in the audit log.
        </p>
      </div>
    </Panel>
  );
}
