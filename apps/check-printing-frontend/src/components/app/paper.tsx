import type { CheckLayout, PaperSize } from "@/api/types";
import { cn } from "@/lib/utils";

export const LAYOUTS: Array<{ value: CheckLayout; label: string; description: string }> = [
  { value: "CHECK_TOP", label: "Check on top", description: "Check first, two stubs below" },
  { value: "CHECK_MIDDLE", label: "Check in middle", description: "Stub, check, stub. Most common" },
  { value: "CHECK_BOTTOM", label: "Check on bottom", description: "Two stubs above the check" },
  { value: "THREE_PER_PAGE", label: "Three per page", description: "Three checks, no stubs" },
];

export const layoutLabel = (l: CheckLayout) => LAYOUTS.find((x) => x.value === l)?.label ?? l;
export const paperLabel = (p: PaperSize) => (p === "LETTER" ? 'Letter · 8.5 × 11"' : "A4 · 210 × 297 mm");

// A sheet of paper drawn to scale (Letter 8.5 × 11 in, A4 210 × 297 mm) with the check
// band (3.5 in) where the layout puts it. `slot` highlights one band on three-per-page.
export function PaperDiagram({ layout, paper = "LETTER", slot, className }: { layout: CheckLayout; paper?: PaperSize; slot?: number; className?: string }) {
  const W = 60;
  const H = paper === "LETTER" ? (W * 11) / 8.5 : (W * 297) / 210;
  const band = (W * 3.5) / (paper === "LETTER" ? 8.5 : 8.27);
  const checks: number[] =
    layout === "CHECK_TOP" ? [0] : layout === "CHECK_MIDDLE" ? [band] : layout === "CHECK_BOTTOM" ? [H - band] : [0, band, band * 2];
  const lines = layout === "CHECK_BOTTOM" ? [(H - band) / 2, H - band] : layout === "THREE_PER_PAGE" ? [band, band * 2, band * 3] : [band, band * 2];

  return (
    <svg viewBox={`-2 -2 ${W + 4} ${H + 4}`} className={cn("h-auto w-full", className)} aria-hidden="true">
      <rect x="0" y="0" width={W} height={H} rx="1.5" fill="#fff" stroke="#d6d6db" strokeWidth="0.6" />
      {checks.map((y, i) => {
        const active = layout !== "THREE_PER_PAGE" || slot === undefined || slot === i + 1;
        return (
          <g key={i}>
            <rect x="2.5" y={y + 2} width={W - 5} height={band - 4} rx="1" fill={active ? "#eff6ff" : "#f4f4f5"} stroke={active ? "#2563eb" : "#d6d6db"} strokeWidth="0.5" />
            <rect x="5" y={y + band - 7} width={W * 0.55} height="1.6" rx="0.6" fill={active ? "#1e3a8a" : "#a1a1aa"} opacity="0.7" />
            <rect x={W - 18} y={y + 6} width="13" height="3.4" rx="0.6" fill="none" stroke={active ? "#1e3a8a" : "#a1a1aa"} strokeWidth="0.45" />
            <rect x="5" y={y + 6} width="16" height="1.4" rx="0.6" fill={active ? "#1e3a8a" : "#a1a1aa"} opacity="0.5" />
            {layout === "THREE_PER_PAGE" && slot !== undefined && (
              <text x={W / 2} y={y + band / 2 + 2} textAnchor="middle" fontSize="5" fontWeight="600" fill={active ? "#1d4ed8" : "#a1a1aa"} className="font-mono">
                {i + 1}
              </text>
            )}
          </g>
        );
      })}
      {lines.filter((y) => y < H - 0.5).map((y) => (
        <line key={y} x1="0" x2={W} y1={y} y2={y} stroke="#a1a1aa" strokeWidth="0.4" strokeDasharray="1.2 1" />
      ))}
      {layout !== "THREE_PER_PAGE" &&
        Array.from({ length: 3 }, (_, i) => {
          const stubTop = checks[0] === 0 ? band : 0;
          return <rect key={i} x="5" y={stubTop + 6 + i * 4} width={W * (0.6 - i * 0.12)} height="1.2" rx="0.5" fill="#d6d6db" />;
        })}
    </svg>
  );
}

