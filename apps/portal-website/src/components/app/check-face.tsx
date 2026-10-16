import { useId } from "react";
import { AnimatePresence, motion } from "motion/react";
import { cn } from "@/lib/utils";

// The face of the check, drawn on the PDF's own grid: 612 × 252 points (8.5 × 3.5 in),
// with each field where pdf.templates.ts puts it. It is a preview; the PDF generated at
// print time is what goes to the bank. Account and routing numbers are masked: the app
// never receives them in full.

export type CheckField = "payee" | "amount" | "date" | "memo" | "bank";

export interface CheckFaceProps {
  companyName: string;
  addressLine?: string;
  cityLine?: string;
  bankName?: string;
  checkNumber?: string;
  date?: string;
  payeeName?: string;
  amount?: string;
  amountInWords?: string | null;
  memo?: string | null;
  signatureUrl?: string | null;
  routingLast4?: string;
  accountLast4?: string;
  watermark?: "VOID" | "SAMPLE" | null;
  focus?: CheckField | null;
  className?: string;
}

const RIGHT = 576; // page width 612 − 36 pt side margin
const W = 612;
const H = 252;

// PDFKit places text by its top edge; SVG by its baseline.
const base = (top: number, size: number) => top + size * 0.82;

export function CheckFace(p: CheckFaceProps) {
  const uid = useId().replace(/[^a-zA-Z0-9]/g, "");
  // Unknown digits are shown as dots, never as zeros that would read like a real number.
  const micr = `⑈${p.checkNumber ?? "••••••"}⑈  ⑆•••••${p.routingLast4 ?? "••••"}⑆  ••••${p.accountLast4 ?? "••••"}⑈`;
  const words = p.amountInWords ? `${p.amountInWords} ` : "";

  return (
    <div className={cn("relative w-full overflow-hidden rounded-[0.625rem] shadow-[0_1px_2px_rgb(10_10_11/0.06),0_18px_40px_-20px_rgb(10_10_11/0.35)] ring-1 ring-ink/10", p.className)}>
      <svg viewBox={`0 0 ${W} ${H}`} className="safety-paper block h-auto w-full" role="img" aria-label={`Check ${p.checkNumber ?? ""} to ${p.payeeName || "payee"} for ${p.amount ? `$${p.amount}` : "an amount"}`}>
        <defs>
          <linearGradient id={`band${uid}`} x1="0" x2="1">
            <stop offset="0" stopColor="#2563eb" stopOpacity="0.07" />
            <stop offset="1" stopColor="#2563eb" stopOpacity="0.02" />
          </linearGradient>
        </defs>

        <Highlight on={p.focus === "bank"} x={RIGHT - 280} y={12} w={150} h={18} />
        <Highlight on={p.focus === "date"} x={RIGHT - 190} y={52} w={190} h={20} />
        <Highlight on={p.focus === "payee"} x={30} y={78} w={RIGHT - 126 - 24} h={22} />
        <Highlight on={p.focus === "amount"} x={RIGHT - 112} y={76} w={118} h={26} />
        <Highlight on={p.focus === "amount"} x={30} y={106} w={RIGHT - 24} h={20} />
        <Highlight on={p.focus === "memo"} x={30} y={172} w={302} h={18} />

        <rect x="0" y="0" width={W} height="6" fill={`url(#band${uid})`} />

        {/* Drawer */}
        <text x="36" y={base(18, 11)} fontSize="11" fontWeight="650" fill="#0a0a0b" className="font-sans">{p.companyName || "Your business name"}</text>
        <text x="36" y={base(32, 7.5)} fontSize="7.5" fill="#52525b" className="font-sans">{p.addressLine}</text>
        <text x="36" y={base(41, 7.5)} fontSize="7.5" fill="#52525b" className="font-sans">{p.cityLine}</text>

        {/* Bank */}
        <text x={RIGHT - 276} y={base(18, 9)} fontSize="9" fontWeight="600" fill="#27272a" className="font-sans">{p.bankName || "Bank name"}</text>

        {/* Check number */}
        <text x={RIGHT} y={base(16, 13)} fontSize="13" fontWeight="600" textAnchor="end" fill="#0a0a0b" className="font-mono">{p.checkNumber ?? "000000"}</text>

        {/* Date */}
        <text x={RIGHT - 186} y={base(60, 7)} fontSize="7" fill="#71717a" className="font-sans" letterSpacing="0.6">DATE</text>
        <line x1={RIGHT - 160} x2={RIGHT} y1="70" y2="70" stroke="#a1a1aa" strokeWidth="0.6" />
        <Live k={p.date} x={RIGHT - 80} y={base(58, 10)} size={10} anchor="middle" mono>{p.date}</Live>

        {/* Payee */}
        <text x="36" y={base(84, 7)} fontSize="7" fill="#71717a" className="font-sans" letterSpacing="0.4">PAY TO THE</text>
        <text x="36" y={base(94, 7)} fontSize="7" fill="#71717a" className="font-sans" letterSpacing="0.4">ORDER OF</text>
        <line x1="100" x2={RIGHT - 126} y1="99" y2="99" stroke="#a1a1aa" strokeWidth="0.6" />
        <Live k={p.payeeName} x={105} y={base(84, 12)} size={12} weight={550}>{p.payeeName}</Live>

        {/* Amount box */}
        <text x={RIGHT - 110} y={base(85, 11)} fontSize="11" fill="#27272a" className="font-sans">$</text>
        <rect x={RIGHT - 96} y="78" width="96" height="21" rx="2" fill="#fff" fillOpacity="0.7" stroke="#52525b" strokeWidth="0.7" />
        <Live k={p.amount} x={RIGHT - 6} y={base(83, 11)} size={11} anchor="end" weight={600} mono>{p.amount ? `**${p.amount}` : ""}</Live>

        {/* Amount in words, filled to the line with stars as the PDF does */}
        <line x1="36" x2={RIGHT - 46} y1="124" y2="124" stroke="#a1a1aa" strokeWidth="0.6" />
        <Live k={words} x={36} y={base(112, 9)} size={9} clipId={`words${uid}`}>{words ? `${words}${"*".repeat(60)}` : ""}</Live>
        <text x={RIGHT} y={base(113, 7)} fontSize="7" fill="#71717a" textAnchor="end" className="font-sans" letterSpacing="0.6">DOLLARS</text>
        <clipPath id={`words${uid}`}><rect x="36" y="100" width={RIGHT - 84 - 36} height="30" /></clipPath>

        {/* Memo */}
        <text x="36" y={base(179, 7)} fontSize="7" fill="#71717a" className="font-sans" letterSpacing="0.6">MEMO</text>
        <line x1="70" x2="330" y1="188" y2="188" stroke="#a1a1aa" strokeWidth="0.6" />
        <Live k={p.memo ?? ""} x={80} y={base(178, 8)} size={8}>{p.memo ?? ""}</Live>

        {/* Signature */}
        {p.signatureUrl && <image href={p.signatureUrl} x={RIGHT - 216} y="158" width="206" height="30" preserveAspectRatio="xMidYMax meet" />}
        <line x1={RIGHT - 226} x2={RIGHT} y1="190" y2="190" stroke="#52525b" strokeWidth="0.7" />
        <text x={RIGHT - 113} y={base(194, 6)} fontSize="6" fill="#71717a" textAnchor="middle" className="font-sans" letterSpacing="0.6">AUTHORIZED SIGNATURE</text>

        {/* MICR line: 3/16 in above the bottom edge, ending 5/16 in from the right */}
        <text x={W - 22.5} y={H - 13.5} fontSize="10.5" textAnchor="end" fill="#18181b" className="font-mono" letterSpacing="1.2">{micr}</text>

        {p.watermark && (
          <text x={W / 2} y={H / 2 + 22} fontSize="64" fontWeight="800" textAnchor="middle" fill="#dc2626" fillOpacity="0.14" letterSpacing="12" transform={`rotate(-12 ${W / 2} ${H / 2})`} className="font-sans">
            {p.watermark}
          </text>
        )}
      </svg>
    </div>
  );
}

function Highlight({ on, x, y, w, h }: { on: boolean; x: number; y: number; w: number; h: number }) {
  return (
    <AnimatePresence>
      {on && (
        <motion.rect
          x={x}
          y={y}
          width={w}
          height={h}
          rx="4"
          fill="#2563eb"
          initial={{ opacity: 0 }}
          animate={{ opacity: 0.08 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.18 }}
        />
      )}
    </AnimatePresence>
  );
}

// Text that settles in when its value changes, so typing visibly fills the check.
function Live({
  k,
  x,
  y,
  size,
  anchor = "start",
  weight = 450,
  mono,
  clipId,
  children,
}: {
  k: string | undefined;
  x: number;
  y: number;
  size: number;
  anchor?: "start" | "middle" | "end";
  weight?: number;
  mono?: boolean;
  clipId?: string;
  children: React.ReactNode;
}) {
  return (
    <motion.text
      key={k ? "filled" : "empty"}
      x={x}
      y={y}
      fontSize={size}
      fontWeight={weight}
      textAnchor={anchor}
      fill="#0a0a0b"
      clipPath={clipId ? `url(#${clipId})` : undefined}
      className={mono ? "font-mono" : "font-sans"}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.25 }}
    >
      {children}
    </motion.text>
  );
}
