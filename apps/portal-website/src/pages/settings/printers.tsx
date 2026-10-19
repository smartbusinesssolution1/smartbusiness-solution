import * as React from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router";
import { AnimatePresence, motion } from "motion/react";
import { toast } from "sonner";
import {
  ArrowLeft,
  ArrowRight,
  BadgeCheck,
  Check,
  CircleAlert,
  MoreHorizontal,
  Plus,
  Printer,
  RefreshCw,
  Ruler,
  ScanLine,
  Star,
  Trash2,
  Wrench,
  PartyPopper,
  Info,
} from "lucide-react";
import {
  fetchCalibrationSheet,
  fetchVerificationSample,
  useAdjustPrinter,
  useCreatePrinter,
  useDeletePrinter,
  usePrinter,
  usePrinters,
  useSetDefaultPrinter,
  useUpdatePrinter,
  useVerifyPrinter,
} from "@/api/setup";
import type { CalibrationSheet, CheckLayout, PaperSize, PrinterProfile, StockType, VerificationItem, VerificationOutcome } from "@/api/types";
import { useWorkspaceContext } from "@/app/workspace-context";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Segmented } from "@/components/ui/controls";
import { Dialog, DialogContent, DialogFooter, DialogHeader } from "@/components/ui/dialog";
import { Menu, MenuContent, MenuItem, MenuSeparator, MenuTrigger } from "@/components/ui/menu";
import { EmptyState, ErrorState, InlineAlert, Page, PageHeader, Panel, PanelHeader, Skeleton } from "@/components/app/layout";
import { PdfDialog, PdfFrame, PrintTips, usePdf } from "@/components/app/pdf-dialog";
import { CalibrationDiagram, LAYOUTS, PaperDiagram, VerificationDiagram, layoutLabel, paperLabel, type Landmark } from "@/components/app/paper";
import { ApiError, errorMessage } from "@/lib/api";
import { when } from "@/lib/format";
import { cn } from "@/lib/utils";

const MM_PER_IN = 25.4;
const PAPER_WIDTH_MM: Record<PaperSize, number> = { LETTER: 215.9, A4: 210 };

// Where the calibration sheet's reference lines are, in inches (CALIBRATION_REF v2).
const REF: Record<PaperSize, CalibrationSheet> = {
  LETTER: { x1: 1.0, x2: 7.5, y1: 1.0, y2: 10.0 },
  A4: { x1: 1.0, x2: 7.25, y1: 1.0, y2: 10.5 },
};

function BackLink({ to, children }: { to: string; children: React.ReactNode }) {
  return (
    <Link to={to} className="inline-flex w-fit items-center gap-1.5 text-sm text-muted transition-colors hover:text-ink">
      <ArrowLeft className="size-4" /> {children}
    </Link>
  );
}

function VerifiedBadge({ profile }: { profile: PrinterProfile }) {
  if (profile.needsRecalibration) {
    return <span className="inline-flex items-center gap-1 rounded-full bg-danger-50 px-2 py-0.5 text-xs font-medium text-danger-700 ring-1 ring-danger-500/20 ring-inset"><CircleAlert className="size-3" /> Recalibrate</span>;
  }
  return profile.verification.verified ? (
    <span className="inline-flex items-center gap-1 rounded-full bg-success-50 px-2 py-0.5 text-xs font-medium text-success-700 ring-1 ring-success-500/25 ring-inset"><BadgeCheck className="size-3" /> Verified</span>
  ) : (
    <span className="inline-flex items-center gap-1 rounded-full bg-warning-50 px-2 py-0.5 text-xs font-medium text-warning-700 ring-1 ring-warning-500/30 ring-inset"><ScanLine className="size-3" /> Not verified</span>
  );
}

// ─── List ─────────────────────────────────────────────────

export function PrintersPage() {
  const { wid } = useWorkspaceContext();
  const { data, isPending, error, refetch } = usePrinters(wid);
  const setDefault = useSetDefaultPrinter(wid);

  return (
    <Page>
      <PageHeader
        eyebrow="Settings"
        title="Printers"
        description="Each profile is one printer, tray and paper. Calibration corrects where that printer puts ink, so the MICR line lands where bank machines read it."
        actions={<Button asChild><Link to={`/w/${wid}/settings/printers/new`}><Plus /> Set up a printer</Link></Button>}
      />
      {isPending ? (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">{Array.from({ length: 3 }, (_, i) => <Skeleton key={i} className="h-44 rounded-[var(--radius-card)]" />)}</div>
      ) : error ? (
        <ErrorState error={error} onRetry={() => refetch()} />
      ) : data.length === 0 ? (
        <EmptyState icon={<Printer />} title="No printer set up" description="You'll print a calibration sheet three times and measure it with a ruler. It takes about five minutes and is done once per printer and paper." action={<Button asChild size="sm"><Link to={`/w/${wid}/settings/printers/new`}><Plus /> Set up a printer</Link></Button>} />
      ) : (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {data.map((p, i) => (
            <motion.div key={p.id} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04 }} className="relative">
              <Link to={`/w/${wid}/settings/printers/${p.id}`} className="group flex gap-4 rounded-[var(--radius-card)] border border-line bg-panel p-4 shadow-card transition-all hover:-translate-y-0.5 hover:border-line-strong">
                <div className="w-16 shrink-0"><PaperDiagram layout={p.layout} paper={p.paperSize} /></div>
                <div className="flex min-w-0 flex-1 flex-col gap-1.5">
                  <div className="flex items-center gap-1.5">
                    <p className="truncate font-semibold">{p.profileName}</p>
                    {p.isDefault && <Star className="size-3.5 shrink-0 fill-warning-500 text-warning-500" aria-label="Default printer" />}
                  </div>
                  <p className="text-xs text-muted">{layoutLabel(p.layout)} · {p.paperSize === "LETTER" ? "Letter" : "A4"} · {p.stockType === "PLAIN_PAPER" ? "Plain paper" : "Perforated"}</p>
                  {p.tray && <p className="text-xs text-muted">Tray: {p.tray}</p>}
                  <div className="mt-auto pt-2"><VerifiedBadge profile={p} /></div>
                </div>
              </Link>
              {!p.isDefault && (
                <Button variant="ghost" size="sm" className="absolute right-3 bottom-3" loading={setDefault.isPending && setDefault.variables === p.id} onClick={() => setDefault.mutate(p.id, { onSuccess: () => toast.success(`${p.profileName} is now the default printer`), onError: (e) => toast.error(errorMessage(e)) })}>
                  Make default
                </Button>
              )}
            </motion.div>
          ))}
        </div>
      )}
    </Page>
  );
}