// The calibration sheet: X measured from the left edge, Y from the top edge.
export function CalibrationDiagram({ highlight }: { highlight?: "x1" | "x2" | "y1" | "y2" | null }) {
  const on = (k: string) => highlight === k;
  const c = (k: string) => (on(k) ? "#2563eb" : "#a1a1aa");
  return (
    <svg viewBox="0 0 170 210" className="h-auto w-full" role="img" aria-label="Calibration sheet. X1 and X2 are vertical lines measured from the left edge of the paper. Y1 and Y2 are horizontal lines measured from the top edge.">
      <defs>
        <marker id="arw" viewBox="0 0 6 6" refX="5" refY="3" markerWidth="5" markerHeight="5" orient="auto-start-reverse">
          <path d="M0,0 L6,3 L0,6 z" fill="context-stroke" />
        </marker>
      </defs>
      <rect x="20" y="10" width="130" height="190" rx="2" fill="#fff" stroke="#d6d6db" />
      <text x="85" y="7" textAnchor="middle" fontSize="6" fill="#71717a" className="font-mono">TOP EDGE · fed into printer first</text>
      <line x1="38" x2="38" y1="30" y2="182" stroke={c("x1")} strokeWidth={on("x1") ? 1.6 : 0.8} />
      <line x1="132" x2="132" y1="30" y2="182" stroke={c("x2")} strokeWidth={on("x2") ? 1.6 : 0.8} />
      <line x1="44" x2="126" y1="28" y2="28" stroke={c("y1")} strokeWidth={on("y1") ? 1.6 : 0.8} />
      <line x1="44" x2="126" y1="184" y2="184" stroke={c("y2")} strokeWidth={on("y2") ? 1.6 : 0.8} />
      <line x1="20" x2="38" y1="60" y2="60" stroke={c("x1")} strokeWidth="0.7" markerStart="url(#arw)" markerEnd="url(#arw)" />
      <text x="29" y="56" textAnchor="middle" fontSize="7" fontWeight="700" fill={c("x1")} className="font-mono">X1</text>
      <line x1="20" x2="132" y1="100" y2="100" stroke={c("x2")} strokeWidth="0.7" markerStart="url(#arw)" markerEnd="url(#arw)" />
      <text x="80" y="96" textAnchor="middle" fontSize="7" fontWeight="700" fill={c("x2")} className="font-mono">X2</text>
      <line x1="60" x2="60" y1="10" y2="28" stroke={c("y1")} strokeWidth="0.7" markerStart="url(#arw)" markerEnd="url(#arw)" />
      <text x="64" y="22" fontSize="7" fontWeight="700" fill={c("y1")} className="font-mono">Y1</text>
      <line x1="105" x2="105" y1="10" y2="184" stroke={c("y2")} strokeWidth="0.7" markerStart="url(#arw)" markerEnd="url(#arw)" />
      <text x="109" y="150" fontSize="7" fontWeight="700" fill={c("y2")} className="font-mono">Y2</text>
      <text x="10" y="105" fontSize="6" fill="#71717a" transform="rotate(-90 10 105)" textAnchor="middle" className="font-mono">LEFT EDGE</text>
    </svg>
  );
}

export type Landmark = "upperTearLine" | "lowerTearLine" | "micrBottom" | "micrRightEdge" | "amountBoxLeft";

