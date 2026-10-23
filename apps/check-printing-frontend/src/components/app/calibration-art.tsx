import { motion, useReducedMotion } from "motion/react";
import type { PaperSize } from "@/api/types";
import { CALIBRATION_LINES, CALIBRATION_REF, lineOf, PAPER_IN, type LineKey } from "@/lib/calibration";
import { cn } from "@/lib/utils";

// ═══════════════════════════════════════════════════════════════
// PRINTER SETUP PICTURES
//
// People at a printer look rather than read, so each step of printer setup is shown as a
// small animation: the printer putting out the sheet three times, a ruler sliding onto the
// sheet with its 0 on the right edge and stopping across the line being measured, and the
// check moving back into place once the printer is corrected. Drawn to the real sheet's
// proportions and line positions, for Letter and A4.
// ═══════════════════════════════════════════════════════════════

const U = 20; // drawing units per inch
const PAD = 30;
const BLUE = "#2563eb";
const INK = "#18181b";
const GREY = "#a1a1aa";
const EDGE = "#d6d6db";

// A line's name (X1, Y2…) in a small pill, blue for the line being measured.
function Badge({ x, y, label, on }: { x: number; y: number; label: string; on: boolean }) {
  return (
    <g>
      <rect x={x - 9} y={y - 6} width="18" height="12" rx="6" fill={on ? BLUE : "#e4e4e7"} />
      <text x={x} y={y + 2.6} textAnchor="middle" fontSize="7" fontWeight="700" fill={on ? "#fff" : "#52525b"} className="font-sans">{label}</text>
    </g>
  );
}

