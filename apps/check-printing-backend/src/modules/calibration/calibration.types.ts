import type { PaperSize, StockType, CheckLayout } from "../pdf/pdf.types.js";
import type { CalibrationMeasurements } from "./calibration.math.js";
import type { VerificationOutcome } from "./calibration.verification.js";

export interface CalibrationProfileResponse {
  id: string;
  profileName: string;
  paperSize: PaperSize;
  stockType: StockType;
  layout: CheckLayout;
  tray: string | null;
  horizontalOffsetPts: string;
  verticalOffsetPts: string;
  scaleX: string | null;
  scaleY: string | null;
  measurements: CalibrationMeasurements | null;
  // How much the calibration sheets differed from each other; null for profiles
  // measured from a single sheet, before repeatability was checked.
  repeatability: { sheets: number; spreadXMm: number; spreadYMm: number } | null;
  verification: {
    verified: boolean;
    verifiedAt: string | null;
    verifiedById: string | null;
    lastResult: VerificationOutcome | null;
  };
  refVersion: number;
  // Profiles measured with an older calibration sheet still print, but should be re-measured.
  needsRecalibration: boolean;
  calibratedById: string | null;
  calibratedAt: string;
  isDefault: boolean;
  // Three-per-page paper: the slot the next check goes into (always 1 for other layouts)
  nextSlot: 1 | 2 | 3;
  createdAt: string;
  updatedAt: string;
}

export interface CalibrationMutationResponse extends CalibrationProfileResponse {
  warnings: string[];
}

export interface VerificationResponse extends VerificationOutcome {
  profile: CalibrationProfileResponse;
}

export interface CalibrationListResponse {
  items: CalibrationProfileResponse[];
  meta: { total: number };
}

export interface PrintCalibration {
  profileId: string;
  profileName: string;
  paperSize: PaperSize;
  stockType: StockType;
  layout: CheckLayout;
  horizontalOffsetPts: number;
  verticalOffsetPts: number;
  nextSlot: 1 | 2 | 3;
}