// The verification sample: five distances on the printed VOID check.
export function VerificationDiagram({ layout, highlight }: { layout: CheckLayout; highlight?: Landmark | null }) {
  const on = (k: Landmark) => highlight === k;
  const c = (k: Landmark) => (on(k) ? "#2563eb" : "#a1a1aa");
  const bottom = layout === "CHECK_BOTTOM";
  // Check band position on a 170 × 220 sheet.
  const top = layout === "CHECK_TOP" || layout === "THREE_PER_PAGE" ? 12 : bottom ? 220 - 70 : 12 + 70;
  const checkBottom = top + 70;
  const upper = bottom ? 12 + 69 : 12 + 70;
  const lower = bottom ? top : 12 + 140;
  return (
    <svg viewBox="0 0 200 232" className="h-auto w-full" role="img" aria-label="Verification sample with the five distances to measure">
      <defs>
        <marker id="arv" viewBox="0 0 6 6" refX="5" refY="3" markerWidth="5" markerHeight="5" orient="auto-start-reverse">
          <path d="M0,0 L6,3 L0,6 z" fill="context-stroke" />
        </marker>
      </defs>
      <rect x="15" y="12" width="170" height="208" rx="2" fill="#fff" stroke="#d6d6db" />
      <rect x="19" y={top + 3} width="162" height="64" rx="1.5" fill="#f8fafc" stroke="#e4e4e7" />
      <text x="100" y={top + 38} textAnchor="middle" fontSize="16" fontWeight="800" fill="#dc2626" opacity="0.15" className="font-sans">VOID</text>
      <line x1="15" x2="185" y1={upper} y2={upper} stroke={c("upperTearLine")} strokeWidth={on("upperTearLine") ? 1.4 : 0.6} strokeDasharray="3 2" />
      <line x1="15" x2="185" y1={lower} y2={lower} stroke={c("lowerTearLine")} strokeWidth={on("lowerTearLine") ? 1.4 : 0.6} strokeDasharray="3 2" />
      {/* amount box */}
      <rect x="148" y={top + 22} width="30" height="8" fill="none" stroke={c("amountBoxLeft")} strokeWidth={on("amountBoxLeft") ? 1.2 : 0.6} />
      {/* MICR line */}
      <rect x="70" y={checkBottom - 10} width="100" height="4" rx="0.5" fill={on("micrBottom") || on("micrRightEdge") ? "#2563eb" : "#52525b"} opacity="0.8" />
      {/* arrows */}
      <line x1="35" x2="35" y1="12" y2={upper} stroke={c("upperTearLine")} strokeWidth="0.7" markerStart="url(#arv)" markerEnd="url(#arv)" />
      <text x="38" y={(12 + upper) / 2 + 2} fontSize="6.5" fontWeight="700" fill={c("upperTearLine")} className="font-mono">1</text>
      <line x1="50" x2="50" y1="12" y2={lower} stroke={c("lowerTearLine")} strokeWidth="0.7" markerStart="url(#arv)" markerEnd="url(#arv)" />
      <text x="53" y={(12 + lower) / 2 + 12} fontSize="6.5" fontWeight="700" fill={c("lowerTearLine")} className="font-mono">2</text>
      <line x1="120" x2="120" y1={checkBottom - 6} y2={checkBottom} stroke={c("micrBottom")} strokeWidth="0.7" markerStart="url(#arv)" markerEnd="url(#arv)" />
      <text x="123" y={checkBottom + 6} fontSize="6.5" fontWeight="700" fill={c("micrBottom")} className="font-mono">3</text>
      <line x1="170" x2="185" y1={checkBottom - 13} y2={checkBottom - 13} stroke={c("micrRightEdge")} strokeWidth="0.7" markerStart="url(#arv)" markerEnd="url(#arv)" />
      <text x="174" y={checkBottom - 16} fontSize="6.5" fontWeight="700" fill={c("micrRightEdge")} className="font-mono">4</text>
      <line x1="15" x2="148" y1={top + 34} y2={top + 34} stroke={c("amountBoxLeft")} strokeWidth="0.7" markerStart="url(#arv)" markerEnd="url(#arv)" />
      <text x="90" y={top + 32} fontSize="6.5" fontWeight="700" fill={c("amountBoxLeft")} className="font-mono">5</text>
    </svg>
  );
}