// ─── Wizard ───────────────────────────────────────────────

const STEPS = ["Paper", "Print sheet", "Measure", "Save"];

type Unit = "mm" | "in";
type SheetDraft = Record<keyof CalibrationSheet, string>;
const emptySheet = (): SheetDraft => ({ x1: "", x2: "", y1: "", y2: "" });

function Stepper({ step }: { step: number }) {
  return (
    <ol className="flex items-center gap-2" aria-label="Progress">
      {STEPS.map((s, i) => {
        const done = i < step;
        const current = i === step;
        return (
          <li key={s} className="flex flex-1 items-center gap-2" aria-current={current ? "step" : undefined}>
            <span className={cn("flex size-7 shrink-0 items-center justify-center rounded-full text-xs font-semibold transition-colors", done ? "bg-success-600 text-white" : current ? "bg-ink text-white ring-4 ring-ink/10" : "bg-subtle text-muted")}>
              {done ? <Check className="size-3.5" strokeWidth={3} /> : i + 1}
            </span>
            <span className={cn("hidden text-sm sm:inline", current ? "font-semibold" : "text-muted")}>{s}</span>
            {i < STEPS.length - 1 && (
              <span className="relative mx-1 h-px flex-1 overflow-hidden bg-line">
                <motion.span className="absolute inset-0 bg-success-600" initial={false} animate={{ scaleX: done ? 1 : 0 }} style={{ originX: 0 }} transition={{ duration: 0.4 }} />
              </span>
            )}
          </li>
        );
      })}
    </ol>
  );
}

function ChoiceCard({ selected, onClick, children, className }: { selected: boolean; onClick: () => void; children: React.ReactNode; className?: string }) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      onClick={onClick}
      className={cn(
        "relative flex flex-col gap-2 rounded-2xl border bg-panel p-3 text-left transition-all",
        selected ? "border-ink shadow-[0_0_0_3px_rgb(10_10_11/0.07)]" : "border-line hover:border-line-strong",
        className,
      )}
    >
      {selected && (
        <motion.span layoutId={undefined} initial={{ scale: 0 }} animate={{ scale: 1 }} className="absolute top-2.5 right-2.5 flex size-5 items-center justify-center rounded-full bg-ink text-white">
          <Check className="size-3" strokeWidth={3} />
        </motion.span>
      )}
      {children}
    </button>
  );
}

