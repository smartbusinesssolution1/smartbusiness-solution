import * as React from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router";
import { AnimatePresence, motion } from "motion/react";
import { toast } from "sonner";
import {
  ArrowLeft,
  ArrowRight,
  BadgeCheck,
  Check as CheckIcon,
  CircleAlert,
  FileWarning,
  Printer,
  RotateCcw,
  ScanLine,
  Settings2,
  TriangleAlert,
  PartyPopper,
  Inbox,
} from "lucide-react";
import { PRINT_BATCH_MAX, fetchCheckPdf, useCheck, useCheckList, usePrintCheck, usePrintOutcome, useReissueCheck } from "@/api/checks";
import { usePrinters } from "@/api/setup";
import type { Check, PrinterProfile } from "@/api/types";
import { useWorkspaceContext } from "@/app/workspace-context";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Textarea } from "@/components/ui/input";
import { Checkbox, Segmented } from "@/components/ui/controls";
import { CheckFace } from "@/components/app/check-face";
import { EmptyState, ErrorState, InlineAlert, Page, PageHeader, Panel, PanelHeader, Skeleton } from "@/components/app/layout";
import { PaperDiagram, layoutLabel } from "@/components/app/paper";
import { PdfFrame, PrintTips, usePdf } from "@/components/app/pdf-dialog";
import { ReloadCheck } from "@/components/app/reload-check";
import { StatusBadge } from "@/components/app/status";
import { errorMessage } from "@/lib/api";
import { newIdempotencyKey } from "@/lib/forms";
import { calendarDay, checkFaceDate, checkNo, money, when } from "@/lib/format";
import { cn } from "@/lib/utils";

// ─── Queue ────────────────────────────────────────────────

