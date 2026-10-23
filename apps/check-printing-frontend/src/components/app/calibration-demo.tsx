import * as React from "react";
import { AnimatePresence, motion, useMotionValue, useReducedMotion, useTransform, type MotionValue } from "motion/react";
import { Check, ChevronLeft, ChevronRight, Pause, Play, PlayCircle, RotateCcw } from "lucide-react";
import type { PaperSize } from "@/api/types";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader } from "@/components/ui/dialog";
import { PrinterScene, SheetScene, ShiftScene } from "@/components/app/calibration-art";
import { DEMO_SCENE_MS, DEMO_SECONDS } from "@/lib/calibration";
import { cn } from "@/lib/utils";

// ═══════════════════════════════════════════════════════════════
// PRINTER SETUP DEMO
//
// A one-minute walkthrough that plays like a video, with a caption per scene, built from the
// same pictures as the setup screens (so it always matches them, for Letter and A4, and
// weighs nothing). People who skip every paragraph still watch a short video.
// With reduced motion it doesn't play by itself: the scenes become slides.
// ═══════════════════════════════════════════════════════════════

interface Scene {
  caption: string;
  detail: string;
  render: (paper: PaperSize) => React.ReactNode;
}

// How long each plays is DEMO_SCENE_MS, in the same order. Sheet 1 is shown end to end: for
// each line, the ruler on the sheet, then that number typed into its box.
const SCENES: Scene[] = [
  { caption: "Print the calibration sheet 3 times", detail: "Then write 1, 2 and 3 in the \u201cThis is sheet\u201d box on the copies.", render: () => <PrinterScene className="h-full w-auto" /> },
  { caption: "Take sheet 1 and a ruler", detail: "Use the millimetre side. A steel ruler is best.", render: (p) => <SheetScene paper={p} target={null} className="h-full w-auto" /> },
  { caption: "X1: the ruler's 0 on the LEFT edge", detail: "Look at the number on the ruler where line X1 is. Here it reads 25.6.", render: (p) => <SheetScene paper={p} target="x1" loop={false} readingLabel="e.g. 25.6 mm" className="h-full w-auto" /> },
  { caption: "Type it in: Sheet 1 row, under X1", detail: "Type what YOUR ruler shows. Never copy a number from the sheet.", render: () => <GridScene mode={{ kind: "type", col: 0 }} /> },
  { caption: "X2: the ruler's 0 on the LEFT edge too", detail: "Further across the page. Here it reads 190.8.", render: (p) => <SheetScene paper={p} target="x2" loop={false} readingLabel="e.g. 190.8 mm" className="h-full w-auto" /> },
  { caption: "Type it in: Sheet 1 row, under X2", detail: "Right next to X1.", render: () => <GridScene mode={{ kind: "type", col: 1 }} /> },
  { caption: "Y1: the ruler's 0 on the TOP edge", detail: "The top is the edge that went into the printer first. Here it reads 25.9.", render: (p) => <SheetScene paper={p} target="y1" loop={false} readingLabel="e.g. 25.9 mm" className="h-full w-auto" /> },
  { caption: "Type it in: Sheet 1 row, under Y1", detail: "Two numbers to go on this sheet.", render: () => <GridScene mode={{ kind: "type", col: 2 }} /> },
  { caption: "Y2: the ruler's 0 on the TOP edge too", detail: "All the way down the page. Here it reads 254.3.", render: (p) => <SheetScene paper={p} target="y2" loop={false} readingLabel="e.g. 254.3 mm" className="h-full w-auto" /> },
  { caption: "Type it in: Sheet 1 row, under Y2", detail: "The last number for this sheet.", render: () => <GridScene mode={{ kind: "type", col: 3 }} /> },
  { caption: "Sheet 1 is done", detail: "All 4 numbers are in the Sheet 1 row.", render: () => <GridScene mode={{ kind: "sheet-done" }} /> },
  { caption: "Now sheets 2 and 3", detail: "The same 4 lines on each copy, typed in their own rows.", render: () => <GridScene mode={{ kind: "all-sheets" }} /> },
  { caption: "Done: your printer is corrected", detail: "Every check now prints where the bank's machines read it.", render: () => <ShiftScene rightMm={1.4} downMm={-1} className="h-full w-auto" /> },
];

