import type { PaperSize } from "@/api/types";
import { fromMm, parseReading, toMm, type Unit } from "@/lib/ruler";

// Printer setup facts shared by the setup screens, the pictures and the demo.

export type LineKey = "x1" | "x2" | "y1" | "y2";

// The sheet's four lines, as printed on it: X lines measured from the LEFT edge, Y lines
// from the TOP edge.
export const CALIBRATION_LINES: Array<{ key: LineKey; label: "X1" | "X2" | "Y1" | "Y2"; from: "left" | "top" }> = [
  { key: "x1", label: "X1", from: "left" },
  { key: "x2", label: "X2", from: "left" },
  { key: "y1", label: "Y1", from: "top" },
  { key: "y2", label: "Y2", from: "top" },
];
export const lineOf = (key: LineKey) => CALIBRATION_LINES.find((l) => l.key === key)!;

// Where the sheet's lines are, in inches (CALIBRATION_REF v2 on the server).
export const CALIBRATION_REF: Record<PaperSize, Record<LineKey, number>> = {
  LETTER: { x1: 1.0, x2: 7.5, y1: 1.0, y2: 10.0 },
  A4: { x1: 1.0, x2: 7.25, y1: 1.0, y2: 10.5 },
};
export const PAPER_IN: Record<PaperSize, { w: number; h: number }> = { LETTER: { w: 8.5, h: 11 }, A4: { w: 8.27, h: 11.69 } };

// The demo's scenes, in order, and how long each plays.
export const DEMO_SCENE_MS = [5000, 4000, 5500, 3800, 5500, 3800, 5500, 3800, 5500, 3800, 4000, 5000, 5000];
export const DEMO_SECONDS = Math.round(DEMO_SCENE_MS.reduce((a, b) => a + b, 0) / 1000);

// A reading rewritten in the other unit, so switching units never changes what was measured.
export function convertReading(text: string, from: Unit, to: Unit): string {
  const v = parseReading(text, from);
  if (v === null || from === to) return text;
  const converted = fromMm(toMm(v, from), to);
  return to === "mm" ? converted.toFixed(1) : String(Number(converted.toFixed(3)));
}