export function PrintQueuePage() {
  const { wid } = useWorkspaceContext();
  const [params, setParams] = useSearchParams();
  const tab = params.get("tab") === "unconfirmed" ? "unconfirmed" : "ready";
  const ready = useCheckList(wid, { view: "ready-to-print", sortBy: "checkNumber", sortOrder: "asc", limit: 100 });
  const unconfirmed = useCheckList(wid, { view: "print-unconfirmed", sortBy: "checkNumber", sortOrder: "asc", limit: 100 });
  const printers = usePrinters(wid);
  const list = tab === "ready" ? ready : unconfirmed;
  const defaultPrinter = printers.data?.find((p) => p.isDefault) ?? printers.data?.[0];
  const navigate = useNavigate();

  // Ticked checks for one print job. Only those still in the ready list count, so a
  // check printed elsewhere meanwhile drops out by itself.
  const [selected, setSelected] = React.useState<ReadonlySet<string>>(new Set());
  const readyRows = ready.data?.data ?? [];
  const chosen = readyRows.filter((c) => selected.has(c.id)).map((c) => c.id);
  const allChosen = readyRows.length > 0 && chosen.length === readyRows.length;
  const toggle = (id: string, on: boolean) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (on) next.add(id);
      else next.delete(id);
      return next;
    });
  const tooMany = chosen.length > PRINT_BATCH_MAX;
  const chosenTotal = readyRows.filter((c) => selected.has(c.id)).reduce((sum, c) => sum + Number(c.amount), 0);

  return (
    <Page>
      <PageHeader eyebrow="Print" title="Print station" description="Checks that are approved or need no approval. Each one is printed, then confirmed, so a jammed sheet never counts as paid." />

      <PrinterStatus printer={defaultPrinter} loading={printers.isPending} />

      <Segmented
        layoutId="print-tab"
        aria-label="Print queue"
        value={tab}
        onChange={(t) => setParams(t === "ready" ? {} : { tab: t }, { replace: true })}
        options={[
          { value: "ready", label: "Ready to print", count: ready.data?.data.length },
          { value: "unconfirmed", label: "Not confirmed", count: unconfirmed.data?.data.length },
        ]}
        className="self-start"
      />

      {list.error ? (
        <ErrorState error={list.error} onRetry={() => list.refetch()} />
      ) : list.isPending ? (
        <Panel className="flex flex-col gap-2 p-4">{Array.from({ length: 4 }, (_, i) => <Skeleton key={i} className="h-12" />)}</Panel>
      ) : list.data.data.length === 0 ? (
        <EmptyState
          icon={tab === "ready" ? <Inbox /> : <BadgeCheck />}
          title={tab === "ready" ? "Nothing to print" : "Every print is confirmed"}
          description={tab === "ready" ? "Approved checks, and checks that need no approval, appear here." : "No printed check is waiting for someone to say how it came out."}
        />
      ) : (
        <Panel className="overflow-hidden">
          {tab === "ready" && (
            <label className="flex cursor-pointer items-center gap-3 border-b border-line bg-subtle/50 px-5 py-2.5 text-xs text-muted">
              <Checkbox
                checked={allChosen ? true : chosen.length > 0 ? "indeterminate" : false}
                onCheckedChange={(on) => setSelected(on === true ? new Set(readyRows.map((c) => c.id)) : new Set())}
                aria-label="Select every check"
              />
              {chosen.length > 0 ? `${chosen.length} selected` : "Select checks to print them together in one PDF"}
            </label>
          )}
          {tab === "unconfirmed" && (
            <div className="flex items-start gap-2 border-b border-warning-500/25 bg-warning-50 px-5 py-3 text-sm text-warning-700">
              <TriangleAlert className="mt-0.5 size-4 shrink-0" /> These checks have PDFs but nobody has said whether the paper came out right. Report each one.
            </div>
          )}
          <ul className="divide-y divide-line">
            {list.data.data.map((c, i) => (
              <motion.li key={c.id} initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.03 }} className={cn("flex flex-wrap items-center gap-3 px-5 py-3", tab === "ready" && selected.has(c.id) && "bg-primary-50/40")}>
                {tab === "ready" && (
                  <Checkbox checked={selected.has(c.id)} onCheckedChange={(on) => toggle(c.id, on === true)} aria-label={`Select check #${checkNo(c.checkNumber)}`} />
                )}
                <span className="w-20 font-mono text-sm text-muted num">#{checkNo(c.checkNumber)}</span>
                <div className="flex min-w-0 flex-1 flex-col">
                  <span className="truncate font-medium">{c.payeeName}</span>
                  <span className="text-xs text-muted">{calendarDay(c.checkDate)} · {c.bankAccount.bankName.split(",")[0]} {c.bankAccount.accountNumber}{c.printedAt && ` · printed ${when(c.printedAt)}`}</span>
                </div>
                <span className="font-mono text-sm num">{money(c.amount)}</span>
                <StatusBadge status={c.status} unconfirmed={c.status === "PRINTED"} className="hidden sm:inline-flex" />
                <Button size="sm" asChild variant={tab === "ready" ? "primary" : "secondary"}>
                  <Link to={`/w/${wid}/print/${c.id}`}>{tab === "ready" ? <><Printer /> Print</> : "Report outcome"}</Link>
                </Button>
              </motion.li>
            ))}
          </ul>
        </Panel>
      )}

      <AnimatePresence>
        {tab === "ready" && chosen.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 16 }}
            className="sticky bottom-4 z-10 flex flex-wrap items-center gap-3 rounded-2xl border border-line bg-panel/95 p-3 pl-5 shadow-pop backdrop-blur"
          >
            <div className="flex min-w-0 flex-1 flex-col">
              <span className="text-sm font-semibold">{chosen.length} {chosen.length === 1 ? "check" : "checks"} · {money(chosenTotal)}</span>
              <span className={cn("text-xs", tooMany ? "text-danger-600" : "text-muted")}>
                {tooMany ? `Print at most ${PRINT_BATCH_MAX} at a time, so a jam spoils fewer checks.` : "One PDF, in check-number order."}
              </span>
            </div>
            <Button variant="ghost" size="sm" onClick={() => setSelected(new Set())}>Clear</Button>
            <Button
              disabled={tooMany}
              onClick={() =>
                navigate(chosen.length === 1 ? `/w/${wid}/print/${chosen[0]}` : `/w/${wid}/print/batch?ids=${chosen.join(",")}`)
              }
            >
              <Printer /> {chosen.length === 1 ? "Print this check" : `Print ${chosen.length} checks`}
            </Button>
          </motion.div>
        )}
      </AnimatePresence>
    </Page>
  );
}

