import * as React from "react";
import { Link, useNavigate, useSearchParams } from "react-router";
import { useInfiniteQuery } from "@tanstack/react-query";
import { motion } from "motion/react";
import { ArrowDown, ArrowUp, ChevronDown, Copy, FileSearch, Filter, Paperclip, PenLine, Search, X } from "lucide-react";
import { exportRegister, useViews } from "@/api/checks";
import { ExportMenu } from "@/components/app/export-menu";
import { useBankAccounts } from "@/api/setup";
import type { CheckStatus, RegisterItem, RegisterMeta, RegisterView } from "@/api/types";
import { useWorkspaceContext } from "@/app/workspace-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox, Segmented, Select, SelectItem } from "@/components/ui/controls";
import { Popover, PopoverContent, PopoverTrigger, Tooltip } from "@/components/ui/menu";
import { EmptyState, ErrorState, Page, PageHeader, Panel, Skeleton } from "@/components/app/layout";
import { StatusBadge, statusLabel } from "@/components/app/status";
import { api } from "@/lib/api";
import { calendarDay, checkNo, money } from "@/lib/format";
import { cn } from "@/lib/utils";

const STATUSES: CheckStatus[] = ["NEW", "PENDING_APPROVAL", "APPROVED", "REJECTED", "PRINTED", "CLEARED", "VOID"];
const FILTER_KEYS = ["q", "status", "bankAccountId", "checkDateFrom", "checkDateTo", "amountMin", "amountMax"] as const;
type SortField = "createdAt" | "checkDate" | "amount" | "checkNumber" | "payeeName";

