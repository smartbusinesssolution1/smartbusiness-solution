import * as React from "react";
import { Link, useLocation, useNavigate, useParams, useSearchParams } from "react-router";
import { AnimatePresence, motion } from "motion/react";
import { toast } from "sonner";
import { ArrowLeft, ArrowRight, BadgeCheck, Check as CheckIcon, CircleAlert, FileWarning, Layers, PartyPopper, Printer, RotateCcw, TriangleAlert, X } from "lucide-react";
import { PRINT_BATCH_MAX, fetchBatchPdf, useCheckList, usePrintBatch, usePrintBatchJob, usePrintOutcome, useReissueCheck } from "@/api/checks";
import { usePrinters } from "@/api/setup";
import type { PaperSize, PrintBatch, RegisterItem } from "@/api/types";
import { useWorkspaceContext } from "@/app/workspace-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { EmptyState, ErrorState, InlineAlert, Page, PageHeader, Panel, PanelHeader, Skeleton } from "@/components/app/layout";
import { PaperDiagram, layoutLabel } from "@/components/app/paper";
import { PdfFrame, PrintTips, usePdf } from "@/components/app/pdf-dialog";
import { StatusBadge } from "@/components/app/status";
import { ApiError, errorMessage } from "@/lib/api";
import { newIdempotencyKey } from "@/lib/forms";
import { checkNo, money } from "@/lib/format";
import { cn } from "@/lib/utils";

// ─── Where each check goes (same rule as the server's planSheets) ─────────

type Slot = 1 | 2 | 3;

function planSheets(count: number, threePerPage: boolean, start: Slot) {
  if (!threePerPage) return { placements: Array.from({ length: count }, (_, i) => ({ sheet: i, slot: null as Slot | null })), sheetCount: count };
  const first = start - 1;
  return {
    placements: Array.from({ length: count }, (_, i) => ({ sheet: Math.floor((first + i) / 3), slot: (((first + i) % 3) + 1) as Slot })),
    sheetCount: count === 0 ? 0 : Math.floor((first + count - 1) / 3) + 1,
  };
}

function Back() {
  const { wid } = useWorkspaceContext();
  return <Link to={`/w/${wid}/print`} className="inline-flex w-fit items-center gap-1.5 text-sm text-muted hover:text-ink"><ArrowLeft className="size-4" /> Print station</Link>;
}

// ─── Setup: printer, start slot, preview ──────────────────────────────────