export function CalibrationDemo({ paper, autoPlay = true, className }: { paper: PaperSize; autoPlay?: boolean; className?: string }) {
  const reduce = useReducedMotion();
  const [index, setIndex] = React.useState(0);
  const [playing, setPlaying] = React.useState(autoPlay && !reduce);
  const [ended, setEnded] = React.useState(false);
  // Time into the current scene: a ref and a motion value, so the progress bar moves every
  // frame without re-rendering the scene.
  const elapsed = React.useRef(0);
  const progress = useMotionValue(0);
  const running = playing && !ended;

  React.useEffect(() => {
    if (!running) return;
    let raf = 0;
    let last = performance.now();
    const tick = (now: number) => {
      elapsed.current += now - last;
      last = now;
      const ms = DEMO_SCENE_MS[index]!;
      progress.set(Math.min(1, elapsed.current / ms));
      if (elapsed.current >= ms) {
        if (index < SCENES.length - 1) {
          elapsed.current = 0;
          progress.set(0);
          setIndex(index + 1);
        } else {
          setEnded(true);
          setPlaying(false);
        }
        return;
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [running, index, progress]);

  const goTo = (i: number) => {
    elapsed.current = 0;
    progress.set(0);
    setEnded(false);
    setIndex(Math.max(0, Math.min(SCENES.length - 1, i)));
  };
  const restart = () => {
    goTo(0);
    setPlaying(true);
  };
  const scene = SCENES[index]!;

  return (
    <div className={cn("flex flex-col overflow-hidden rounded-2xl border border-line bg-panel", className)} data-demo-scene={index}>
      <div className="relative flex h-[17rem] items-center justify-center bg-gradient-to-b from-subtle/80 to-subtle/30 px-4 py-4 sm:h-[20rem]">
        <AnimatePresence mode="wait" initial={false}>
          <motion.div key={index} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.25 }} className="flex h-full items-center justify-center">
            {scene.render(paper)}
          </motion.div>
        </AnimatePresence>
        <span className="absolute top-3 left-3 rounded-full bg-panel/90 px-2 py-0.5 font-mono text-[0.6875rem] text-muted ring-1 ring-line">
          {index + 1} / {SCENES.length}
        </span>
      </div>

      <div className="flex flex-col gap-3 border-t border-line px-4 py-3.5">
        <AnimatePresence mode="wait" initial={false}>
          <motion.div key={index} initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }} transition={{ duration: 0.2 }} aria-live="polite">
            <p className="text-base font-semibold">{scene.caption}</p>
            <p className="text-sm text-muted">{scene.detail}</p>
          </motion.div>
        </AnimatePresence>

        <div className="flex items-center gap-2">
          {reduce ? (
            <>
              <Button variant="secondary" size="icon-sm" aria-label="Previous" disabled={index === 0} onClick={() => goTo(index - 1)}><ChevronLeft /></Button>
              <Button variant="secondary" size="icon-sm" aria-label="Next" disabled={index === SCENES.length - 1} onClick={() => goTo(index + 1)}><ChevronRight /></Button>
            </>
          ) : ended ? (
            <Button variant="secondary" size="icon-sm" aria-label="Watch again" onClick={restart}><RotateCcw /></Button>
          ) : (
            <Button variant="secondary" size="icon-sm" aria-label={playing ? "Pause" : "Play"} onClick={() => setPlaying((p) => !p)}>{playing ? <Pause /> : <Play />}</Button>
          )}
          <div className="flex flex-1 gap-1" role="group" aria-label="Scenes">
            {SCENES.map((s, i) => (
              <button key={i} type="button" aria-label={`Scene ${i + 1}: ${s.caption}`} onClick={() => goTo(i)} className="group flex h-6 flex-1 items-center">
                <span className="relative h-1.5 w-full overflow-hidden rounded-full bg-line transition-[height] group-hover:h-2">
                  {i < index || (ended && i === index) ? <span className="absolute inset-0 bg-ink" /> : i === index ? <Fill progress={progress} /> : null}
                </span>
              </button>
            ))}
          </div>
          {!reduce && !ended && index > 0 && <Button variant="ghost" size="icon-sm" aria-label="Start again" onClick={restart}><RotateCcw /></Button>}
        </div>
      </div>
    </div>
  );
}

function Fill({ progress }: { progress: MotionValue<number> }) {
  const width = useTransform(progress, (v) => `${v * 100}%`);
  return <motion.span className="absolute inset-y-0 left-0 bg-ink" style={{ width }} />;
}

// Example readings: close to the ideal measurements, as real ones are, never equal to them.
const READINGS = [
  ["25.6", "190.8", "25.9", "254.3"],
  ["25.7", "190.9", "25.8", "254.2"],
  ["25.5", "190.7", "26.0", "254.4"],
];
const GRID_LINES = ["X1", "X2", "Y1", "Y2"];

