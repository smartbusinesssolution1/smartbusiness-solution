import { Check, X } from "lucide-react";
import type { PaperSize } from "@/api/types";
import { Checkbox } from "@/components/ui/controls";
import { cn } from "@/lib/utils";

// A three-per-page sheet with its used slots shaded. `turned` draws the same sheet
// rotated 180°: the used checks end up at the bottom, upside down.
function SheetSketch({ used, turned, paper }: { used: number; turned?: boolean; paper: PaperSize }) {
  const W = 60;
  const H = paper === "LETTER" ? (W * 11) / 8.5 : (W * 297) / 210;
  const band = (W * 3.5) / (paper === "LETTER" ? 8.5 : 8.27);
  return (
    <svg viewBox={`-2 -2 ${W + 4} ${H + 4}`} className="h-auto w-full" aria-hidden="true">
      <rect x="0" y="0" width={W} height={H} rx="1.5" fill="#fff" stroke="#d6d6db" strokeWidth="0.6" />
      <g transform={turned ? `rotate(180 ${W / 2} ${H / 2})` : undefined}>
        {[0, 1, 2].map((i) => {
          const y = i * band;
          const isUsed = i < used;
          return (
            <g key={i}>
              <rect x="2.5" y={y + 2} width={W - 5} height={band - 4} rx="1" fill={isUsed ? "#e4e4e7" : "#fff"} stroke={isUsed ? "#a1a1aa" : "#d6d6db"} strokeWidth="0.5" strokeDasharray={isUsed ? undefined : "1.2 1"} />
              {isUsed && (
                <>
                  <rect x="5" y={y + 6} width="16" height="1.4" rx="0.6" fill="#52525b" />
                  <rect x={W - 18} y={y + 6} width="13" height="3.4" rx="0.6" fill="none" stroke="#52525b" strokeWidth="0.45" />
                  <rect x="5" y={y + band - 7} width={W * 0.55} height="1.6" rx="0.6" fill="#52525b" />
                </>
              )}
            </g>
          );
        })}
      </g>
    </svg>
  );
}

// Asked before printing into a partly used three-per-page sheet. Put back turned
// around, the middle slot is still the middle but the bottom slot lands on the used
// top check, so the person confirms the sheet is in the tray the same way as before.
export function ReloadCheck({
  firstSlot,
  paper,
  confirmed,
  onConfirmedChange,
  onFreshSheet,
}: {
  firstSlot: 2 | 3;
  paper: PaperSize;
  confirmed: boolean;
  onConfirmedChange: (on: boolean) => void;
  onFreshSheet: () => void;
}) {
  const used = firstSlot - 1;
  return (
    <div className={cn("flex flex-col gap-3 rounded-xl border p-3.5", confirmed ? "border-line bg-subtle/50" : "border-warning-500/40 bg-warning-50")}>
      <div className="flex flex-col gap-1">
        <span className="text-sm font-semibold">Putting a used sheet back?</span>
        <span className="text-xs leading-relaxed text-ink-soft">
          Load it exactly the way it went in the first time: <b>same side up, same end first</b>. Turned around, the next check prints over {used === 1 ? "the used one" : "a used one"}.
        </span>
      </div>
      <div className="grid grid-cols-2 gap-3">
        {[false, true].map((turned) => (
          <figure key={String(turned)} className="flex flex-col items-center gap-1.5">
            <div className="w-14"><SheetSketch used={used} turned={turned} paper={paper} /></div>
            <figcaption className={cn("flex items-center gap-1 text-[0.6875rem] font-medium", turned ? "text-danger-600" : "text-success-700")}>
              {turned ? <X className="size-3.5" /> : <Check className="size-3.5" />} {turned ? "Turned around" : "Same way as before"}
            </figcaption>
          </figure>
        ))}
      </div>
      <label className="flex cursor-pointer items-start gap-2.5 text-xs font-medium">
        <Checkbox checked={confirmed} onCheckedChange={(on) => onConfirmedChange(on === true)} className="mt-px" />
        The used sheet is in the tray the same way as before.
      </label>
      <button type="button" onClick={onFreshSheet} className="self-start text-xs text-muted underline underline-offset-2 hover:text-ink">
        Use a fresh sheet instead (start at the top)
      </button>
    </div>
  );
}