// One sheet with the line being measured. The ruler slides in from outside the paper, its 0
// on the edge the line is measured from, and stops across the line; then a bubble points at
// where to read. It never shows the expected number as if it were the answer: people copy it.
export function SheetScene({
  paper,
  target,
  sheet = 1,
  reading = true,
  loop = true,
  rulerIn = true,
  readingLabel = "Read here",
  className,
}: {
  paper: PaperSize;
  target: LineKey | null;
  sheet?: number;
  reading?: boolean;
  // Repeats every few seconds (the setup screens) or plays once (the demo).
  loop?: boolean;
  // false: the ruler is already lying on the sheet (the demo's scene after it slid in).
  rulerIn?: boolean;
  // What the bubble at the crossing says.
  readingLabel?: string;
  className?: string;
}) {
  const reduce = useReducedMotion();
  const ref = CALIBRATION_REF[paper];
  const pw = PAPER_IN[paper].w * U;
  const ph = PAPER_IN[paper].h * U;
  const X = (inch: number) => PAD + inch * U;
  const Y = (inch: number) => PAD + inch * U;
  const line = target ? lineOf(target) : null;
  const fromLeft = line?.from === "left";

  // The ruler crosses the line a little past the middle of the page, clear of the other lines.
  const cross = fromLeft ? Y(ref.y1 + (ref.y2 - ref.y1) * 0.56) : X(ref.x1 + (ref.x2 - ref.x1) * 0.56);
  const targetPos = target ? (fromLeft ? X(ref[target]) : Y(ref[target])) : 0;
  const len = target ? targetPos - PAD + 26 : 0;

  const slide = fromLeft ? "x" : "y";
  const rulerMotion = reduce || (!loop && !rulerIn)
    ? { initial: false as const, animate: { [slide]: 0, opacity: 1 } }
    : loop
      ? {
          initial: { [slide]: -(len + 40), opacity: 0 },
          animate: { [slide]: [-(len + 40), 0, 0, 0], opacity: [0, 1, 1, 0] },
          transition: { duration: 6, times: [0, 0.2, 0.9, 1], repeat: Infinity, ease: "easeOut" as const },
        }
      : {
          initial: { [slide]: -(len + 40), opacity: 0 },
          animate: { [slide]: 0, opacity: 1 },
          transition: { type: "spring" as const, stiffness: 120, damping: 18, delay: 0.3 },
        };
  const readingMotion = reduce
    ? { initial: false as const, animate: { opacity: 1 } }
    : loop
      ? { initial: { opacity: 0 }, animate: { opacity: [0, 0, 1, 1, 0] }, transition: { duration: 6, times: [0, 0.24, 0.32, 0.9, 1], repeat: Infinity } }
      : { initial: { opacity: 0, scale: 0.8 }, animate: { opacity: 1, scale: 1 }, transition: { delay: rulerIn ? 1.2 : 0.5, duration: 0.3 } };

  const W = pw + PAD * 2;
  const H = ph + PAD * 2;
  const bubbleW = 14 + readingLabel.length * 4.4;
  const bubbleX = targetPos + bubbleW + 6 > W - 2 ? targetPos - bubbleW - 6 : targetPos + 6;

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className={cn("h-auto w-full", className)} role="img" aria-label={line ? `Put the ruler's 0 on the ${line.from} edge of the paper and look at the number on the ruler where line ${line.label} is.` : `Sheet ${sheet} of the calibration sheet`}>
      <rect x={PAD} y={PAD} width={pw} height={ph} rx="2" fill="#fff" stroke={EDGE} />
      <text x={PAD + pw / 2} y={PAD + ph * 0.72} textAnchor="middle" fontSize="80" fontWeight="800" fill="#f1f1f3" className="font-sans">{sheet}</text>
      {/* Top left: the reading bubbles for Y1 and Y2 pass the top right and bottom right. */}
      <rect x={PAD + 6} y={PAD + 6} width="48" height="12" rx="3" fill={INK} />
      <text x={PAD + 30} y={PAD + 14.5} textAnchor="middle" fontSize="6.5" fontWeight="700" fill="#fff" className="font-sans">SHEET {sheet}</text>

      {/* The edge to measure from */}
      {line && (fromLeft ? (
        <g>
          <rect x={PAD - 3.5} y={PAD} width="3.5" height={ph} fill={BLUE} />
          <text x={PAD - 9} y={PAD + ph / 2} textAnchor="middle" fontSize="7" fontWeight="700" fill={BLUE} transform={`rotate(-90 ${PAD - 9} ${PAD + ph / 2})`} className="font-sans">LEFT EDGE</text>
        </g>
      ) : (
        <g>
          <rect x={PAD} y={PAD - 3.5} width={pw} height="3.5" fill={BLUE} />
          <text x={PAD + pw / 2} y={PAD - 9} textAnchor="middle" fontSize="7" fontWeight="700" fill={BLUE} className="font-sans">TOP EDGE · went into the printer first</text>
        </g>
      ))}

      {/* The four lines, as on the printed sheet */}
      {CALIBRATION_LINES.map((l) => {
        const on = l.key === target;
        const p = l.from === "left"
          ? { x1: X(ref[l.key]), x2: X(ref[l.key]), y1: Y(ref.y1 + 0.25), y2: Y(ref.y2 - 0.25) }
          : { x1: X(ref.x1 + 0.25), x2: X(ref.x2 - 0.25), y1: Y(ref[l.key]), y2: Y(ref[l.key]) };
        // Letters a third of the way along each line: apart from each other and from the ruler.
        const badge = l.from === "left"
          ? { x: p.x1 + (l.key === "x1" ? 13 : -13), y: Y(ref.y1 + (ref.y2 - ref.y1) * 0.28) }
          : { x: X(ref.x1 + (ref.x2 - ref.x1) * 0.22), y: p.y1 + (l.key === "y1" ? 10 : -10) };
        return (
          <g key={l.key}>
            <motion.line
              {...p}
              stroke={on ? BLUE : GREY}
              strokeWidth={on ? 2.2 : 1}
              animate={on && !reduce ? { strokeOpacity: [1, 0.35, 1] } : { strokeOpacity: 1 }}
              transition={on && !reduce ? { duration: 1.6, repeat: Infinity } : undefined}
            />
            <Badge x={badge.x} y={badge.y} label={l.label} on={on} />
          </g>
        );
      })}

      {/* The ruler: 0 on the edge, a tick every 1/10 inch, longer every inch */}
      {target && (
        <motion.g {...rulerMotion}>
          {fromLeft ? (
            <g>
              <rect x={PAD} y={cross - 8} width={len} height="16" rx="1.5" fill="#fef9c3" stroke="#a16207" strokeWidth="0.6" />
              {Array.from({ length: Math.floor(len / 2) + 1 }, (_, i) => (
                <line key={i} x1={PAD + i * 2} x2={PAD + i * 2} y1={cross - 8} y2={cross - 8 + (i % 10 === 0 ? 6 : 3)} stroke="#713f12" strokeWidth="0.4" />
              ))}
              <text x={PAD + 1.5} y={cross + 5} fontSize="6" fontWeight="700" fill="#713f12" className="font-mono">0</text>
            </g>
          ) : (
            <g>
              <rect x={cross - 8} y={PAD} width="16" height={len} rx="1.5" fill="#fef9c3" stroke="#a16207" strokeWidth="0.6" />
              {Array.from({ length: Math.floor(len / 2) + 1 }, (_, i) => (
                <line key={i} y1={PAD + i * 2} y2={PAD + i * 2} x1={cross - 8} x2={cross - 8 + (i % 10 === 0 ? 6 : 3)} stroke="#713f12" strokeWidth="0.4" />
              ))}
              <text x={cross + 1} y={PAD + 7} fontSize="6" fontWeight="700" fill="#713f12" className="font-mono">0</text>
            </g>
          )}
        </motion.g>
      )}

      {/* Where the line meets the ruler, and what the ruler should say there */}
      {target && reading && (
        <motion.g {...readingMotion} style={{ transformOrigin: fromLeft ? `${targetPos}px ${cross}px` : `${cross}px ${targetPos}px` }}>
          {fromLeft ? (
            <>
              <circle cx={targetPos} cy={cross - 8} r="3" fill={BLUE} />
              {/* Beside the line, on whichever side has room (line B is near the right edge). */}
              <rect x={bubbleX} y={cross - 34} width={bubbleW} height="17" rx="4" fill={BLUE} />
              <text x={bubbleX + bubbleW / 2} y={cross - 22.5} textAnchor="middle" fontSize="8" fontWeight="700" fill="#fff" className="font-sans">{readingLabel}</text>
            </>
          ) : (
            <>
              <circle cx={cross + 8} cy={targetPos} r="3" fill={BLUE} />
              <rect x={cross + 14} y={targetPos - 8.5} width={bubbleW} height="17" rx="4" fill={BLUE} />
              <text x={cross + 14 + bubbleW / 2} y={targetPos + 3} textAnchor="middle" fontSize="8" fontWeight="700" fill="#fff" className="font-sans">{readingLabel}</text>
            </>
          )}
        </motion.g>
      )}
    </svg>
  );
}