export function RegisterPage() {
  const { wid, can } = useWorkspaceContext();
  const [params, setParams] = useSearchParams();
  const navigate = useNavigate();
  const views = useViews(wid);
  const banks = useBankAccounts(wid);

  const view = (params.get("view") as RegisterView | null) ?? "";
  const sortBy = (params.get("sortBy") as SortField | null) ?? "createdAt";
  const sortOrder = (params.get("sortOrder") as "asc" | "desc" | null) ?? "desc";
  const filters = Object.fromEntries(FILTER_KEYS.map((k) => [k, params.get(k) ?? undefined])) as Record<(typeof FILTER_KEYS)[number], string | undefined>;
  const activeFilters = FILTER_KEYS.filter((k) => k !== "q" && filters[k]).length;

  const set = (patch: Record<string, string | undefined>) => {
    const next = new URLSearchParams(params);
    for (const [k, v] of Object.entries(patch)) {
      if (v) next.set(k, v);
      else next.delete(k);
    }
    setParams(next, { replace: true });
  };

  const query = { ...filters, view: view || undefined, sortBy, sortOrder, limit: 25, include: "totals" };
  const list = useInfiniteQuery({
    queryKey: ["checks", wid, "register", query],
    queryFn: ({ pageParam }) => api<RegisterItem[], RegisterMeta>(`/workspaces/${wid}/checks`, { query: { ...query, cursor: pageParam } }),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (last) => last.meta?.nextCursor ?? undefined,
  });
  const rows = list.data?.pages.flatMap((p) => p.data) ?? [];
  const totals = list.data?.pages[0]?.meta?.totals;

  const sort = (field: SortField) => set({ sortBy: field, sortOrder: sortBy === field && sortOrder === "desc" ? "asc" : "desc" });

  const viewOptions = [
    { value: "", label: "All checks" },
    ...(views.data ?? []).map((v) => ({ value: v.view, label: shortLabel(v.view), count: v.count })),
  ];

  return (
    <Page className="max-w-7xl">
      <PageHeader
        eyebrow="Register"
        title="Checks"
        description="Every check in this workspace, from draft to cleared. Filters stay in the address bar, so you can share a view."
        actions={can("check:create") && <Button asChild><Link to={`/w/${wid}/checks/new`}><PenLine /> Write check</Link></Button>}
      />

      <Segmented layoutId="register-view" aria-label="Saved views" value={view} onChange={(v) => set({ view: v || undefined })} options={viewOptions} className="self-start" />

      <div className="flex flex-wrap items-center gap-2">
        <SearchInput value={filters.q ?? ""} onSearch={(q) => set({ q: q || undefined })} />
        <FilterPopover
          filters={filters}
          banks={banks.data ?? []}
          activeCount={activeFilters}
          onApply={(patch) => set(patch)}
        />
        {(activeFilters > 0 || filters.q) && (
          <Button variant="ghost" size="sm" onClick={() => set(Object.fromEntries(FILTER_KEYS.map((k) => [k, undefined])))}>
            <X /> Clear
          </Button>
        )}
        <div className="ml-auto flex items-center gap-3">
          <span className="font-mono text-xs text-muted num" aria-live="polite">
            {totals && `${totals.count.toLocaleString()} check${totals.count === 1 ? "" : "s"} · ${money(totals.amount)}`}
          </span>
          {can("report:view") && (
            <ExportMenu
              disabled={!totals || totals.count === 0}
              note={`All ${totals?.count.toLocaleString() ?? ""} checks matching this view and these filters, in this order. Up to 10,000 per file.`}
              onExport={(format) => exportRegister(wid, { ...filters, view: view || undefined, sortBy, sortOrder }, format)}
            />
          )}
        </div>
      </div>

      <ActiveChips filters={filters} banks={banks.data ?? []} onRemove={(k) => set({ [k]: undefined })} />

      {list.error ? (
        <ErrorState error={list.error} onRetry={() => list.refetch()} />
      ) : list.isPending ? (
        <Panel className="flex flex-col gap-2 p-4">{Array.from({ length: 8 }, (_, i) => <Skeleton key={i} className="h-10" />)}</Panel>
      ) : rows.length === 0 ? (
        <EmptyState
          icon={<FileSearch />}
          title={activeFilters || filters.q || view ? "No checks match" : "No checks yet"}
          description={activeFilters || filters.q || view ? "Try another view, or clear the search and filters." : "Checks appear here as soon as they're written."}
          action={can("check:create") && !(activeFilters || filters.q || view) && <Button size="sm" asChild><Link to={`/w/${wid}/checks/new`}><PenLine /> Write a check</Link></Button>}
        />
      ) : (
        <Panel className="overflow-hidden">
          {/* Desktop table */}
          <div className="hidden overflow-x-auto md:block">
            <table className="w-full text-sm">
              <thead className="border-b border-line bg-subtle/60 text-left text-xs text-muted">
                <tr>
                  <SortHeader field="checkNumber" label="Check" sortBy={sortBy} sortOrder={sortOrder} onSort={sort} className="w-28" />
                  <SortHeader field="checkDate" label="Date" sortBy={sortBy} sortOrder={sortOrder} onSort={sort} className="w-32" />
                  <SortHeader field="payeeName" label="Payee" sortBy={sortBy} sortOrder={sortOrder} onSort={sort} />
                  <SortHeader field="amount" label="Amount" sortBy={sortBy} sortOrder={sortOrder} onSort={sort} className="w-36 text-right" align="right" />
                  <th className="w-52 px-4 py-2.5 font-medium">Status</th>
                  <th className="w-44 px-4 py-2.5 font-medium">Account</th>
                  <th className="w-36 px-4 py-2.5 font-medium">Written by</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {rows.map((c, i) => (
                  <motion.tr
                    key={c.id}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: Math.min(i, 12) * 0.015 }}
                    onClick={() => navigate(`/w/${wid}/checks/${c.id}`)}
                    className="cursor-pointer transition-colors hover:bg-subtle/60"
                  >
                    <td className="px-4 py-3 font-mono text-[0.8125rem] num">
                      <Link to={`/w/${wid}/checks/${c.id}`} onClick={(e) => e.stopPropagation()} className="hover:underline">#{checkNo(c.checkNumber)}</Link>
                    </td>
                    <td className="px-4 py-3 text-muted">{calendarDay(c.checkDate)}</td>
                    <td className="max-w-0 px-4 py-3">
                      <div className="flex items-center gap-1.5">
                        <span className="truncate font-medium">{c.payeeName}</span>
                        {c.hasAttachments && <Paperclip className="size-3.5 shrink-0 text-faint" aria-label="Has attachments" />}
                        {c.possibleDuplicateOf && (
                          <Tooltip content={`Same payee and amount as check #${checkNo(c.possibleDuplicateOf.checkNumber)}. Check it isn't paid twice.`}>
                            <span className="inline-flex shrink-0 items-center gap-0.5 rounded-md bg-warning-50 px-1.5 py-0.5 text-[0.6875rem] font-medium text-warning-700"><Copy className="size-3" /> Possible duplicate</span>
                          </Tooltip>
                        )}
                      </div>
                      {c.memo && <div className="truncate text-xs text-muted">{c.memo}</div>}
                    </td>
                    <td className="px-4 py-3 text-right font-mono num">{money(c.amount)}</td>
                    <td className="px-4 py-3"><StatusBadge status={c.status} voidType={c.voidType} unconfirmed={c.status === "PRINTED" && !c.printConfirmedAt} /></td>
                    <td className="px-4 py-3 text-xs text-muted">{c.bankAccount.bankName.split(",")[0]} {c.bankAccount.accountNumber}</td>
                    <td className="px-4 py-3 text-xs text-muted">{c.createdBy.fullName}</td>
                  </motion.tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Phone cards */}
          <ul className="divide-y divide-line md:hidden">
            {rows.map((c) => (
              <li key={c.id}>
                <Link to={`/w/${wid}/checks/${c.id}`} className="flex flex-col gap-1.5 px-4 py-3">
                  <div className="flex items-center justify-between gap-3">
                    <span className="truncate font-medium">{c.payeeName}</span>
                    <span className="font-mono text-sm num">{money(c.amount)}</span>
                  </div>
                  <div className="flex items-center justify-between gap-3">
                    <span className="font-mono text-xs text-muted">#{checkNo(c.checkNumber)} · {calendarDay(c.checkDate)}</span>
                    <StatusBadge status={c.status} voidType={c.voidType} unconfirmed={c.status === "PRINTED" && !c.printConfirmedAt} />
                  </div>
                </Link>
              </li>
            ))}
          </ul>

          {list.hasNextPage && (
            <div className="flex justify-center border-t border-line p-3">
              <Button variant="secondary" size="sm" loading={list.isFetchingNextPage} onClick={() => list.fetchNextPage()}>Load more</Button>
            </div>
          )}
        </Panel>
      )}
    </Page>
  );
}

