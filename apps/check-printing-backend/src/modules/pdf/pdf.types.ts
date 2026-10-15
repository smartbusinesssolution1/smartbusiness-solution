export const PTS_PER_INCH = 72;

// E-13B geometry. The point size is derived from the installed font (see micr-font-check.ts);
// the default is only a fallback when the font has no usable "0" glyph.
export const MICR = {
  defaultFontSizePts: 10,
  pitchPts: 9,
  baselineFromBottomIn: 0.1875,
  position1RightIn: 0.3125,
  clearBandIn: 0.625,
} as const;

// Character position (counted from the right edge) where each field's rightmost character sits.
export const MICR_FIELD_END_POSITION = {
  onUs: 14,
  transit: 33,
  auxOnUs: 45,
} as const;

export const MICR_CHARS = {
  transit: "A",
  onUs: "C",
  amount: "B",
  dash: "D",
} as const;

export type PaperSize = "LETTER" | "A4";

export const PAPER: Record<PaperSize, { width: number; height: number; label: string }> = {
  LETTER: { width: 612, height: 792, label: 'US Letter (8.5" x 11")' },
  A4: { width: 595.28, height: 841.89, label: "A4 (210 x 297 mm)" },
};

// Calibration sheet v2: reference lines in inches, X measured from the LEFT paper edge and
// Y from the TOP paper edge (the two edges a printer registers each sheet against).
// Two lines per axis, far apart, so scaling can be detected.
export const CALIBRATION_REF = {
  version: 2,
  LETTER: { x1: 1.0, x2: 7.5, y1: 1.0, y2: 10.0 },
  A4: { x1: 1.0, x2: 7.25, y1: 1.0, y2: 10.5 },
} as const;

export const PTS_PER_MM = 72 / 25.4;

export const CALIBRATION_LIMITS = {
  maxScaleError: 0.01,
  warnOffsetPts: 18,
  maxOffsetPts: 36,
  // Repeatability: the same sheet printed several times must land in the same place.
  // Calibration corrects the average; half the spread remains as random error, and
  // with ruler error on top it must stay inside the bank's ±1/16" (±1.59 mm).
  minSheets: 3,
  maxSheets: 5,
  warnSpreadPts: 1 * PTS_PER_MM,
  maxSpreadPts: 2 * PTS_PER_MM,
  // Verification of a printed sample check.
  verifyGoodPts: 1 * PTS_PER_MM,
  verifyMaxPts: 4.5, // 1/16", the bank's MICR position tolerance
  adjustThresholdPts: 0.5 * PTS_PER_MM,
  scaleCheckPts: 1.5 * PTS_PER_MM,
} as const;

export type StockType = "PLAIN_PAPER" | "PERFORATED_STOCK";

/** Printed on the lower stub of a verification sample check instead of the employer copy. */
export interface VerificationPanel {
  profileName: string;
  paperLabel: string;
  rows: Array<{ label: string; from: string; expectedPts: number }>;
}

export interface CheckAreaLayout {
  top: number;
  height: number;
}

export interface StubAreaLayout {
  top: number;
  height: number;
}

export interface CheckElementPosition {
  x: number;
  y: number;
  width?: number;
  fontSize?: number;
  align?: "left" | "center" | "right";
}

export type CheckLayout = "check-top" | "check-middle" | "check-bottom";

export interface CheckTemplate {
  name: string;
  paperSize: PaperSize;
  pageWidth: number;
  pageHeight: number;
  sideMargin: number;
  // Dashed tear lines are printed only on plain paper; perforated stock already has them.
  tearGuides: boolean;
  layout: CheckLayout;
  checkArea: CheckAreaLayout;
  stub1: StubAreaLayout;
  stub2: StubAreaLayout;
  elements: {
    companyName: CheckElementPosition;
    companyAddress: CheckElementPosition;
    checkNumber: CheckElementPosition;
    date: CheckElementPosition;
    payToLabel: CheckElementPosition;
    payeeName: CheckElementPosition;
    amountBox: CheckElementPosition;
    amountInWords: CheckElementPosition;
    bankName: CheckElementPosition;
    memoLabel: CheckElementPosition;
    memo: CheckElementPosition;
    signatureLine: CheckElementPosition;
    signature: CheckElementPosition & { width: number; height: number };
    micr: CheckElementPosition;
  };
}

export interface CheckPdfData {
  checkNumber: string;
  payeeName: string;
  amount: string;
  amountInWords: string;
  checkDate: string;
  memo: string | null;
  routingNumber: string;
  accountNumber: string;
  bankName: string;
  checkNumberPadding: number;
  companyName: string;
  companyAddress: string;
  companyCityStateZip: string;
  horizontalOffsetPts: number;
  verticalOffsetPts: number;
  // The cleaned signature PNG (already decrypted), or null for a blank signature line
  signatureImage: Buffer | null;
  template: CheckTemplate;
  invoiceItems: Array<{ description: string; amount: string }> | null;
  // Set only for a calibration sample: watermarks the check and replaces the lower stub.
  verification?: VerificationPanel;
}