// The printer putting out the sheet three times; people write 1, 2 and 3 on the copies.
export function PrinterScene({ loop = false, className }: { loop?: boolean; className?: string }) {
  const reduce = useReducedMotion();
  return (
    <svg viewBox="0 0 240 205" className={cn("h-auto w-full", className)} role="img" aria-label="The printer prints the calibration sheet three times">
      {[0, 1, 2].map((i) => {
        const end = { x: i * 9, y: 72 + i * 7 };
        return (
          <motion.g
            key={i}
            initial={reduce ? false : { x: 0, y: 0 }}
            animate={reduce ? end : loop ? { x: [0, end.x, end.x, end.x], y: [0, end.y, end.y, 0] } : end}
            transition={reduce ? undefined : loop
              ? { duration: 6, times: [0, 0.18 + i * 0.12, 0.9, 1], delay: 0.3 + i * 0.9, repeat: Infinity, repeatDelay: 0, ease: "easeOut" }
              : { duration: 0.8, delay: 0.4 + i * 0.9, ease: [0.16, 1, 0.3, 1] }}
          >
            <rect x="78" y="18" width="70" height="90" rx="2" fill="#fff" stroke={EDGE} />
            <rect x="83" y="24" width="34" height="9" rx="2" fill={INK} />
            <text x="100" y="30.5" textAnchor="middle" fontSize="5.5" fontWeight="700" fill="#fff" className="font-sans">SHEET {i + 1}</text>
            <text x="113" y="85" textAnchor="middle" fontSize="38" fontWeight="800" fill="#ececee" className="font-sans">{i + 1}</text>
            <line x1="85" x2="85" y1="40" y2="100" stroke={GREY} strokeWidth="0.6" />
            <line x1="141" x2="141" y1="40" y2="100" stroke={GREY} strokeWidth="0.6" />
            <line x1="90" x2="136" y1="36" y2="36" stroke={GREY} strokeWidth="0.6" />
          </motion.g>
        );
      })}
      {/* The printer is drawn last, so sheets are hidden until they come out of the slot. */}
      <rect x="40" y="6" width="160" height="74" rx="10" fill="#27272a" />
      <rect x="58" y="70" width="124" height="4" rx="2" fill="#52525b" />
      <rect x="54" y="18" width="62" height="12" rx="3" fill="#3f3f46" />
      <motion.circle cx="182" cy="24" r="3.5" fill="#22c55e" animate={reduce ? undefined : { opacity: [1, 0.25, 1] }} transition={{ duration: 0.9, repeat: Infinity }} />
    </svg>
  );
}