export function BatchSetupPage() {
  const { wid } = useWorkspaceContext();
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const ids = React.useMemo(() => (params.get("ids") ?? "").split(",").filter(Boolean), [params]);
  const ready = useCheckList(wid, { view: "ready-to-print", sortBy: "checkNumber", sortOrder: "asc", limit: 100 });
  const printers = usePrinters(wid);
  const print = usePrintBatch(wid);
  const [idempotencyKey] = React.useState(newIdempotencyKey);
  const [printerId, setPrinterId] = React.useState<string | null>(null);
  const [startChoice, setStartChoice] = React.useState<Slot | null>(null);
  const [failure, setFailure] = React.useState<{ message: string; perCheck: Record<string, string> } | null>(null);

  const all = printers.data ?? [];
  const printer = all.find((p) => p.id === printerId) ?? all.find((p) => p.isDefault) ?? all[0];
  const threePerPage = printer?.layout === "THREE_PER_PAGE";
  const start: Slot = startChoice ?? printer?.nextSlot ?? 1;

  // Only checks still ready to print; the list is already in check-number order.
  const checks = (ready.data?.data ?? []).filter((c) => ids.includes(c.id));
  const gone = ready.data ? ids.length - checks.length : 0;
  const plan = planSheets(checks.length, threePerPage, start);
  const total = checks.reduce((sum, c) => sum + Number(c.amount), 0);

  const leaveOut = (id: string) => {
    const next = ids.filter((x) => x !== id);
    setFailure((f) => (f ? { ...f, perCheck: Object.fromEntries(Object.entries(f.perCheck).filter(([k]) => k !== id)) } : f));
    setParams(next.length ? { ids: next.join(",") } : {}, { replace: true });
  };

  const generate = () => {
    if (!printer || checks.length === 0) return;
    setFailure(null);
    print.mutate(
      { checkIds: checks.map((c) => c.id), calibrationProfileId: printer.id, startPosition: threePerPage ? start : undefined, idempotencyKey },
      {
        onSuccess: (result) => navigate(`/w/${wid}/print/batches/${result.batch.id}`, { replace: true, state: { notice: result.notice } }),
        onError: (e) => {
          const perCheck = e instanceof ApiError && e.details
            ? Object.fromEntries(Object.entries(e.details).filter(([k]) => ids.includes(k)).map(([k, v]) => [k, v[0] ?? ""]))
            : {};
          setFailure({ message: errorMessage(e), perCheck });
        },
      },
    );
  };

  if (ready.error) return <Page><ErrorState error={ready.error} onRetry={() => ready.refetch()} /></Page>;
  if (ready.isPending) return <Page><Skeleton className="h-8 w-64" /><Skeleton className="h-[24rem] rounded-[var(--radius-card)]" /></Page>;

  if (checks.length === 0) {
    return (
      <Page className="max-w-3xl">
        <PageHeader back={<Back />} eyebrow="Print" title="Nothing to print together" />
        <EmptyState icon={<Layers />} title="No checks selected" description="Pick the checks to print on the print station's Ready to print list." action={<Button asChild><Link to={`/w/${wid}/print`}>Go to print station</Link></Button>} />
      </Page>
    );
  }

  return (
    <Page className="max-w-6xl">
      <PageHeader
        back={<Back />}
        eyebrow="Print several checks"
        title={`${checks.length} ${checks.length === 1 ? "check" : "checks"} · ${money(total)}`}
        description="One PDF with every check, in check-number order. You'll confirm how each one came out after printing."
      />

      {gone > 0 && (
        <InlineAlert tone="warning">{gone === 1 ? "One selected check is" : `${gone} selected checks are`} no longer ready to print (printed, voided or changed elsewhere), so {gone === 1 ? "it was" : "they were"} left out.</InlineAlert>
      )}
      {checks.length > PRINT_BATCH_MAX && <InlineAlert tone="danger">Print at most {PRINT_BATCH_MAX} checks at a time. Leave some out.</InlineAlert>}
      {failure && (
        <InlineAlert tone="danger" title="Nothing was printed">
          {failure.message}
          {Object.keys(failure.perCheck).length > 0 && " Each problem is shown on its check below."}
        </InlineAlert>
      )}

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_22rem]">
        <div className="flex flex-col gap-6">
          <Panel className="overflow-hidden">
            <PanelHeader title="Checks in this job" description={threePerPage ? `${plan.sheetCount} ${plan.sheetCount === 1 ? "sheet" : "sheets"} of three-per-page paper` : `${checks.length} sheets, one check each`} />
            <ul className="divide-y divide-line">
              {checks.map((c, i) => {
                const place = plan.placements[i]!;
                const problem = failure?.perCheck[c.id];
                return (
                  <li key={c.id} className={cn("flex flex-wrap items-center gap-3 px-5 py-3", problem && "bg-danger-50/60")}>
                    <span className="w-20 font-mono text-sm text-muted num">#{checkNo(c.checkNumber)}</span>
                    <div className="flex min-w-0 flex-1 flex-col">
                      <span className="truncate font-medium">{c.payeeName}</span>
                      <span className="text-xs text-muted">
                        Sheet {place.sheet + 1}{place.slot && ` · ${place.slot === 1 ? "top" : place.slot === 2 ? "middle" : "bottom"} slot`} · {c.bankAccount.bankName.split(",")[0]} {c.bankAccount.accountNumber}
                      </span>
                      {problem && <span className="mt-1 flex items-start gap-1.5 text-xs font-medium text-danger-700"><CircleAlert className="mt-px size-3.5 shrink-0" /> {problem}</span>}
                    </div>
                    <span className="font-mono text-sm num">{money(c.amount)}</span>
                    <Button size="icon-sm" variant="ghost" aria-label={`Leave out check #${checkNo(c.checkNumber)}`} onClick={() => leaveOut(c.id)}><X /></Button>
                  </li>
                );
              })}
            </ul>
          </Panel>

          {threePerPage && printer && <SheetPreview checks={checks} start={start} paper={printer.paperSize} />}
        </div>

        <Panel className="self-start lg:sticky lg:top-6">
          <PanelHeader title="Printer" />
          <div className="flex flex-col gap-4 p-5">
            {printers.isPending ? (
              <Skeleton className="h-24" />
            ) : all.length === 0 ? (
              <InlineAlert tone="warning" title="No printer set up" action={<Button size="sm" asChild><Link to={`/w/${wid}/settings/printers/new`}>Set up</Link></Button>}>Calibrate a printer first.</InlineAlert>
            ) : (
              <div role="radiogroup" aria-label="Printer" className="flex flex-col gap-2">
                {all.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    role="radio"
                    aria-checked={printer?.id === p.id}
                    onClick={() => { setPrinterId(p.id); setStartChoice(null); }}
                    className={cn("flex items-center gap-3 rounded-xl border p-3 text-left transition-all", printer?.id === p.id ? "border-ink shadow-[0_0_0_3px_rgb(10_10_11/0.07)]" : "border-line hover:border-line-strong")}
                  >
                    <div className="w-9 shrink-0"><PaperDiagram layout={p.layout} paper={p.paperSize} /></div>
                    <div className="flex min-w-0 flex-1 flex-col">
                      <span className="truncate text-sm font-semibold">{p.profileName}</span>
                      <span className="text-xs text-muted">{layoutLabel(p.layout)} · {p.paperSize === "LETTER" ? "Letter" : "A4"}</span>
                    </div>
                    {p.verification.verified ? <BadgeCheck className="size-4 text-success-600" aria-label="Verified" /> : <CircleAlert className="size-4 text-warning-600" aria-label="Not verified" />}
                  </button>
                ))}
              </div>
            )}

            {threePerPage && printer && (
              <div className="flex flex-col gap-2">
                <span className="text-[0.8125rem] font-medium text-ink-soft">First blank slot on the sheet in the tray</span>
                <div role="radiogroup" aria-label="First blank slot" className="grid grid-cols-3 gap-2">
                  {([1, 2, 3] as const).map((n) => (
                    <button key={n} type="button" role="radio" aria-checked={start === n} onClick={() => setStartChoice(n)} className={cn("flex flex-col items-center gap-1 rounded-xl border p-2 text-xs font-medium", start === n ? "border-ink bg-subtle" : "border-line hover:border-line-strong")}>
                      <div className="w-8"><PaperDiagram layout="THREE_PER_PAGE" paper={printer.paperSize} slot={n} /></div>
                      {n === 1 ? "Top" : n === 2 ? "Middle" : "Bottom"}
                    </button>
                  ))}
                </div>
                {printer.nextSlot !== 1 && <p className="text-xs text-muted">Slot {printer.nextSlot} is the next blank one after the last print on this printer.</p>}
              </div>
            )}

            {printer && !printer.verification.verified && (
              <InlineAlert tone="warning" title="This printer isn't verified">Checks may print slightly off. Verify it with a sample check first if you can.</InlineAlert>
            )}
            {printer?.needsRecalibration && <InlineAlert tone="danger">Calibrated with an older sheet. Set this printer up again before printing.</InlineAlert>}

            <Button size="lg" disabled={!printer || checks.length > PRINT_BATCH_MAX} loading={print.isPending} onClick={generate}>
              <Printer /> Generate PDF for {checks.length} {checks.length === 1 ? "check" : "checks"}
            </Button>
            <p className="text-xs text-muted">Generating marks every check as printed. If any one can't be printed, none are.</p>
          </div>
        </Panel>
      </div>
    </Page>
  );
}