function PrinterStatus({ printer, loading }: { printer?: PrinterProfile; loading: boolean }) {
  const { wid } = useWorkspaceContext();
  if (loading) return <Skeleton className="h-20 rounded-[var(--radius-card)]" />;
  if (!printer) {
    return (
      <InlineAlert tone="warning" title="No printer set up" action={<Button size="sm" asChild><Link to={`/w/${wid}/settings/printers/new`}>Set up a printer</Link></Button>}>
        Calibrate a printer before printing checks, so the MICR line lands where bank machines read it.
      </InlineAlert>
    );
  }
  return (
    <Panel className="flex flex-wrap items-center gap-4 p-4">
      <div className="w-11"><PaperDiagram layout={printer.layout} paper={printer.paperSize} /></div>
      <div className="flex min-w-0 flex-1 flex-col">
        <span className="text-xs text-muted">Default printer</span>
        <span className="font-semibold">{printer.profileName}</span>
        <span className="text-xs text-muted">{layoutLabel(printer.layout)} · {printer.paperSize === "LETTER" ? "Letter" : "A4"}{printer.tray && ` · ${printer.tray}`}</span>
      </div>
      {printer.verification.verified ? (
        <span className="inline-flex items-center gap-1 rounded-full bg-success-50 px-2.5 py-1 text-xs font-medium text-success-700 ring-1 ring-success-500/25 ring-inset"><BadgeCheck className="size-3.5" /> Verified</span>
      ) : (
        <Button size="sm" variant="secondary" asChild><Link to={`/w/${wid}/settings/printers/${printer.id}`}><ScanLine /> Verify printer</Link></Button>
      )}
      <Button size="icon-sm" variant="ghost" asChild aria-label="Printer settings"><Link to={`/w/${wid}/settings/printers`}><Settings2 /></Link></Button>
    </Panel>
  );
}

// ─── Station ──────────────────────────────────────────────

type Stage = "setup" | "print" | "outcome" | "done-ok" | "done-spoiled";

export function PrintStationPage() {
  const { checkId } = useParams();
  const { wid } = useWorkspaceContext();
  const { data: check, isPending, error, refetch } = useCheck(wid, checkId);

  if (isPending) return <Page><Skeleton className="h-8 w-64" /><Skeleton className="h-[28rem] rounded-[var(--radius-card)]" /></Page>;
  if (error) return <Page><ErrorState error={error} onRetry={() => refetch()} /></Page>;
  return <Station key={check.id} initial={check} />;
}