type GridMode = { kind: "type"; col: number } | { kind: "sheet-done" } | { kind: "all-sheets" };

// The measurements table as the app shows it: one number being typed into the Sheet 1 row,
// the finished Sheet 1 row, or sheets 2 and 3 filling in after it.
function GridScene({ mode }: { mode: GridMode }) {
  const reduce = useReducedMotion();
  const typing = mode.kind === "type" ? READINGS[0]![mode.col]! : "";
  const [typed, setTyped] = React.useState(reduce ? typing.length : 0);
  React.useEffect(() => {
    if (reduce || !typing) return;
    const t = setInterval(() => setTyped((n) => (n >= typing.length ? n : n + 1)), 300);
    return () => clearInterval(t);
  }, [reduce, typing]);
  const typedAll = typed >= typing.length;
  // Sheets 2 and 3 appear one box after another.
  const later = (row: number, col: number) => 0.3 + ((row - 1) * 4 + col) * 0.32;

  const note =
    mode.kind === "type" ? { text: "Your number, from your ruler", show: typedAll, delay: 0 }
    : mode.kind === "sheet-done" ? { text: "Sheet 1 done: all 4 numbers in", show: true, delay: 0.3 }
    : { text: "All 3 sheets done", show: true, delay: later(2, 3) + 0.4 };

  return (
    <div className="flex w-[25rem] flex-col gap-3 rounded-2xl border border-line bg-panel p-4 shadow-card">
      <table className="w-full table-fixed text-sm">
        <thead>
          <tr className="text-left text-xs text-muted">
            <th className="w-16 pb-1.5 font-medium" />
            {GRID_LINES.map((l) => <th key={l} className="pb-1.5 font-mono font-semibold text-ink">{l}</th>)}
          </tr>
        </thead>
        <tbody>
          {READINGS.map((row, r) => (
            <tr key={r}>
              <td className="py-1 pr-2 text-xs whitespace-nowrap text-muted">Sheet {r + 1}</td>
              {row.map((value, c) => {
                const active = mode.kind === "type" && r === 0 && c === mode.col;
                const firstRowDone = r === 0 && (mode.kind !== "type" || c < mode.col);
                const laterRow = r > 0 && mode.kind === "all-sheets";
                return (
                  <td key={c} className="py-1 pr-1.5">
                    <div
                      className={cn(
                        "flex h-8 items-center rounded-lg border px-1.5 font-mono text-sm transition-colors",
                        active ? "border-accent ring-4 ring-primary-100" : mode.kind === "sheet-done" && r === 0 ? "border-success-500 bg-success-50" : "border-line",
                      )}
                    >
                      {active && (
                        <>
                          {typing.slice(0, typed)}
                          {!typedAll && <motion.span className="ml-0.5 inline-block h-4 w-0.5 bg-ink" animate={{ opacity: [1, 0, 1] }} transition={{ duration: 0.8, repeat: Infinity }} />}
                        </>
                      )}
                      {firstRowDone && value}
                      {laterRow && (
                        <motion.span initial={reduce ? false : { opacity: 0, y: 3 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: later(r, c), duration: 0.2 }}>
                          {value}
                        </motion.span>
                      )}
                    </div>
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
      <motion.span
        initial={{ opacity: 0, y: 4 }}
        animate={note.show ? { opacity: 1, y: 0 } : { opacity: 0, y: 4 }}
        transition={{ delay: reduce ? 0 : note.delay }}
        className="flex items-center gap-1.5 text-sm font-medium text-success-700"
      >
        <Check className="size-4" /> {note.text}
      </motion.span>
    </div>
  );
}

// "Watch how": the demo in a dialog, from any printer setup screen.
export function WatchHow({ paper, variant = "secondary", className }: { paper: PaperSize; variant?: "secondary" | "ghost"; className?: string }) {
  const [open, setOpen] = React.useState(false);
  return (
    <>
      <Button type="button" variant={variant} size="sm" className={className} onClick={() => setOpen(true)}>
        <PlayCircle /> Watch how ({DEMO_SECONDS} sec)
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-xl">
          <DialogHeader icon={<PlayCircle />} title="How to calibrate a printer" description="The whole job, start to finish." />
          <div className="overflow-y-auto px-6 pb-6">{open && <CalibrationDemo paper={paper} />}</div>
        </DialogContent>
      </Dialog>
    </>
  );
}