// The check where the printer would put it (dashed), sliding to where it belongs once the
// shift is corrected. The shift is drawn larger than life so it can be seen.
export function ShiftScene({ rightMm, downMm, className }: { rightMm: number; downMm: number; className?: string }) {
  const reduce = useReducedMotion();
  const k = 7; // drawing units per mm: exaggerated
  const dx = Math.max(-22, Math.min(22, rightMm * k));
  const dy = Math.max(-16, Math.min(16, downMm * k));
  return (
    <svg viewBox="0 0 240 140" className={cn("h-auto w-full", className)} role="img" aria-label="The check moves back to where it belongs on the paper">
      <rect x="20" y="10" width="200" height="120" rx="3" fill="#fff" stroke={EDGE} />
      <rect x="40" y="35" width="160" height="70" rx="2" fill="none" stroke={GREY} strokeDasharray="3 2" transform={`translate(${dx} ${dy})`} />
      <motion.g initial={reduce ? false : { x: dx, y: dy }} animate={{ x: 0, y: 0 }} transition={{ type: "spring", stiffness: 90, damping: 14, delay: 0.8 }}>
        <rect x="40" y="35" width="160" height="70" rx="2" fill="#eff6ff" stroke={BLUE} strokeWidth="1.2" />
        <rect x="48" y="44" width="50" height="4" rx="1" fill="#93c5fd" />
        <rect x="160" y="54" width="32" height="10" rx="1" fill="none" stroke="#60a5fa" />
        <rect x="48" y="94" width="110" height="4" rx="1" fill="#1e3a8a" opacity="0.7" />
      </motion.g>
      <motion.g initial={reduce ? false : { opacity: 0, scale: 0.5 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 1.6, type: "spring", stiffness: 260, damping: 16 }} style={{ transformOrigin: "200px 30px" }}>
        <circle cx="200" cy="30" r="11" fill="#16a34a" />
        <path d="M194.5 30.5 l4 4 l7 -8" fill="none" stroke="#fff" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
      </motion.g>
    </svg>
  );
}