function Station({ initial }: { initial: Check }) {
  const { wid, workspace, can } = useWorkspaceContext();
  const navigate = useNavigate();
  const printers = usePrinters(wid);
  const print = usePrintCheck(wid);
  const outcome = usePrintOutcome(wid);
  const reissue = useReissueCheck(wid);
  const nextUp = useCheckList(wid, { view: "ready-to-print", sortBy: "checkNumber", sortOrder: "asc", limit: 5 });
  const [check, setCheck] = React.useState(initial);
  const [idempotencyKey] = React.useState(newIdempotencyKey);
  const printable = check.status === "APPROVED" || (check.status === "NEW" && check.approvalRequired === false);
  const [stage, setStage] = React.useState<Stage>(check.status === "PRINTED" && !check.printConfirmedAt ? "outcome" : "setup");
  const [printerId, setPrinterId] = React.useState<string | null>(null);
  // The slot defaults to the printer's next blank one (the sheet in the tray may be
  // partly used); null until the person picks a slot themselves.
  const [slotChoice, setSlotChoice] = React.useState<number | null>(null);
  const [notice, setNotice] = React.useState<string | null>(null);
  const [spoilReason, setSpoilReason] = React.useState("");
  const [choice, setChoice] = React.useState<"ok" | "spoiled" | null>(null);
  const [printError, setPrintError] = React.useState<string | null>(null);

  const all = printers.data ?? [];
  const printer = all.find((p) => p.id === printerId) ?? all.find((p) => p.isDefault) ?? all[0];
  const slot = slotChoice ?? printer?.nextSlot ?? 1;
  // Printing below the top slot means a used sheet goes back in: confirmed per printer and slot.
  const [reloadConfirmedFor, setReloadConfirmedFor] = React.useState<string | null>(null);
  const reloadKey = `${printer?.id}:${slot}`;
  const reusesSheet = printer?.layout === "THREE_PER_PAGE" && slot > 1;
  const reloadConfirmed = !reusesSheet || reloadConfirmedFor === reloadKey;

  const pdfFetcher = React.useCallback(() => fetchCheckPdf(wid, check.id), [wid, check.id]);
  const pdf = usePdf(stage === "print" || stage === "outcome" ? ["check-pdf", check.id, check.printedAt] : null, pdfFetcher);
  const next = nextUp.data?.data.find((c) => c.id !== check.id);

  const generate = () => {
    if (!printer) return;
    setPrintError(null);
    print.mutate(
      { checkId: check.id, calibrationProfileId: printer.id, position: printer.layout === "THREE_PER_PAGE" ? slot : undefined, idempotencyKey },
      {
        onSuccess: (c) => {
          setCheck(c);
          setNotice(c.notice ?? null);
          setStage("print");
        },
        onError: (e) => setPrintError(errorMessage(e)),
      },
    );
  };

  const report = () => {
    if (!choice) return;
    outcome.mutate(
      { checkId: check.id, body: choice === "ok" ? { outcome: "OK" } : { outcome: "SPOILED", reason: spoilReason.trim() } },
      {
        onSuccess: (c) => {
          setCheck(c);
          setStage(choice === "ok" ? "done-ok" : "done-spoiled");
          if (c.notice) setNotice(c.notice);
        },
        onError: (e) => toast.error(errorMessage(e)),
      },
    );
  };

  const steps = [
    { key: "setup", label: "Printer" },
    { key: "print", label: "Print" },
    { key: "outcome", label: "Confirm" },
  ];
  const stepIndex = stage === "setup" ? 0 : stage === "print" ? 1 : 2;

  const face = (
    <CheckFace
      companyName={workspace.businessName}
      addressLine={[workspace.addressLine1, workspace.addressLine2].filter(Boolean).join(", ")}
      cityLine={`${workspace.city}, ${workspace.state} ${workspace.zipCode}`}
      bankName={check.bankAccount.bankName}
      checkNumber={checkNo(check.checkNumber)}
      date={checkFaceDate(check.checkDate)}
      payeeName={check.payeeName}
      amount={Number(check.amount).toLocaleString("en-US", { minimumFractionDigits: 2 })}
      amountInWords={check.amountInWords}
      memo={check.memo}
      accountLast4={check.bankAccount.accountNumber.replace(/\D/g, "").slice(-4)}
      watermark={check.status === "VOID" ? "VOID" : null}
    />
  );

  if (stage === "setup" && !printable) {
    return (
      <Page className="max-w-3xl">
        <PageHeader back={<Back />} eyebrow="Print" title={`Check #${checkNo(check.checkNumber)} can't be printed`} />
        <InlineAlert tone="warning" title={<span className="inline-flex items-center gap-2">Current status <StatusBadge status={check.status} voidType={check.voidType} /></span>}>
          {check.status === "PENDING_APPROVAL" ? "It's waiting for approval." : check.status === "NEW" ? "It needs approval first. Its writer submits it." : check.status === "REJECTED" ? "It was rejected; its writer needs to fix and resubmit it." : "Only approved checks, and checks that need no approval, can be printed."}
        </InlineAlert>
        <Button variant="secondary" asChild className="self-start"><Link to={`/w/${wid}/checks/${check.id}`}>Open the check</Link></Button>
      </Page>
    );
  }

  return (
    <Page className="max-w-6xl">
      <PageHeader back={<Back />} eyebrow="Print station" title={`#${checkNo(check.checkNumber)} · ${check.payeeName}`} description={`${money(check.amount)} from ${check.bankAccount.bankName} ${check.bankAccount.accountNumber}`} />

      {stage !== "done-ok" && stage !== "done-spoiled" && (
        <ol className="flex items-center gap-2" aria-label="Printing steps">
          {steps.map((s, i) => (
            <li key={s.key} className="flex flex-1 items-center gap-2" aria-current={i === stepIndex ? "step" : undefined}>
              <span className={cn("flex size-7 items-center justify-center rounded-full text-xs font-semibold", i < stepIndex ? "bg-success-600 text-white" : i === stepIndex ? "bg-primary-600 text-white ring-4 ring-primary-100" : "bg-subtle text-muted")}>
                {i < stepIndex ? <CheckIcon className="size-3.5" strokeWidth={3} /> : i + 1}
              </span>
              <span className={cn("text-sm", i === stepIndex ? "font-semibold" : "text-muted")}>{s.label}</span>
              {i < steps.length - 1 && <span className={cn("h-px flex-1", i < stepIndex ? "bg-success-600" : "bg-line")} />}
            </li>
          ))}
        </ol>
      )}

      <AnimatePresence mode="wait" initial={false}>
        <motion.div key={stage} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}>
          {stage === "setup" && (
            <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_22rem]">
              <div className="flex flex-col gap-4">
                {face}
                <p className="text-xs text-muted">Preview. The PDF is generated for the printer you choose, with its calibration and the account's signature.</p>
              </div>
              <Panel className="self-start">
                <PanelHeader title="Choose a printer" />
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
                          onClick={() => { setPrinterId(p.id); setSlotChoice(null); }}
                          className={cn("flex items-center gap-3 rounded-xl border p-3 text-left transition-all", printer?.id === p.id ? "border-primary-500 bg-primary-50/40 shadow-[0_0_0_3px_rgb(33_86_232/0.12)]" : "border-line hover:border-line-strong")}
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

                  {printer?.layout === "THREE_PER_PAGE" && (
                    <div className="flex flex-col gap-2">
                      <span className="text-[0.8125rem] font-medium text-ink-soft">Which slot is still blank on the sheet?</span>
                      <div role="radiogroup" aria-label="Slot" className="grid grid-cols-3 gap-2">
                        {[1, 2, 3].map((n) => (
                          <button key={n} type="button" role="radio" aria-checked={slot === n} onClick={() => setSlotChoice(n)} className={cn("flex flex-col items-center gap-1 rounded-xl border p-2 text-xs font-medium", slot === n ? "border-primary-500 bg-primary-50 text-primary-800" : "border-line hover:border-line-strong")}>
                            <div className="w-8"><PaperDiagram layout="THREE_PER_PAGE" paper={printer.paperSize} slot={n} /></div>
                            {n === 1 ? "Top" : n === 2 ? "Middle" : "Bottom"}
                          </button>
                        ))}
                      </div>
                      {printer.nextSlot !== 1 && (
                        <p className="text-xs text-muted">Slot {printer.nextSlot} is the next blank one after the last print on this printer. Pick another if the sheet in the tray is different.</p>
                      )}
                      {check.invoiceItems && check.invoiceItems.length > 0 && <p className="text-xs text-warning-700">This paper has no stubs, so the invoice lines won't print.</p>}
                    </div>
                  )}

                  {reusesSheet && printer && (
                    <ReloadCheck
                      firstSlot={slot as 2 | 3}
                      paper={printer.paperSize}
                      confirmed={reloadConfirmed}
                      onConfirmedChange={(on) => setReloadConfirmedFor(on ? reloadKey : null)}
                      onFreshSheet={() => setSlotChoice(1)}
                    />
                  )}

                  {printer && !printer.verification.verified && (
                    <InlineAlert tone="warning" title="This printer isn't verified">Checks may print slightly off. Verify it with a sample check first if you can.</InlineAlert>
                  )}
                  {printer?.needsRecalibration && <InlineAlert tone="danger">Calibrated with an older sheet. Set this printer up again before printing.</InlineAlert>}
                  {printError && <InlineAlert tone="danger" title="Not printed">{printError}</InlineAlert>}

                  <Button size="lg" disabled={!printer || !reloadConfirmed} loading={print.isPending} onClick={generate}>
                    <Printer /> Generate check PDF
                  </Button>
                  <p className="text-xs text-muted">Generating marks the check as printed. You'll confirm the paper came out right next.</p>
                </div>
              </Panel>
            </div>
          )}

          {stage === "print" && (
            <div className="flex flex-col gap-4">
              {notice && <InlineAlert tone="warning">{notice}</InlineAlert>}
              <PrintTips />
              <PdfFrame {...pdf} title={`Check ${checkNo(check.checkNumber)}`} height="34rem" />
              <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-line bg-panel p-4">
                <p className="text-sm text-muted">Printed it? Look at the sheet, then tell us how it came out.</p>
                <Button onClick={() => setStage("outcome")}>Confirm the print <ArrowRight /></Button>
              </div>
            </div>
          )}

          {stage === "outcome" && (
            <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_24rem]">
              <div className="flex flex-col gap-3">
                <InlineAlert tone="info">Don't print this PDF a second time. If the sheet came out wrong, report it as spoiled; a replacement gets a new number.</InlineAlert>
                <PdfFrame {...pdf} title={`Check ${checkNo(check.checkNumber)}`} height="26rem" />
              </div>
              <Panel className="self-start">
                <PanelHeader title="How did it come out?" description="This is what tells the books whether the check really exists." />
                <div className="flex flex-col gap-3 p-5">
                  <OutcomeChoice selected={choice === "ok"} onClick={() => setChoice("ok")} tone="ok" title="It printed correctly" detail="Clean, complete, MICR line crisp." />
                  <OutcomeChoice selected={choice === "spoiled"} onClick={() => setChoice("spoiled")} tone="bad" title="It came out wrong" detail="Jammed, smudged, cut off or misaligned. The check is voided as spoiled." />
                  <AnimatePresence initial={false}>
                    {choice === "spoiled" && (
                      <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }}>
                        <Field label="What went wrong?" htmlFor="spoil-reason" hint="Destroy the spoiled sheet.">
                          <Textarea autoFocus maxLength={500} placeholder="Paper jammed halfway" value={spoilReason} onChange={(e) => setSpoilReason(e.target.value)} />
                        </Field>
                      </motion.div>
                    )}
                  </AnimatePresence>
                  <Button size="lg" variant={choice === "spoiled" ? "danger" : "primary"} disabled={!choice || (choice === "spoiled" && !spoilReason.trim())} loading={outcome.isPending} onClick={report}>
                    {choice === "spoiled" ? "Void as spoiled" : "Confirm"}
                  </Button>
                </div>
              </Panel>
            </div>
          )}

          {stage === "done-ok" && (
            <Panel className="flex flex-col items-center gap-5 px-6 py-12 text-center">
              <motion.span initial={{ scale: 0, rotate: -30 }} animate={{ scale: 1, rotate: 0 }} transition={{ type: "spring", stiffness: 260, damping: 14 }} className="flex size-14 items-center justify-center rounded-2xl bg-success-600 text-white shadow-pop">
                <PartyPopper className="size-7" />
              </motion.span>
              <div className="flex flex-col gap-1">
                <p className="text-xl font-semibold tracking-tight">Check #{checkNo(check.checkNumber)} is printed and confirmed</p>
                <p className="text-sm text-muted">{money(check.amount)} to {check.payeeName}. It now shows as outstanding until it clears.</p>
              </div>
              <div className="w-full max-w-md">{face}</div>
              <div className="flex flex-wrap justify-center gap-2">
                {next ? (
                  <Button onClick={() => navigate(`/w/${wid}/print/${next.id}`)}>Print next: #{checkNo(next.checkNumber)} · {next.payeeName} <ArrowRight /></Button>
                ) : (
                  <Button asChild><Link to={`/w/${wid}/print`}>Back to print station</Link></Button>
                )}
                <Button variant="secondary" asChild><Link to={`/w/${wid}/checks/${check.id}`}>Open check</Link></Button>
              </div>
            </Panel>
          )}

          {stage === "done-spoiled" && (
            <Panel className="flex flex-col items-center gap-5 px-6 py-12 text-center">
              <span className="flex size-14 items-center justify-center rounded-2xl bg-danger-50 text-danger-600 ring-1 ring-danger-500/20"><FileWarning className="size-7" /></span>
              <div className="flex max-w-md flex-col gap-1">
                <p className="text-xl font-semibold tracking-tight">Check #{checkNo(check.checkNumber)} is voided as spoiled</p>
                <p className="text-sm text-muted">{notice ?? "Destroy the spoiled sheet. Its number stays on record as void."}</p>
              </div>
              {check.reissuedTo ? (
                <Button asChild><Link to={`/w/${wid}/checks/${check.reissuedTo.id}`}>Open replacement #{checkNo(check.reissuedTo.checkNumber)}</Link></Button>
              ) : can("check:create") ? (
                <Button
                  size="lg"
                  loading={reissue.isPending}
                  onClick={() =>
                    reissue.mutate({ checkId: check.id }, {
                      onSuccess: (n) => {
                        toast.success(`Replacement #${checkNo(n.checkNumber)} created`);
                        navigate(n.status === "PENDING_APPROVAL" ? `/w/${wid}/checks/${n.id}` : `/w/${wid}/print/${n.id}`);
                      },
                      onError: (e) => toast.error(errorMessage(e)),
                    })
                  }
                >
                  <RotateCcw /> Reissue with a new number
                </Button>
              ) : (
                <p className="text-sm text-muted">Ask someone who writes checks to reissue it from the check's page.</p>
              )}
              <Button variant="ghost" asChild><Link to={`/w/${wid}/print`}>Back to print station</Link></Button>
            </Panel>
          )}
        </motion.div>
      </AnimatePresence>
    </Page>
  );
}