export function NewPrinterPage() {
  const { wid } = useWorkspaceContext();
  const navigate = useNavigate();
  const create = useCreatePrinter(wid);
  const [step, setStep] = React.useState(0);
  const [name, setName] = React.useState("");
  const [tray, setTray] = React.useState("");
  const [paper, setPaper] = React.useState<PaperSize>("LETTER");
  const [stock, setStock] = React.useState<StockType>("PLAIN_PAPER");
  const [layout, setLayout] = React.useState<CheckLayout>("CHECK_MIDDLE");
  const [unit, setUnit] = React.useState<Unit>("mm");
  const [sheets, setSheets] = React.useState<SheetDraft[]>([emptySheet(), emptySheet(), emptySheet()]);
  const [focus, setFocus] = React.useState<keyof CalibrationSheet | null>(null);
  const [sheetOpen, setSheetOpen] = React.useState(false);
  const [printed, setPrinted] = React.useState(false);
  const [nameError, setNameError] = React.useState<string>();
  const [saveError, setSaveError] = React.useState<string | null>(null);

  const ref = REF[paper];
  const refIn = (k: keyof CalibrationSheet) => (unit === "mm" ? ref[k] * MM_PER_IN : ref[k]);
  const fetchSheet = React.useCallback(() => fetchCalibrationSheet(wid, paper), [wid, paper]);

  const parsed = sheets.map((s) => Object.fromEntries(Object.entries(s).map(([k, v]) => [k, Number(v)])) as unknown as CalibrationSheet);
  const sheetComplete = (s: SheetDraft) => (Object.values(s) as string[]).every((v) => v !== "" && Number(v) > 0);
  const allMeasured = sheets.every(sheetComplete);

  // The paper's own width catches the most common setup mistake (A4 in a Letter profile, or
  // the reverse) before any sheet is measured: on the wrong size nothing can ever verify.
  const [paperWidth, setPaperWidth] = React.useState("");
  const otherPaper: PaperSize = paper === "LETTER" ? "A4" : "LETTER";
  const widthMm = paperWidth ? Number(paperWidth) * (unit === "in" ? MM_PER_IN : 1) : NaN;
  const widthCheck: "empty" | "ok" | "other" | "unknown" = !Number.isFinite(widthMm)
    ? "empty"
    : Math.abs(widthMm - PAPER_WIDTH_MM[paper]) <= 2
      ? "ok"
      : Math.abs(widthMm - PAPER_WIDTH_MM[otherPaper]) <= 2
        ? "other"
        : "unknown";

  const next = () => {
    if (step === 0) {
      if (!name.trim()) return setNameError("Give this printer a name, e.g. “Office HP, tray 2”");
      setNameError(undefined);
    }
    setStep((s) => Math.min(s + 1, STEPS.length - 1));
  };

  const save = () => {
    setSaveError(null);
    create.mutate(
      { profileName: name.trim(), paperSize: paper, stockType: stock, layout, tray: tray.trim() || undefined, measurements: { unit, sheets: parsed } },
      {
        onSuccess: (p) => {
          toast.success("Printer calibrated", { description: "Now print a sample check to verify it." });
          navigate(`/w/${wid}/settings/printers/${p.id}?verify=1`, { replace: true });
        },
        onError: (err) => {
          const fieldMsg = err instanceof ApiError ? Object.values(err.details ?? {})[0]?.[0] : undefined;
          setSaveError(err.message + (fieldMsg && fieldMsg !== err.message ? ` ${fieldMsg}` : ""));
        },
      },
    );
  };

  return (
    <Page className="max-w-5xl">
      <PageHeader back={<BackLink to={`/w/${wid}/settings/printers`}>Printers</BackLink>} eyebrow="Setup · Printer" title="Set up a printer" description="Done once per printer, tray and paper. You'll need the printer, a few sheets of paper and a steel ruler." />
      <Panel className="p-4 sm:p-5"><Stepper step={step} /></Panel>

      <AnimatePresence mode="wait" initial={false}>
        <motion.div key={step} initial={{ opacity: 0, x: 16 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -16 }} transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}>
          {step === 0 && (
            <Panel>
              <PanelHeader title="Which printer, and what paper is in it?" description="The layout tells us where the check sits on your check paper." />
              <div className="flex flex-col gap-6 p-5">
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field label="Printer name" htmlFor="profileName" error={nameError}>
                    <Input autoFocus value={name} onChange={(e) => { setName(e.target.value); if (e.target.value.trim()) setNameError(undefined); }} maxLength={100} placeholder="Office HP LaserJet" />
                  </Field>
                  <Field label="Tray" htmlFor="tray" optional hint="Helps people load the right tray.">
                    <Input value={tray} onChange={(e) => setTray(e.target.value)} maxLength={50} placeholder="Tray 2" />
                  </Field>
                </div>
                <div className="flex flex-col gap-2">
                  <span className="text-[0.8125rem] font-medium text-ink-soft">Paper size</span>
                  <div role="radiogroup" aria-label="Paper size" className="grid grid-cols-2 gap-3 sm:max-w-md">
                    {(["LETTER", "A4"] as const).map((p) => (
                      <ChoiceCard key={p} selected={paper === p} onClick={() => setPaper(p)}>
                        <span className="font-semibold">{p === "LETTER" ? "US Letter" : "A4"}</span>
                        <span className="text-xs text-muted">{paperLabel(p)}</span>
                      </ChoiceCard>
                    ))}
                  </div>
                </div>
                <div className="flex flex-col gap-2">
                  <span className="text-[0.8125rem] font-medium text-ink-soft">Paper type</span>
                  <div role="radiogroup" aria-label="Paper type" className="grid gap-3 sm:max-w-xl sm:grid-cols-2">
                    <ChoiceCard selected={stock === "PLAIN_PAPER"} onClick={() => setStock("PLAIN_PAPER")}>
                      <span className="font-semibold">Plain paper</span>
                      <span className="text-xs text-muted">We print dashed tear lines to cut along.</span>
                    </ChoiceCard>
                    <ChoiceCard selected={stock === "PERFORATED_STOCK"} onClick={() => setStock("PERFORATED_STOCK")}>
                      <span className="font-semibold">Perforated check stock</span>
                      <span className="text-xs text-muted">Pre-perforated; no lines printed.</span>
                    </ChoiceCard>
                  </div>
                </div>
                <div className="flex flex-col gap-2">
                  <span className="text-[0.8125rem] font-medium text-ink-soft">Check layout</span>
                  <div role="radiogroup" aria-label="Check layout" className="grid grid-cols-2 gap-3 md:grid-cols-4">
                    {LAYOUTS.map((l) => (
                      <ChoiceCard key={l.value} selected={layout === l.value} onClick={() => setLayout(l.value)} className="items-center text-center">
                        <div className="w-14 py-1"><PaperDiagram layout={l.value} paper={paper} /></div>
                        <span className="text-sm font-semibold">{l.label}</span>
                        <span className="text-[0.6875rem] leading-tight text-muted">{l.description}</span>
                      </ChoiceCard>
                    ))}
                  </div>
                  {layout === "THREE_PER_PAGE" && <InlineAlert tone="info">Three-per-page paper has no stubs, so invoice lines aren't printed. You choose which slot to print in each time.</InlineAlert>}
                </div>
              </div>
            </Panel>
          )}

          {step === 1 && (
            <Panel>
              <PanelHeader title="Print the calibration sheet three times" description={`On ${paper === "LETTER" ? "Letter" : "A4"} paper from ${tray.trim() || "the tray you'll use for checks"}. Three copies show whether the printer lands in the same place every time.`} />
              <div className="grid gap-6 p-5 lg:grid-cols-[minmax(0,1fr)_16rem]">
                <div className="flex flex-col gap-4">
                  <PrintTips />
                  <ol className="flex flex-col gap-2 text-sm">
                    {["Open the sheet and print it with the settings above.", "Print it two more times (three sheets in total).", "Don't move the paper guides between prints."].map((t, i) => (
                      <li key={t} className="flex items-start gap-3"><span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-subtle font-mono text-xs">{i + 1}</span><span className="pt-0.5">{t}</span></li>
                    ))}
                  </ol>
                  <div className="flex flex-wrap gap-2">
                    <Button onClick={() => { setSheetOpen(true); setPrinted(true); }}><Printer /> Open calibration sheet</Button>
                  </div>
                </div>
                <div className="rounded-2xl border border-line bg-subtle/50 p-4"><CalibrationDiagram /></div>
              </div>
              <PdfDialog open={sheetOpen} onOpenChange={setSheetOpen} pdfKey={["calibration-sheet", wid, paper]} title="Calibration sheet" description="Print this three times." fetcher={fetchSheet} />
            </Panel>
          )}

          {step === 2 && (
            <Panel>
              <PanelHeader
                title="Measure each sheet with a ruler"
                description="From the paper's edge to the centre of each line. Use a physical ruler; nothing printed on the sheet is accurate enough."
                action={<Segmented size="sm" layoutId="cal-unit" aria-label="Unit" value={unit} onChange={setUnit} options={[{ value: "mm", label: "mm" }, { value: "in", label: "inches" }]} />}
              />
              <div className="grid gap-6 p-5 lg:grid-cols-[minmax(0,1fr)_15rem]">
                <div className="flex flex-col gap-4">
                  <div className="flex flex-col gap-2 rounded-xl border border-line bg-subtle/50 p-3">
                    <div className="flex flex-wrap items-end gap-3">
                      <Field label="First, the width of the paper itself" htmlFor="paperWidth" hint={`${paper === "LETTER" ? "US Letter" : "A4"} is ${unit === "mm" ? PAPER_WIDTH_MM[paper].toFixed(1) + " mm" : (PAPER_WIDTH_MM[paper] / MM_PER_IN).toFixed(2) + " in"} wide.`} className="w-56">
                        <Input inputMode="decimal" value={paperWidth} onChange={(e) => setPaperWidth(e.target.value.replace(",", "."))} placeholder={unit === "mm" ? PAPER_WIDTH_MM[paper].toFixed(1) : (PAPER_WIDTH_MM[paper] / MM_PER_IN).toFixed(2)} className="h-9 font-mono" trailing={<span className="pr-1 text-xs">{unit}</span>} />
                      </Field>
                      {widthCheck === "ok" && <span className="pb-6 text-xs font-medium text-success-700">Matches {paper === "LETTER" ? "US Letter" : "A4"}.</span>}
                    </div>
                    {widthCheck === "other" && (
                      <InlineAlert
                        tone="danger"
                        title={`This is ${otherPaper === "A4" ? "A4" : "US Letter"} paper, not ${paper === "LETTER" ? "US Letter" : "A4"}`}
                        action={<Button size="sm" onClick={() => { setPaper(otherPaper); setPaperWidth(""); setSheets([emptySheet(), emptySheet(), emptySheet()]); setPrinted(false); setStep(1); }}>Switch to {otherPaper === "A4" ? "A4" : "Letter"} and print its sheet</Button>}
                      >
                        Measurements on the wrong paper size can never verify. Switch the profile to the paper that's in the tray, or load {paper === "LETTER" ? "Letter" : "A4"} paper.
                      </InlineAlert>
                    )}
                    {widthCheck === "unknown" && <InlineAlert tone="warning">That doesn't match US Letter (215.9 mm) or A4 (210 mm). Measure the paper again, edge to edge.</InlineAlert>}
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full min-w-[30rem] text-sm">
                      <thead>
                        <tr className="text-left text-xs text-muted">
                          <th className="pb-2 font-medium">Sheet</th>
                          {(["x1", "x2", "y1", "y2"] as const).map((k) => (
                            <th key={k} className="pb-2 font-medium">
                              <span className="font-mono font-semibold text-ink">{k.toUpperCase()}</span> <span className="font-normal">≈ {refIn(k).toFixed(unit === "mm" ? 1 : 2)}</span>
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {sheets.map((s, i) => (
                          <tr key={i}>
                            <td className="py-1.5 pr-3 font-mono text-xs text-muted">#{i + 1}{sheetComplete(s) && <Check className="ml-1 inline size-3 text-success-600" />}</td>
                            {(["x1", "x2", "y1", "y2"] as const).map((k) => {
                              const value = s[k];
                              const off = value ? Math.abs(Number(value) - refIn(k)) * (unit === "in" ? MM_PER_IN : 1) : 0;
                              const suspicious = value !== "" && (Number.isNaN(Number(value)) || off > 10);
                              return (
                                <td key={k} className="py-1.5 pr-2">
                                  <Input
                                    aria-label={`Sheet ${i + 1} ${k.toUpperCase()} in ${unit}`}
                                    aria-invalid={suspicious || undefined}
                                    inputMode="decimal"
                                    value={value}
                                    onFocus={() => setFocus(k)}
                                    onBlur={() => setFocus(null)}
                                    onChange={(e) => setSheets((all) => all.map((sh, j) => (j === i ? { ...sh, [k]: e.target.value.replace(",", ".") } : sh)))}
                                    placeholder={refIn(k).toFixed(unit === "mm" ? 1 : 2)}
                                    className="h-9 font-mono"
                                  />
                                </td>
                              );
                            })}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    {sheets.length < 5 && <Button variant="secondary" size="sm" onClick={() => setSheets((s) => [...s, emptySheet()])}><Plus /> Add a sheet</Button>}
                    {sheets.length > 3 && <Button variant="ghost" size="sm" onClick={() => setSheets((s) => s.slice(0, -1))}>Remove last</Button>}
                    <span className="text-xs text-muted">3 to 5 sheets. Readings far from the ≈ value are highlighted. Check them for a typo.</span>
                  </div>
                </div>
                <div className="flex flex-col gap-3 rounded-2xl border border-line bg-subtle/50 p-4">
                  <CalibrationDiagram highlight={focus} />
                  <p className="text-xs leading-relaxed text-muted">
                    <span className="font-semibold text-ink">X</span> from the <span className="font-semibold text-ink">left</span> edge. <span className="font-semibold text-ink">Y</span> from the <span className="font-semibold text-ink">top</span> edge, the one that went into the printer first.
                  </p>
                </div>
              </div>
            </Panel>
          )}

          {step === 3 && (
            <Panel>
              <PanelHeader title="Check and save" description="We'll work out how far this printer shifts the page and correct for it on every check." />
              <div className="grid gap-6 p-5 md:grid-cols-[10rem_minmax(0,1fr)]">
                <PaperDiagram layout={layout} paper={paper} />
                <dl className="grid content-start gap-x-6 gap-y-3 text-sm sm:grid-cols-2">
                  {[
                    ["Printer", name],
                    ["Tray", tray || "Not specified"],
                    ["Paper", `${paperLabel(paper)} · ${stock === "PLAIN_PAPER" ? "plain" : "perforated"}`],
                    ["Layout", layoutLabel(layout)],
                    ["Measured", `${sheets.length} sheets in ${unit === "mm" ? "millimetres" : "inches"}`],
                  ].map(([k, v]) => (
                    <div key={k} className="flex flex-col gap-0.5"><dt className="text-xs text-muted">{k}</dt><dd className="font-medium">{v}</dd></div>
                  ))}
                </dl>
              </div>
              {saveError && <div className="px-5 pb-5"><InlineAlert tone="danger" title="This calibration wasn't saved">{saveError}</InlineAlert></div>}
            </Panel>
          )}
        </motion.div>
      </AnimatePresence>

      <div className="flex items-center justify-between gap-3">
        <Button variant="ghost" onClick={() => setStep((s) => Math.max(0, s - 1))} disabled={step === 0}><ArrowLeft /> Back</Button>
        {step < 3 ? (
          <Button onClick={next} disabled={(step === 2 && (!allMeasured || widthCheck !== "ok")) || (step === 1 && !printed)}>
            {step === 1 && !printed ? "Open the sheet first" : "Continue"} <ArrowRight />
          </Button>
        ) : (
          <Button onClick={save} loading={create.isPending}>Save printer <Check /></Button>
        )}
      </div>
      {step === 1 && (
        <button type="button" onClick={() => setPrinted(true)} className="-mt-3 self-end text-xs text-muted underline-offset-4 hover:underline">I already have printed sheets</button>
      )}
    </Page>
  );
}

// ─── Detail + verification ────────────────────────────────

function landmarkLabels(profile: PrinterProfile): Record<VerificationItem, { title: string; from: string }> {
  const edge = profile.stockType === "PLAIN_PAPER" ? "tear line" : "perforation";
  return {
    upperTearLine: { title: `Upper ${edge}`, from: "from the top edge of the paper" },
    lowerTearLine: { title: `Lower ${edge}`, from: "from the top edge of the paper" },
    micrBottom: { title: "Bottom of the MICR digits", from: profile.layout === "CHECK_BOTTOM" ? "from the bottom edge of the paper" : `from the check's bottom ${edge}` },
    micrRightEdge: { title: "Right end of the MICR line", from: "from the right edge of the paper" },
    amountBoxLeft: { title: "Left border of the amount box", from: "from the left edge of the paper" },
  };
}

const LANDMARKS: VerificationItem[] = ["upperTearLine", "lowerTearLine", "micrBottom", "micrRightEdge", "amountBoxLeft"];

export function PrinterDetailPage() {
  const { wid } = useWorkspaceContext();
  const { pid } = useParams();
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const { data: profile, isPending, error, refetch } = usePrinter(wid, pid);
  const setDefault = useSetDefaultPrinter(wid);
  const remove = useDeletePrinter(wid);
  const update = useUpdatePrinter(wid, pid!);
  const [confirmDelete, setConfirmDelete] = React.useState(false);
  const [layoutDialog, setLayoutDialog] = React.useState(false);

  if (isPending) return <Page><Skeleton className="h-8 w-64" /><Skeleton className="h-96 rounded-[var(--radius-card)]" /></Page>;
  if (error) return <Page><ErrorState error={error} onRetry={() => refetch()} /></Page>;

  return (
    <Page>
      <PageHeader
        back={<BackLink to={`/w/${wid}/settings/printers`}>Printers</BackLink>}
        eyebrow={params.get("verify") ? "Setup · Verification" : "Printer"}
        title={
          <span className="inline-flex flex-wrap items-center gap-2.5">
            {profile.profileName}
            <VerifiedBadge profile={profile} />
            {profile.isDefault && <span className="inline-flex items-center gap-1 rounded-full bg-subtle px-2 py-0.5 text-xs font-medium text-ink-soft"><Star className="size-3 fill-warning-500 text-warning-500" /> Default</span>}
          </span>
        }
        description={`${layoutLabel(profile.layout)} · ${paperLabel(profile.paperSize)} · ${profile.stockType === "PLAIN_PAPER" ? "plain paper" : "perforated stock"}${profile.tray ? ` · ${profile.tray}` : ""}`}
        actions={
          <Menu>
            <MenuTrigger asChild><Button variant="secondary" size="icon" aria-label="More actions"><MoreHorizontal /></Button></MenuTrigger>
            <MenuContent>
              {!profile.isDefault && <MenuItem onSelect={() => setDefault.mutate(profile.id, { onSuccess: () => toast.success("Default printer set") })}><Star /> Make default</MenuItem>}
              <MenuItem onSelect={() => setLayoutDialog(true)}><Wrench /> Change check layout</MenuItem>
              <MenuSeparator />
              <MenuItem destructive onSelect={() => setConfirmDelete(true)}><Trash2 /> Delete printer</MenuItem>
            </MenuContent>
          </Menu>
        }
      />

      {profile.needsRecalibration && (
        <InlineAlert tone="danger" title="This printer was calibrated with an older sheet">Set it up again with the current calibration sheet before printing checks.</InlineAlert>
      )}

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <VerificationPanel profile={profile} startOpen={Boolean(params.get("verify")) || !profile.verification.verified} />

        <div className="flex flex-col gap-4">
          <Panel>
            <PanelHeader title="Calibration" />
            <dl className="grid grid-cols-2 gap-4 p-5 text-sm">
              <div className="col-span-2 flex justify-center"><div className="w-24"><PaperDiagram layout={profile.layout} paper={profile.paperSize} /></div></div>
              <Stat label="Horizontal shift" value={`${(Number(profile.horizontalOffsetPts) / 72 * MM_PER_IN).toFixed(2)} mm`} />
              <Stat label="Vertical shift" value={`${(Number(profile.verticalOffsetPts) / 72 * MM_PER_IN).toFixed(2)} mm`} />
              {profile.repeatability && (
                <>
                  <Stat label="Repeatability X" value={`±${(profile.repeatability.spreadXMm / 2).toFixed(2)} mm`} />
                  <Stat label="Repeatability Y" value={`±${(profile.repeatability.spreadYMm / 2).toFixed(2)} mm`} />
                </>
              )}
              <div className="col-span-2 text-xs text-muted">Calibrated {when(profile.calibratedAt)}{profile.verification.verifiedAt && ` · verified ${when(profile.verification.verifiedAt)}`}</div>
            </dl>
          </Panel>
          <Button variant="secondary" asChild>
            <Link to={`/w/${wid}/settings/printers/new`}><RefreshCw /> Calibrate another printer</Link>
          </Button>
        </div>
      </div>

      <Dialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <DialogContent>
          <DialogHeader icon={<Trash2 />} title={`Delete ${profile.profileName}?`} description="Checks already printed keep a record of the settings they were printed with." />
          <DialogFooter>
            <Button variant="secondary" onClick={() => setConfirmDelete(false)}>Cancel</Button>
            <Button variant="danger" loading={remove.isPending} onClick={() => remove.mutate(profile.id, { onSuccess: () => { toast.success("Printer deleted"); navigate(`/w/${wid}/settings/printers`); }, onError: (e) => toast.error(errorMessage(e)) })}>Delete printer</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={layoutDialog} onOpenChange={setLayoutDialog}>
        <DialogContent className="max-w-lg">
          <DialogHeader icon={<Wrench />} title="Change check layout" description="Different paper needs a new verification sample, so changing the layout clears this printer's verification." />
          <div role="radiogroup" aria-label="Check layout" className="grid grid-cols-2 gap-3 px-6 py-4">
            {LAYOUTS.map((l) => (
              <ChoiceCard
                key={l.value}
                selected={profile.layout === l.value}
                onClick={() =>
                  l.value !== profile.layout &&
                  update.mutate({ layout: l.value }, {
                    onSuccess: () => { setLayoutDialog(false); toast.success(`Layout changed to ${l.label}`, { description: "Print a new verification sample." }); },
                    onError: (e) => toast.error(errorMessage(e)),
                  })
                }
                className="items-center text-center"
              >
                <div className="w-12"><PaperDiagram layout={l.value} paper={profile.paperSize} /></div>
                <span className="text-sm font-semibold">{l.label}</span>
              </ChoiceCard>
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </Page>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-0.5"><dt className="text-xs text-muted">{label}</dt><dd className="font-mono font-medium">{value}</dd></div>
  );
}

function VerificationPanel({ profile, startOpen }: { profile: PrinterProfile; startOpen: boolean }) {
  const { wid } = useWorkspaceContext();
  const verify = useVerifyPrinter(wid, profile.id);
  const adjust = useAdjustPrinter(wid, profile.id);
  const [stage, setStage] = React.useState<"idle" | "print" | "measure" | "result">(startOpen ? "print" : "idle");
  const [unit, setUnit] = React.useState<Unit>("mm");
  const [values, setValues] = React.useState<Record<VerificationItem, string>>({ upperTearLine: "", lowerTearLine: "", micrBottom: "", micrRightEdge: "", amountBoxLeft: "" });
  const [focus, setFocus] = React.useState<Landmark | null>(null);
  const [outcome, setOutcome] = React.useState<VerificationOutcome | null>(null);
  const fetchSample = React.useCallback(() => fetchVerificationSample(wid, profile.id), [wid, profile.id]);
  // Offsets are in the key: after an adjustment, the reprinted sample is a fresh PDF.
  const pdf = usePdf(stage === "print" ? ["verification-sample", profile.id, profile.horizontalOffsetPts, profile.verticalOffsetPts, profile.layout] : null, fetchSample);
  const labels = landmarkLabels(profile);
  const complete = LANDMARKS.every((k) => values[k] !== "" && Number(values[k]) > 0);

  const submit = () =>
    verify.mutate(
      { unit, ...(Object.fromEntries(LANDMARKS.map((k) => [k, Number(values[k])])) as Record<VerificationItem, number>) },
      { onSuccess: (r) => { setOutcome(r); setStage("result"); } },
    );

  const applyAdjustment = () => {
    if (!outcome?.suggestedAdjustment) return;
    adjust.mutate(
      { unit: "mm", horizontal: outcome.suggestedAdjustment.horizontalMm, vertical: outcome.suggestedAdjustment.verticalMm },
      {
        onSuccess: () => {
          toast.success("Adjustment applied", { description: "Print the sample again and measure it." });
          setValues({ upperTearLine: "", lowerTearLine: "", micrBottom: "", micrRightEdge: "", amountBoxLeft: "" });
          setOutcome(null);
          setStage("print");
        },
        onError: (e) => toast.error(errorMessage(e)),
      },
    );
  };

  if (stage === "idle") {
    return (
      <Panel className="flex flex-col items-start gap-4 p-6">
        <span className="flex size-10 items-center justify-center rounded-xl bg-success-50 text-success-600 ring-1 ring-success-500/20"><BadgeCheck className="size-5" /></span>
        <div>
          <p className="font-semibold">This printer is verified</p>
          <p className="text-sm text-muted">Its last sample check measured within the bank's tolerance of ±1/16 inch (±1.6 mm).</p>
        </div>
        <Button variant="secondary" onClick={() => setStage("print")}><ScanLine /> Verify again</Button>
      </Panel>
    );
  }

  return (
    <Panel>
      <PanelHeader
        title="Verify with a sample check"
        description="A VOID sample printed exactly like a real check. Measuring five points proves the MICR line lands where bank machines read it."
        action={stage === "measure" && <Segmented size="sm" layoutId="ver-unit" aria-label="Unit" value={unit} onChange={setUnit} options={[{ value: "mm", label: "mm" }, { value: "in", label: "inches" }]} />}
      />
      <div className="flex gap-1 border-b border-line px-5 py-2.5 text-xs">
        {(["print", "measure", "result"] as const).map((s, i) => (
          <span key={s} className={cn("rounded-full px-2.5 py-1 font-medium", stage === s ? "bg-ink text-white" : "text-muted")}>
            {i + 1}. {s === "print" ? "Print" : s === "measure" ? "Measure" : "Result"}
          </span>
        ))}
      </div>

      <AnimatePresence mode="wait" initial={false}>
        <motion.div key={stage} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.2 }} className="p-5">
          {stage === "print" && (
            <div className="flex flex-col gap-4">
              <PrintTips />
              <PdfFrame {...pdf} title="Verification sample" height="26rem" />
              <div className="flex justify-end">
                <Button onClick={() => setStage("measure")}>I've printed it <ArrowRight /></Button>
              </div>
            </div>
          )}

          {stage === "measure" && (
            <div className="grid gap-6 md:grid-cols-[minmax(0,1fr)_13rem]">
              <div className="flex flex-col gap-3">
                {LANDMARKS.map((k, i) => (
                  <div key={k} className={cn("grid grid-cols-[1.75rem_minmax(0,1fr)_7.5rem] items-center gap-3 rounded-xl border p-2.5 transition-colors", focus === k ? "border-accent bg-primary-50/40" : "border-line")}>
                    <span className="flex size-7 items-center justify-center rounded-lg bg-subtle font-mono text-xs font-semibold">{i + 1}</span>
                    <label htmlFor={`m-${k}`} className="flex flex-col">
                      <span className="text-sm font-medium">{labels[k].title}</span>
                      <span className="text-xs text-muted">{labels[k].from}</span>
                    </label>
                    <Input id={`m-${k}`} inputMode="decimal" className="h-9 font-mono" value={values[k]} onFocus={() => setFocus(k)} onBlur={() => setFocus(null)} onChange={(e) => setValues((v) => ({ ...v, [k]: e.target.value.replace(",", ".") }))} trailing={<span className="pr-1 text-xs">{unit}</span>} />
                  </div>
                ))}
                {verify.error && <InlineAlert tone="danger">{errorMessage(verify.error)}</InlineAlert>}
                <div className="flex items-center justify-between gap-2 pt-1">
                  <Button variant="ghost" onClick={() => setStage("print")}><ArrowLeft /> Back</Button>
                  <Button onClick={submit} disabled={!complete} loading={verify.isPending}>Check measurements</Button>
                </div>
              </div>
              <div className="flex flex-col gap-2 rounded-2xl border border-line bg-subtle/50 p-3">
                <VerificationDiagram layout={profile.layout} highlight={focus} />
                <p className="flex gap-1.5 text-xs text-muted"><Ruler className="mt-0.5 size-3.5 shrink-0" /> The sample lists the expected value next to each point.</p>
              </div>
            </div>
          )}

          {stage === "result" && outcome && (
            <div className="flex flex-col gap-5">
              {outcome.passed ? (
                <motion.div initial={{ opacity: 0, scale: 0.97 }} animate={{ opacity: 1, scale: 1 }} className="flex items-center gap-4 rounded-2xl border border-success-500/25 bg-success-50 p-4">
                  <motion.span initial={{ rotate: -20, scale: 0 }} animate={{ rotate: 0, scale: 1 }} transition={{ type: "spring", stiffness: 300, damping: 15 }} className="flex size-11 items-center justify-center rounded-xl bg-success-600 text-white"><PartyPopper className="size-5" /></motion.span>
                  <div>
                    <p className="font-semibold text-success-700">Verified. This printer is ready for checks.</p>
                    <p className="text-sm text-success-700/80">Every point is within the bank's ±1/16 inch tolerance.</p>
                  </div>
                </motion.div>
              ) : (
                outcome.suggestedAdjustment ? (
                  <InlineAlert tone="warning" title="Not accurate enough yet">{outcome.suggestedAdjustment.description}</InlineAlert>
                ) : (
                  // No shift can fix it: lead with the reason (wrong paper size, scaling, font).
                  <InlineAlert
                    tone="danger"
                    title={/ paper,? but this printer profile| paper isn't the size/.test(outcome.notes.join(" ")) ? "Wrong paper size for this printer profile" : "A shift can't fix this"}
                    action={/A4|Letter/.test(outcome.notes.join(" ")) && <Button size="sm" variant="secondary" asChild><Link to={`/w/${wid}/settings/printers/new`}>Set up a profile for this paper</Link></Button>}
                  >
                    {outcome.notes[0] ?? "These readings point to a scaling or setup problem that moving the page can't fix."}
                  </InlineAlert>
                )
              )}
              <div className="overflow-hidden rounded-xl border border-line">
                <table className="w-full text-sm">
                  <thead className="bg-subtle/70 text-left text-xs text-muted">
                    <tr><th className="px-3 py-2 font-medium">Point</th><th className="px-3 py-2 text-right font-medium">Expected</th><th className="px-3 py-2 text-right font-medium">Measured</th><th className="px-3 py-2 text-right font-medium">Off by</th><th className="px-3 py-2 font-medium">Result</th></tr>
                  </thead>
                  <tbody className="divide-y divide-line">
                    {outcome.items.map((it) => (
                      <tr key={it.item}>
                        <td className="px-3 py-2">{it.label}</td>
                        <td className="px-3 py-2 text-right font-mono num">{it.expectedMm.toFixed(2)}</td>
                        <td className="px-3 py-2 text-right font-mono num">{it.measuredMm.toFixed(2)}</td>
                        <td className="px-3 py-2 text-right font-mono num">{it.errorMm > 0 ? "+" : ""}{it.errorMm.toFixed(2)} mm</td>
                        <td className="px-3 py-2">
                          <span className={cn("inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset", it.status === "ok" ? "bg-success-50 text-success-700 ring-success-500/25" : it.status === "marginal" ? "bg-warning-50 text-warning-700 ring-warning-500/30" : "bg-danger-50 text-danger-700 ring-danger-500/20")}>
                            {it.status === "ok" ? <Check className="size-3" /> : <CircleAlert className="size-3" />}
                            {it.status === "ok" ? "Good" : it.status === "marginal" ? "Close" : "Off"}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {outcome.notes.slice(outcome.passed || outcome.suggestedAdjustment ? 0 : 1).length > 0 && (
                <ul className="flex flex-col gap-1.5 text-xs text-muted">
                  {outcome.notes.slice(outcome.passed || outcome.suggestedAdjustment ? 0 : 1).map((n) => <li key={n} className="flex gap-1.5"><Info className="mt-0.5 size-3.5 shrink-0" /> {n}</li>)}
                </ul>
              )}
              <div className="flex flex-wrap justify-end gap-2">
                <Button variant="ghost" onClick={() => setStage("measure")}>Edit measurements</Button>
                {!outcome.passed && outcome.suggestedAdjustment && (
                  <Button onClick={applyAdjustment} loading={adjust.isPending}><Wrench /> Apply adjustment and print again</Button>
                )}
                {outcome.passed && <Button onClick={() => setStage("idle")}>Done</Button>}
              </div>
            </div>
          )}
        </motion.div>
      </AnimatePresence>
    </Panel>
  );
}
