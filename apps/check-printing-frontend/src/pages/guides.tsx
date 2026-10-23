import * as React from "react";
import { Link } from "react-router";
import type { PaperSize } from "@/api/types";
import { Segmented } from "@/components/ui/controls";
import { Brand } from "@/components/app/brand";
import { CalibrationDemo } from "@/components/app/calibration-demo";
import { DEMO_SECONDS } from "@/lib/calibration";

// A public page (no sign-in) with the printer setup demo: a link support can send, or the
// person setting up can open on their phone while standing at the printer.
export function PrinterSetupGuidePage() {
  const [paper, setPaper] = React.useState<PaperSize>("LETTER");

  return (
    <div className="min-h-dvh bg-canvas">
      <div className="mx-auto flex max-w-2xl flex-col gap-6 px-4 py-8 sm:py-12">
        <Link to="/" className="w-fit"><Brand /></Link>
        <div className="flex flex-col gap-2">
          <p className="font-mono text-xs tracking-wider text-accent uppercase">Guide · {DEMO_SECONDS} seconds</p>
          <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">Set up your printer for checks</h1>
          <p className="text-sm text-muted">Done once per printer. You need the calibration sheet from the app, printed 3 times, and a ruler.</p>
        </div>
        <Segmented layoutId="guide-paper" aria-label="Paper size" value={paper} onChange={setPaper} options={[{ value: "LETTER", label: "US Letter" }, { value: "A4", label: "A4" }]} className="self-start" />
        <CalibrationDemo key={paper} paper={paper} />
        <ol className="flex flex-col gap-2 text-sm">
          {[
            "Print the calibration sheet 3 times, at Actual size (100%), on the paper and tray you use for checks. Write 1, 2 and 3 on the copies.",
            "On sheet 1, put the ruler's 0 exactly on the LEFT edge of the paper. Look at the number on the ruler where line X1 is, and write down what YOUR ruler shows. Then X2 the same way.",
            "For Y1 and Y2, put the 0 on the TOP edge: the edge that went into the printer first.",
            "Type your numbers into the app, in the Sheet 1 row. Never copy a number printed on the sheet.",
            "Do the same for sheets 2 and 3, then print one sample check to confirm.",
          ].map((t, i) => (
            <li key={t} className="flex gap-3"><span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-subtle font-mono text-xs">{i + 1}</span><span className="pt-0.5">{t}</span></li>
          ))}
        </ol>
      </div>
    </div>
  );
}