// How the checks land on the paper: used slots on the first sheet stay as they are.
function SheetPreview({ checks, start, paper }: { checks: RegisterItem[]; start: Slot; paper: PaperSize }) {
  const plan = planSheets(checks.length, true, start);
  const sheets = Array.from({ length: plan.sheetCount }, (_, sheet) =>
    ([1, 2, 3] as const).map((slot) => {
      const i = plan.placements.findIndex((p) => p.sheet === sheet && p.slot === slot);
      if (i >= 0) return { slot, check: checks[i]! };
      return { slot, state: sheet === 0 && slot < start ? ("used" as const) : ("blank" as const) };
    }),
  );
  return (
    <Panel>
      <PanelHeader title="On the paper" description={`Load ${sheets.length === 1 ? "the sheet" : `${sheets.length} sheets`}${start > 1 ? `, starting with the partly used one (slot ${start} first)` : ""}.`} />
      <div className="flex flex-wrap gap-4 p-5">
        {sheets.map((slots, sheet) => (
          <div key={sheet} className="flex w-40 flex-col gap-1.5">
            <span className="text-xs font-medium text-muted">Sheet {sheet + 1}</span>
            <div className={cn("flex flex-col gap-1 rounded-lg border border-line bg-white p-1.5 shadow-card", paper === "A4" ? "aspect-[210/297]" : "aspect-[8.5/11]")}>
              {slots.map((s) => (
                <div
                  key={s.slot}
                  className={cn(
                    "flex flex-1 flex-col justify-center rounded-md border px-2 text-[0.6875rem] leading-tight",
                    "check" in s ? "border-primary-500/40 bg-primary-50 text-primary-900" : s.state === "used" ? "border-dashed border-line bg-subtle text-faint" : "border-dashed border-line text-faint",
                  )}
                >
                  {"check" in s && s.check ? (
                    <>
                      <span className="font-mono font-semibold num">#{checkNo(s.check.checkNumber)}</span>
                      <span className="truncate">{s.check.payeeName}</span>
                    </>
                  ) : (
                    <span>{s.state === "used" ? "Already used" : "Stays blank"}</span>
                  )}
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </Panel>
  );
}

// ─── The job: print, then confirm each check ──────────────────────────────

export function BatchJobPage() {
  const { batchId } = useParams();
  const { wid } = useWorkspaceContext();
  const job = usePrintBatchJob(wid, batchId);

  if (job.isPending) return <Page><Skeleton className="h-8 w-64" /><Skeleton className="h-[28rem] rounded-[var(--radius-card)]" /></Page>;
  if (job.error) return <Page><ErrorState error={job.error} onRetry={() => job.refetch()} /></Page>;
  return <BatchJob job={job.data} refetch={() => job.refetch()} />;
}

type Outcome = { spoiled: boolean; reason: string };

function BatchJob({ job, refetch }: { job: PrintBatch; refetch: () => Promise<unknown> }) {
  const { wid, can } = useWorkspaceContext();
  const location = useLocation();
  const notice = (location.state as { notice?: string | null } | null)?.notice ?? null;
  const outcome = usePrintOutcome(wid);
  const reissue = useReissueCheck(wid);

  const pending = job.checks.filter((c) => c.status === "PRINTED" && !c.printConfirmedAt);
  const done = pending.length === 0;
  const [stage, setStage] = React.useState<"print" | "confirm">(job.pdfAvailable ? "print" : "confirm");
  const [outcomes, setOutcomes] = React.useState<Record<string, Outcome>>({});
  const [saving, setSaving] = React.useState(false);
  const [replacements, setReplacements] = React.useState<Record<string, { id: string; checkNumber: number }>>({});

  const pdfFetcher = React.useCallback(() => fetchBatchPdf(wid, job.id), [wid, job.id]);
  const pdf = usePdf(job.pdfAvailable && !done ? ["batch-pdf", job.id] : null, pdfFetcher);

  const outcomeOf = (id: string): Outcome => outcomes[id] ?? { spoiled: false, reason: "" };
  const spoiledCount = pending.filter((c) => outcomeOf(c.id).spoiled).length;
  const missingReason = pending.some((c) => outcomeOf(c.id).spoiled && !outcomeOf(c.id).reason.trim());

  // One request per check, in order: each check is its own record. A failure on one
  // (someone reported it meanwhile) does not undo the others; the list then refreshes.
  const report = async () => {
    setSaving(true);
    const failed: string[] = [];
    for (const c of pending) {
      const o = outcomeOf(c.id);
      try {
        await outcome.mutateAsync({ checkId: c.id, body: o.spoiled ? { outcome: "SPOILED", reason: o.reason.trim() } : { outcome: "OK" } });
      } catch (e) {
        failed.push(`#${checkNo(c.checkNumber)}: ${errorMessage(e)}`);
      }
    }
    await refetch();
    setSaving(false);
    if (failed.length) toast.error(`Some outcomes weren't saved. ${failed.join(" ")}`);
  };

  const steps = ["Print", "Confirm"];
  const stepIndex = done ? 2 : stage === "print" ? 0 : 1;
  const spoiledChecks = job.checks.filter((c) => c.voidType === "SPOILED");
  const confirmed = job.checks.filter((c) => c.printConfirmedAt && c.status !== "VOID");
  // Checks are in print order, so a check's index gives its sheet.
  const sheetOf = (i: number) =>
    job.layout === "THREE_PER_PAGE" && job.startPosition ? Math.floor((job.startPosition - 1 + i) / 3) + 1 : i + 1;

  return (
    <Page className="max-w-6xl">
      <PageHeader
        back={<Back />}
        eyebrow="Print job"
        title={`${job.checkCount} checks · ${job.sheetCount} ${job.sheetCount === 1 ? "sheet" : "sheets"}`}
        description={`${layoutLabel(job.layout)} · ${job.paperSize === "LETTER" ? "Letter" : "A4"}${job.startPosition && job.startPosition > 1 ? ` · starts in slot ${job.startPosition} of the first sheet` : ""}`}
      />

      {!done && (
        <ol className="flex items-center gap-2" aria-label="Printing steps">
          {steps.map((label, i) => (
            <li key={label} className="flex flex-1 items-center gap-2" aria-current={i === stepIndex ? "step" : undefined}>
              <span className={cn("flex size-7 items-center justify-center rounded-full text-xs font-semibold", i < stepIndex ? "bg-success-600 text-white" : i === stepIndex ? "bg-ink text-white ring-4 ring-ink/10" : "bg-subtle text-muted")}>
                {i < stepIndex ? <CheckIcon className="size-3.5" strokeWidth={3} /> : i + 1}
              </span>
              <span className={cn("text-sm", i === stepIndex ? "font-semibold" : "text-muted")}>{label}</span>
              {i < steps.length - 1 && <span className={cn("h-px flex-1", i < stepIndex ? "bg-success-600" : "bg-line")} />}
            </li>
          ))}
        </ol>
      )}

      <AnimatePresence mode="wait" initial={false}>
        <motion.div key={done ? "done" : stage} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}>
          {!done && stage === "print" && (
            <div className="flex flex-col gap-4">
              {notice && <InlineAlert tone="warning">{notice}</InlineAlert>}
              <PrintTips />
              {job.layout === "THREE_PER_PAGE" && job.startPosition && job.startPosition > 1 && (
                <InlineAlert tone="info">Put the partly used sheet in the tray first: the first check goes into slot {job.startPosition}.</InlineAlert>
              )}
              <PdfFrame {...pdf} title={`Print job, ${job.checkCount} checks`} height="34rem" />
              <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-line bg-panel p-4">
                <p className="text-sm text-muted">Printed it? Look at every sheet, then tell us how each check came out.</p>
                <Button onClick={() => setStage("confirm")}>Confirm the prints <ArrowRight /></Button>
              </div>
            </div>
          )}

          {!done && stage === "confirm" && (
            <div className="flex flex-col gap-4">
              {!job.pdfAvailable && (
                <InlineAlert tone="warning">This job's PDF is withdrawn because a check in it is void. Report the checks below; reprint any that still need paper from their own pages.</InlineAlert>
              )}
              <InlineAlert tone="info">Don't print the PDF a second time. Mark any check that came out wrong as spoiled; a replacement gets a new number.</InlineAlert>
              <Panel className="overflow-hidden">
                <PanelHeader title="How did each check come out?" description="Every check is marked as printed correctly unless you say otherwise." />
                <ul className="divide-y divide-line">
                  {pending.map((c) => {
                    const o = outcomeOf(c.id);
                    const index = job.checks.findIndex((x) => x.id === c.id);
                    return (
                      <li key={c.id} className={cn("flex flex-col gap-3 px-5 py-3", o.spoiled && "bg-danger-50/50")}>
                        <div className="flex flex-wrap items-center gap-3">
                          <span className="w-20 font-mono text-sm text-muted num">#{checkNo(c.checkNumber)}</span>
                          <div className="flex min-w-0 flex-1 flex-col">
                            <span className="truncate font-medium">{c.payeeName}</span>
                            <span className="text-xs text-muted">Sheet {sheetOf(index)}{c.position && ` · slot ${c.position}`} · {money(c.amount)}</span>
                          </div>
                          <div role="radiogroup" aria-label={`Outcome of check #${checkNo(c.checkNumber)}`} className="flex rounded-lg border border-line p-0.5 text-xs font-medium">
                            <button type="button" role="radio" aria-checked={!o.spoiled} onClick={() => setOutcomes((m) => ({ ...m, [c.id]: { ...o, spoiled: false } }))} className={cn("rounded-md px-2.5 py-1.5", !o.spoiled ? "bg-success-600 text-white" : "text-muted hover:text-ink")}>
                              Printed fine
                            </button>
                            <button type="button" role="radio" aria-checked={o.spoiled} onClick={() => setOutcomes((m) => ({ ...m, [c.id]: { ...o, spoiled: true } }))} className={cn("rounded-md px-2.5 py-1.5", o.spoiled ? "bg-danger-600 text-white" : "text-muted hover:text-ink")}>
                              Spoiled
                            </button>
                          </div>
                        </div>
                        {o.spoiled && (
                          <Input
                            autoFocus
                            maxLength={500}
                            aria-label={`What went wrong with check #${checkNo(c.checkNumber)}?`}
                            placeholder="What went wrong? For example: paper jammed"
                            value={o.reason}
                            onChange={(e) => setOutcomes((m) => ({ ...m, [c.id]: { ...o, reason: e.target.value } }))}
                          />
                        )}
                      </li>
                    );
                  })}
                </ul>
              </Panel>
              <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-line bg-panel p-4">
                <p className="text-sm text-muted">
                  {spoiledCount === 0 ? `All ${pending.length} printed correctly.` : `${pending.length - spoiledCount} printed correctly, ${spoiledCount} spoiled (voided; destroy the paper).`}
                </p>
                <div className="flex gap-2">
                  {job.pdfAvailable && <Button variant="ghost" onClick={() => setStage("print")}>Back to the PDF</Button>}
                  <Button variant={spoiledCount > 0 ? "danger" : "primary"} disabled={missingReason} loading={saving} onClick={report}>
                    Confirm {pending.length} {pending.length === 1 ? "check" : "checks"}
                  </Button>
                </div>
              </div>
            </div>
          )}

          {done && (
            <Panel className="flex flex-col items-center gap-5 px-6 py-12 text-center">
              <motion.span initial={{ scale: 0, rotate: -30 }} animate={{ scale: 1, rotate: 0 }} transition={{ type: "spring", stiffness: 260, damping: 14 }} className={cn("flex size-14 items-center justify-center rounded-2xl text-white shadow-pop", spoiledChecks.length ? "bg-warning-600" : "bg-success-600")}>
                {spoiledChecks.length ? <TriangleAlert className="size-7" /> : <PartyPopper className="size-7" />}
              </motion.span>
              <div className="flex flex-col gap-1">
                <p className="text-xl font-semibold tracking-tight">
                  {confirmed.length} of {job.checkCount} checks printed and confirmed
                </p>
                <p className="text-sm text-muted">They now show as outstanding until they clear.</p>
              </div>

              {spoiledChecks.length > 0 && (
                <div className="flex w-full max-w-xl flex-col gap-2 text-left">
                  <span className="flex items-center gap-2 text-sm font-semibold"><FileWarning className="size-4 text-danger-600" /> Spoiled and voided: destroy the paper</span>
                  <ul className="flex flex-col divide-y divide-line rounded-xl border border-line">
                    {spoiledChecks.map((c) => {
                      const replacement = replacements[c.id];
                      return (
                        <li key={c.id} className="flex flex-wrap items-center gap-3 px-4 py-2.5">
                          <span className="font-mono text-sm text-muted num">#{checkNo(c.checkNumber)}</span>
                          <span className="min-w-0 flex-1 truncate text-sm">{c.payeeName} · {money(c.amount)}</span>
                          <StatusBadge status={c.status} voidType={c.voidType} />
                          {replacement ? (
                            <Button size="sm" variant="secondary" asChild><Link to={`/w/${wid}/checks/${replacement.id}`}>Replacement #{checkNo(replacement.checkNumber)}</Link></Button>
                          ) : can("check:create") ? (
                            <Button
                              size="sm"
                              variant="secondary"
                              loading={reissue.isPending && reissue.variables?.checkId === c.id}
                              onClick={() =>
                                reissue.mutate({ checkId: c.id }, {
                                  onSuccess: (n) => {
                                    setReplacements((m) => ({ ...m, [c.id]: { id: n.id, checkNumber: n.checkNumber } }));
                                    toast.success(`Replacement #${checkNo(n.checkNumber)} created`);
                                  },
                                  onError: (e) => toast.error(errorMessage(e)),
                                })
                              }
                            >
                              <RotateCcw /> Reissue
                            </Button>
                          ) : null}
                        </li>
                      );
                    })}
                  </ul>
                  {!can("check:create") && <p className="text-xs text-muted">Ask someone who writes checks to reissue them from each check's page.</p>}
                </div>
              )}

              <div className="flex flex-wrap justify-center gap-2">
                <Button asChild><Link to={`/w/${wid}/print`}>Back to print station</Link></Button>
              </div>
            </Panel>
          )}
        </motion.div>
      </AnimatePresence>
    </Page>
  );
}