function OutcomeChoice({ selected, onClick, tone, title, detail }: { selected: boolean; onClick: () => void; tone: "ok" | "bad"; title: string; detail: string }) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      onClick={onClick}
      className={cn(
        "flex items-start gap-3 rounded-xl border p-3.5 text-left transition-all",
        selected ? (tone === "ok" ? "border-success-600 bg-success-50 shadow-[0_0_0_3px_rgb(22_163_74/0.12)]" : "border-danger-600 bg-danger-50 shadow-[0_0_0_3px_rgb(220_38_38/0.1)]") : "border-line hover:border-line-strong",
      )}
    >
      <span className={cn("mt-0.5 flex size-6 items-center justify-center rounded-full", tone === "ok" ? "bg-success-600 text-white" : "bg-danger-600 text-white")}>
        {tone === "ok" ? <CheckIcon className="size-3.5" strokeWidth={3} /> : <TriangleAlert className="size-3.5" />}
      </span>
      <span className="flex flex-col">
        <span className="text-sm font-semibold">{title}</span>
        <span className="text-xs text-muted">{detail}</span>
      </span>
    </button>
  );
}

function Back() {
  const { wid } = useWorkspaceContext();
  return <Link to={`/w/${wid}/print`} className="inline-flex w-fit items-center gap-1.5 text-sm text-muted hover:text-ink"><ArrowLeft className="size-4" /> Print station</Link>;
}
