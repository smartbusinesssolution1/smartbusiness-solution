// Ruler readings as people type them, in millimetres or inches.

export type Unit = "mm" | "in";

export const MM_PER_IN = 25.4;

// "25.4" and "25,4" in either unit; in inches also the fractions US rulers are marked in:
// "1 1/16", "1-1/16", "15/16". null when it isn't a reading.
export function parseReading(text: string, unit: Unit): number | null {
  const t = text.trim().replace(",", ".");
  if (/^(\d+\.?\d*|\.\d+)$/.test(t)) {
    const n = Number(t);
    return n > 0 ? n : null;
  }
  if (unit === "in") {
    const m = /^(?:(\d+)[\s-]+)?(\d+)\/(\d+)$/.exec(t);
    if (m) {
      const den = Number(m[3]);
      const value = Number(m[1] ?? 0) + Number(m[2]) / den;
      return den > 0 && value > 0 ? value : null;
    }
  }
  return null;
}

export const toMm = (value: number, unit: Unit) => (unit === "mm" ? value : value * MM_PER_IN);
export const fromMm = (mm: number, unit: Unit) => (unit === "mm" ? mm : mm / MM_PER_IN);