function shortLabel(view: RegisterView): string {
  return {
    "awaiting-my-approval": "Awaiting me",
    "my-drafts": "My drafts",
    "ready-to-print": "Ready to print",
    "print-unconfirmed": "Not confirmed",
    outstanding: "Outstanding",
    stale: "Stale",
    voided: "Voided",
  }[view];
}

function SortHeader({ field, label, sortBy, sortOrder, onSort, className, align }: { field: SortField; label: string; sortBy: string; sortOrder: string; onSort: (f: SortField) => void; className?: string; align?: "right" }) {
  const active = sortBy === field;
  return (
    <th className={cn("px-4 py-2.5 font-medium", className)} aria-sort={active ? (sortOrder === "asc" ? "ascending" : "descending") : "none"}>
      <button type="button" onClick={() => onSort(field)} className={cn("inline-flex items-center gap-1 hover:text-ink", active && "text-ink", align === "right" && "flex-row-reverse")}>
        {label}
        {active ? (sortOrder === "asc" ? <ArrowUp className="size-3" /> : <ArrowDown className="size-3" />) : <ArrowDown className="size-3 opacity-0" />}
      </button>
    </th>
  );
}

function SearchInput({ value, onSearch }: { value: string; onSearch: (q: string) => void }) {
  const [draft, setDraft] = React.useState(value);
  // When the search changes from outside (the Clear button, back/forward), show it.
  const [shown, setShown] = React.useState(value);
  if (value !== shown) {
    setShown(value);
    if (value !== draft.trim()) setDraft(value);
  }
  React.useEffect(() => {
    if (draft === value) return;
    const t = setTimeout(() => onSearch(draft.trim()), 350);
    return () => clearTimeout(t);
  }, [draft, value, onSearch]);
  return (
    <div className="w-full sm:w-80">
      <Input leading={<Search />} value={draft} onChange={(e) => setDraft(e.target.value)} placeholder="#1042, $1,250.50, payee or memo" aria-label="Search checks" className="h-9" />
    </div>
  );
}

