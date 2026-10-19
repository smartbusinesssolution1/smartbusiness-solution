import { z } from "zod";
import { CALIBRATION_LIMITS } from "../pdf/pdf.types.js";

const paperSizeSchema = z.enum(["LETTER", "A4"]);
const stockTypeSchema = z.enum(["PLAIN_PAPER", "PERFORATED_STOCK"]);
// Where the check sits on the paper in this printer's tray.
const layoutSchema = z.enum(["CHECK_TOP", "CHECK_MIDDLE", "CHECK_BOTTOM", "THREE_PER_PAGE"]);
const unitSchema = z.enum(["mm", "in"]);
const positive = z.number().positive("Measurement must be positive");

const sheetSchema = z.object({ x1: positive, x2: positive, y1: positive, y2: positive });

// The same calibration sheet printed several times: comparing the sheets shows
// whether the printer lands in the same place every time.
const measurementsSchema = z.object({
  unit: unitSchema,
  sheets: z
    .array(sheetSchema)
    .min(CALIBRATION_LIMITS.minSheets, `Print the calibration sheet ${CALIBRATION_LIMITS.minSheets} times and enter all of them`)
    .max(CALIBRATION_LIMITS.maxSheets),
});

export const createCalibrationSchema = z.object({
  profileName: z
    .string()
    .min(1, "Profile name is required")
    .max(100, "Profile name cannot exceed 100 characters")
    .trim(),
  paperSize: paperSizeSchema,
  stockType: stockTypeSchema.default("PLAIN_PAPER"),
  layout: layoutSchema.default("CHECK_MIDDLE"),
  tray: z.string().trim().max(50).optional(),
  measurements: measurementsSchema,
});

// A copy of a printer profile for other check paper in the same printer: the printer's
// calibration is kept (same paper size), the layout and paper type are new.
export const copyCalibrationSchema = z.object({
  profileName: z
    .string()
    .min(1, "Profile name is required")
    .max(100, "Profile name cannot exceed 100 characters")
    .trim(),
  layout: layoutSchema,
  stockType: stockTypeSchema.optional(),
  tray: z.string().trim().max(50).nullable().optional(),
});

export type CopyCalibrationInput = z.infer<typeof copyCalibrationSchema>;

// Changing the paper size invalidates the old measurements, so it requires new ones.
export const updateCalibrationSchema = z
  .object({
    profileName: z.string().min(1).max(100).trim().optional(),
    tray: z.string().trim().max(50).nullable().optional(),
    stockType: stockTypeSchema.optional(),
    layout: layoutSchema.optional(),
    paperSize: paperSizeSchema.optional(),
    measurements: measurementsSchema.optional(),
  })
  .refine((v) => v.paperSize === undefined || v.measurements !== undefined, {
    message: "Re-measure with a calibration sheet printed on the new paper size",
    path: ["measurements"],
  });

// Distances measured on a printed verification sample check.
export const verificationSchema = z.object({
  unit: unitSchema,
  upperTearLine: positive,
  lowerTearLine: positive,
  micrBottom: positive,
  micrRightEdge: positive,
  amountBoxLeft: positive,
});

// Fine adjustment after a verification print: positive horizontal moves everything
// right, positive vertical moves everything down.
export const adjustmentSchema = z
  .object({
    unit: unitSchema,
    horizontal: z.number(),
    vertical: z.number(),
  })
  .refine((v) => v.horizontal !== 0 || v.vertical !== 0, {
    message: "Enter a horizontal or vertical adjustment",
    path: ["horizontal"],
  });

export const testPageQuerySchema = z.object({
  paperSize: paperSizeSchema.default("LETTER"),
});

export type CreateCalibrationInput = z.infer<typeof createCalibrationSchema>;
export type UpdateCalibrationInput = z.infer<typeof updateCalibrationSchema>;
export type VerificationInput = z.infer<typeof verificationSchema>;
export type AdjustmentInput = z.infer<typeof adjustmentSchema>;
export type TestPageQuery = z.infer<typeof testPageQuerySchema>;