function FilterPopover({ filters, banks, activeCount, onApply }: {
  filters: Record<string, string | undefined>;
  banks: Array<{ id: string; bankName: string; accountNumber: string }>;
  activeCount: number;
  onApply: (patch: Record<string, string | undefined>) => void;
}) {
  const [open, setOpen] = React.useState(false);
  const [draft, setDraft] = React.useState(filters);
  // Each opening starts from the filters in effect now.
  const onOpenChange = (o: boolean) => {
    if (o) setDraft(filters);
    setOpen(o);
  };
  const statuses = new Set((draft.status ?? "").split(",").filter(Boolean));
  const toggle = (s: string) => {
    const next = new Set(statuses);
    if (next.has(s)) next.delete(s);
    else next.add(s);
    setDraft((d) => ({ ...d, status: [...next].join(",") || undefined }));
  };

  return (
    <Popover open={open} onOpenChange={onOpenChange}>
      <PopoverTrigger asChild>
        <Button variant="secondary" size="sm" className="h-9">
          <Filter /> Filters {activeCount > 0 && <span className="rounded-md bg-ink px-1.5 font-mono text-[0.6875rem] text-white">{activeCount}</span>} <ChevronDown className="opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[22rem] p-4">
        <div className="flex flex-col gap-4">
          <fieldset className="flex flex-col gap-2">
            <legend className="mb-2 text-xs font-medium text-muted">Status</legend>
            <div className="grid grid-cols-2 gap-2">
              {STATUSES.map((s) => (
                <label key={s} className="flex cursor-pointer items-center gap-2 text-sm">
                  <Checkbox checked={statuses.has(s)} onCheckedChange={() => toggle(s)} /> {statusLabel(s)}
                </label>
              ))}
            </div>
          </fieldset>
          {banks.length > 1 && (
            <div className="flex flex-col gap-1.5">
              <span className="text-xs font-medium text-muted">Bank account</span>
              <Select value={draft.bankAccountId ?? "all"} onValueChange={(b) => setDraft((d) => ({ ...d, bankAccountId: b === "all" ? undefined : b }))}>
                <SelectItem value="all">All accounts</SelectItem>
                {banks.map((b) => <SelectItem key={b.id} value={b.id}>{b.bankName} {b.accountNumber}</SelectItem>)}
              </Select>
            </div>
          )}
          <div className="flex flex-col gap-1.5">
            <span className="text-xs font-medium text-muted">Check date</span>
            <div className="grid grid-cols-2 gap-2">
              <Input type="date" aria-label="From date" className="h-9" value={draft.checkDateFrom ?? ""} onChange={(e) => setDraft((d) => ({ ...d, checkDateFrom: e.target.value || undefined }))} />
              <Input type="date" aria-label="To date" className="h-9" value={draft.checkDateTo ?? ""} onChange={(e) => setDraft((d) => ({ ...d, checkDateTo: e.target.value || undefined }))} />
            </div>
          </div>
          <div className="flex flex-col gap-1.5">
            <span className="text-xs font-medium text-muted">Amount</span>
            <div className="grid grid-cols-2 gap-2">
              <Input inputMode="decimal" aria-label="Minimum amount" placeholder="Min" leading={<span className="text-xs">$</span>} className="h-9 font-mono" value={draft.amountMin ?? ""} onChange={(e) => setDraft((d) => ({ ...d, amountMin: e.target.value.replace(/[$,]/g, "") || undefined }))} />
              <Input inputMode="decimal" aria-label="Maximum amount" placeholder="Max" leading={<span className="text-xs">$</span>} className="h-9 font-mono" value={draft.amountMax ?? ""} onChange={(e) => setDraft((d) => ({ ...d, amountMax: e.target.value.replace(/[$,]/g, "") || undefined }))} />
            </div>
          </div>
          <div className="flex justify-end gap-2 border-t border-line pt-3">
            <Button variant="ghost" size="sm" onClick={() => setDraft({ q: filters.q })}>Reset</Button>
            <Button size="sm" onClick={() => { onApply({ status: draft.status, bankAccountId: draft.bankAccountId, checkDateFrom: draft.checkDateFrom, checkDateTo: draft.checkDateTo, amountMin: draft.amountMin, amountMax: draft.amountMax }); setOpen(false); }}>Apply</Button>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}

function ActiveChips({ filters, banks, onRemove }: { filters: Record<string, string | undefined>; banks: Array<{ id: string; bankName: string; accountNumber: string }>; onRemove: (k: string) => void }) {
  const chips: Array<[string, string]> = [];
  if (filters.status) chips.push(["status", filters.status.split(",").map((s) => statusLabel(s as CheckStatus)).join(", ")]);
  if (filters.bankAccountId) {
    const b = banks.find((x) => x.id === filters.bankAccountId);
    chips.push(["bankAccountId", b ? `${b.bankName.split(",")[0]} ${b.accountNumber}` : "Account"]);
  }
  if (filters.checkDateFrom) chips.push(["checkDateFrom", `From ${calendarDay(filters.checkDateFrom)}`]);
  if (filters.checkDateTo) chips.push(["checkDateTo", `To ${calendarDay(filters.checkDateTo)}`]);
  if (filters.amountMin) chips.push(["amountMin", `≥ ${money(filters.amountMin)}`]);
  if (filters.amountMax) chips.push(["amountMax", `≤ ${money(filters.amountMax)}`]);
  if (chips.length === 0) return null;
  return (
    <div className="-mt-3 flex flex-wrap gap-1.5">
      {chips.map(([k, label]) => (
        <span key={k} className="inline-flex items-center gap-1 rounded-full border border-line bg-panel py-0.5 pr-1 pl-2.5 text-xs">
          {label}
          <button type="button" onClick={() => onRemove(k)} className="rounded-full p-0.5 text-muted hover:bg-subtle hover:text-ink" aria-label={`Remove filter ${label}`}><X className="size-3" /></button>
        </span>
      ))}
    </div>
  );
}
