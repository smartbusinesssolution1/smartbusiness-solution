import { NotFoundError, ValidationError } from "../../shared/errors/index.js";
import { CALIBRATION_LIMITS, CALIBRATION_REF, PAPER, PTS_PER_INCH, PTS_PER_MM } from "../pdf/pdf.types.js";
import type { CheckPdfData, PaperSize, StockType } from "../pdf/pdf.types.js";
import type { PdfService } from "../pdf/pdf.service.js";
import { templateForPrinter } from "../pdf/pdf.templates.js";
import { computeCalibration, normalizeStoredMeasurements } from "./calibration.math.js";
import { evaluateVerification, verificationExpectations } from "./calibration.verification.js";
import type { VerificationOutcome } from "./calibration.verification.js";
import type { CalibrationRepository } from "./calibration.repository.js";
import type { AuditService } from "../../shared/services/audit.service.js";
import type {
  CalibrationListResponse,
  CalibrationMutationResponse,
  CalibrationProfileResponse,
  PrintCalibration,
  VerificationResponse,
} from "./calibration.types.js";
import type {
  AdjustmentInput,
  CreateCalibrationInput,
  UpdateCalibrationInput,
  VerificationInput,
} from "./calibration.schemas.js";

interface AuditContext {
  userId: string;
  tenantId: string;
  ipAddress?: string;
}

type ProfileRow = NonNullable<Awaited<ReturnType<CalibrationRepository["findById"]>>>;

const toMm = (pts: number) => Math.round((pts / PTS_PER_MM) * 100) / 100;

export class CalibrationService {
  constructor(
    private readonly repo: CalibrationRepository,
    private readonly auditService: AuditService,
    private readonly pdfService: PdfService,
  ) {}

  async createProfile(
    workspaceId: string,
    input: CreateCalibrationInput,
    ctx: AuditContext,
  ): Promise<CalibrationMutationResponse> {
    const result = computeCalibration(input.paperSize, input.measurements);

    const profile = await this.repo.create({
      workspaceId,
      profileName: input.profileName,
      stockType: input.stockType,
      tray: input.tray,
      paperSize: input.paperSize,
      horizontalOffsetPts: result.horizontalOffsetPts,
      verticalOffsetPts: result.verticalOffsetPts,
      scaleX: result.scaleX,
      scaleY: result.scaleY,
      measurements: input.measurements,
      repeatability: result.repeatability,
      refVersion: CALIBRATION_REF.version,
      calibratedById: ctx.userId,
    });

    await this.auditService.log({
      tenantId: ctx.tenantId,
      userId: ctx.userId,
      workspaceId,
      action: "CALIBRATION_CREATED",
      entityType: "CalibrationProfile",
      entityId: profile.id,
      details: {
        profileName: input.profileName,
        paperSize: input.paperSize,
        stockType: input.stockType,
        tray: input.tray ?? null,
        measurements: input.measurements,
        refVersion: CALIBRATION_REF.version,
        ...result,
        isDefault: profile.isDefault,
      },
      ipAddress: ctx.ipAddress,
    });

    return { ...this.formatProfile(profile), warnings: result.warnings };
  }

  async listProfiles(workspaceId: string): Promise<CalibrationListResponse> {
    const { items, total } = await this.repo.list(workspaceId);
    return {
      items: items.map((p) => this.formatProfile(p)),
      meta: { total },
    };
  }

  async getProfile(
    profileId: string,
    workspaceId: string,
  ): Promise<CalibrationProfileResponse> {
    return this.formatProfile(await this.findOrThrow(profileId, workspaceId));
  }

  async updateProfile(
    profileId: string,
    workspaceId: string,
    input: UpdateCalibrationInput,
    ctx: AuditContext,
  ): Promise<CalibrationMutationResponse> {
    const existing = await this.findOrThrow(profileId, workspaceId);
    let warnings: string[] = [];
    const auditDetails: Record<string, unknown> = {};

    if (input.profileName !== undefined || input.tray !== undefined || input.stockType !== undefined) {
      await this.repo.updateDetails(profileId, workspaceId, {
        profileName: input.profileName,
        tray: input.tray,
        stockType: input.stockType,
      });
      Object.assign(auditDetails, { profileName: input.profileName, tray: input.tray, stockType: input.stockType });
    }

    if (input.measurements) {
      const paperSize = input.paperSize ?? (existing.paperSize as PaperSize);
      const result = computeCalibration(paperSize, input.measurements);
      await this.repo.recalibrate(profileId, workspaceId, {
        paperSize,
        horizontalOffsetPts: result.horizontalOffsetPts,
        verticalOffsetPts: result.verticalOffsetPts,
        scaleX: result.scaleX,
        scaleY: result.scaleY,
        measurements: input.measurements,
        repeatability: result.repeatability,
        refVersion: CALIBRATION_REF.version,
        calibratedById: ctx.userId,
      });
      warnings = result.warnings;
      Object.assign(auditDetails, {
        paperSize,
        measurements: input.measurements,
        refVersion: CALIBRATION_REF.version,
        previous: {
          paperSize: existing.paperSize,
          horizontalOffsetPts: existing.horizontalOffsetPts.toString(),
          verticalOffsetPts: existing.verticalOffsetPts.toString(),
          refVersion: existing.refVersion,
        },
        ...result,
      });
    }

    const updated = await this.findOrThrow(profileId, workspaceId);

    await this.auditService.log({
      tenantId: ctx.tenantId,
      userId: ctx.userId,
      workspaceId,
      action: input.measurements ? "CALIBRATION_RECALIBRATED" : "CALIBRATION_UPDATED",
      entityType: "CalibrationProfile",
      entityId: profileId,
      details: auditDetails,
      ipAddress: ctx.ipAddress,
    });

    return { ...this.formatProfile(updated), warnings };
  }

  /**
   * A VOID sample check rendered by the real check renderer with this profile's
   * offsets, paper and stock. Its lower stub lists the distances to measure.
   * It carries no real bank data: the MICR line is all zeros.
   */
  async renderVerificationSample(profileId: string, workspaceId: string): Promise<Buffer> {
    const profile = await this.findOrThrow(profileId, workspaceId);
    const workspace = await this.repo.findWorkspaceForSample(workspaceId);
    const template = templateForPrinter(this.printerOf(profile));
    const paperSize = profile.paperSize as PaperSize;

    const today = new Date();
    const date = [today.getUTCMonth() + 1, today.getUTCDate()].map((n) => String(n).padStart(2, "0")).join("/") + `/${today.getUTCFullYear()}`;

    const data: CheckPdfData = {
      checkNumber: "000000",
      payeeName: "SAMPLE ONLY - NOT NEGOTIABLE",
      amount: "0.00",
      amountInWords: "Zero and 00/100",
      checkDate: date,
      memo: "Printer calibration sample",
      routingNumber: "000000000",
      accountNumber: "0000000000",
      bankName: "SAMPLE BANK",
      checkNumberPadding: 6,
      companyName: workspace?.businessName ?? "Sample Company",
      companyAddress: workspace
        ? workspace.addressLine1 + (workspace.addressLine2 ? `, ${workspace.addressLine2}` : "")
        : "",
      companyCityStateZip: workspace ? `${workspace.city}, ${workspace.state} ${workspace.zipCode}` : "",
      horizontalOffsetPts: Number(profile.horizontalOffsetPts),
      verticalOffsetPts: Number(profile.verticalOffsetPts),
      signatureImage: null,
      template,
      invoiceItems: null,
      verification: {
        profileName: profile.profileName,
        paperLabel: PAPER[paperSize].label,
        rows: verificationExpectations(template).map((e) => ({ label: e.label, from: e.from, expectedPts: e.expectedPts })),
      },
    };

    return this.pdfService.renderCheck(data);
  }

  async verifyProfile(
    profileId: string,
    workspaceId: string,
    input: VerificationInput,
    ctx: AuditContext,
  ): Promise<VerificationResponse> {
    const profile = await this.findOrThrow(profileId, workspaceId);
    const expectations = verificationExpectations(templateForPrinter(this.printerOf(profile)));
    const outcome = evaluateVerification(expectations, input.unit, input);

    await this.repo.recordVerification(profileId, workspaceId, {
      passed: outcome.passed,
      userId: ctx.userId,
      details: {
        checkedAt: new Date().toISOString(),
        measured: input,
        offsetsAtCheck: {
          horizontalOffsetPts: profile.horizontalOffsetPts.toString(),
          verticalOffsetPts: profile.verticalOffsetPts.toString(),
        },
        outcome,
      },
    });

    await this.auditService.log({
      tenantId: ctx.tenantId,
      userId: ctx.userId,
      workspaceId,
      action: outcome.passed ? "CALIBRATION_VERIFIED" : "CALIBRATION_VERIFICATION_FAILED",
      entityType: "CalibrationProfile",
      entityId: profileId,
      details: { measured: input, outcome },
      ipAddress: ctx.ipAddress,
    });

    const updated = await this.findOrThrow(profileId, workspaceId);
    return { ...outcome, profile: this.formatProfile(updated) };
  }

  /** Fine alignment: nudges the profile's offsets after a verification print. */
  async adjustProfile(
    profileId: string,
    workspaceId: string,
    input: AdjustmentInput,
    ctx: AuditContext,
  ): Promise<CalibrationMutationResponse> {
    const profile = await this.findOrThrow(profileId, workspaceId);
    const toPts = (v: number) => (input.unit === "mm" ? v * PTS_PER_MM : v * PTS_PER_INCH);
    const previous = {
      horizontalOffsetPts: Number(profile.horizontalOffsetPts),
      verticalOffsetPts: Number(profile.verticalOffsetPts),
    };
    const next = {
      horizontalOffsetPts: Math.round((previous.horizontalOffsetPts + toPts(input.horizontal)) * 100) / 100,
      verticalOffsetPts: Math.round((previous.verticalOffsetPts + toPts(input.vertical)) * 100) / 100,
    };

    const largest = Math.max(Math.abs(next.horizontalOffsetPts), Math.abs(next.verticalOffsetPts));
    if (largest > CALIBRATION_LIMITS.maxOffsetPts) {
      throw new ValidationError(
        `This adjustment would shift the page by ${toMm(largest)} mm in total, more than the 12.7 mm (0.5 in) limit. ` +
          "Recalibrate the printer with the calibration sheet instead.",
        { horizontal: ["Adjustment out of range"] },
      );
    }

    await this.repo.adjustOffsets(profileId, workspaceId, next);

    await this.auditService.log({
      tenantId: ctx.tenantId,
      userId: ctx.userId,
      workspaceId,
      action: "CALIBRATION_ADJUSTED",
      entityType: "CalibrationProfile",
      entityId: profileId,
      details: { adjustment: input, previous, next },
      ipAddress: ctx.ipAddress,
    });

    const updated = await this.findOrThrow(profileId, workspaceId);
    return {
      ...this.formatProfile(updated),
      warnings: ["Offsets changed, so the profile is no longer verified. Print the sample check again and verify it."],
    };
  }

  async setDefault(
    profileId: string,
    workspaceId: string,
    ctx: AuditContext,
  ): Promise<CalibrationProfileResponse> {
    const existing = await this.findOrThrow(profileId, workspaceId);

    await this.repo.setDefault(profileId, workspaceId);

    const updated = await this.findOrThrow(profileId, workspaceId);

    await this.auditService.log({
      tenantId: ctx.tenantId,
      userId: ctx.userId,
      workspaceId,
      action: "CALIBRATION_DEFAULT_SET",
      entityType: "CalibrationProfile",
      entityId: profileId,
      details: { profileName: existing.profileName },
      ipAddress: ctx.ipAddress,
    });

    return this.formatProfile(updated);
  }

  async deleteProfile(
    profileId: string,
    workspaceId: string,
    ctx: AuditContext,
  ): Promise<void> {
    const existing = await this.findOrThrow(profileId, workspaceId);

    if (existing.isDefault) {
      throw new ValidationError(
        "Cannot delete the default printer profile. Set another profile as default first.",
        { profile: ["Cannot delete the default profile"] },
      );
    }

    await this.repo.remove(profileId, workspaceId);

    await this.auditService.log({
      tenantId: ctx.tenantId,
      userId: ctx.userId,
      workspaceId,
      action: "CALIBRATION_DELETED",
      entityType: "CalibrationProfile",
      entityId: profileId,
      details: { profileName: existing.profileName },
      ipAddress: ctx.ipAddress,
    });
  }

  /**
   * Picks the printer profile for a print job: the one the user chose, otherwise
   * the workspace default. Printing without any calibrated printer is refused,
   * because zero offsets can put the MICR line outside the bank's tolerance.
   */
  async resolveForPrint(
    workspaceId: string,
    profileId?: string,
  ): Promise<PrintCalibration> {
    const profile = profileId
      ? await this.findOrThrow(profileId, workspaceId)
      : await this.repo.findDefault(workspaceId);

    if (!profile) {
      throw new ValidationError(
        "No calibrated printer in this workspace. Print the calibration sheet, measure it, and save a printer profile before printing checks.",
        { calibrationProfileId: ["No printer profile available"] },
      );
    }

    return {
      profileId: profile.id,
      profileName: profile.profileName,
      ...this.printerOf(profile),
      horizontalOffsetPts: Number(profile.horizontalOffsetPts),
      verticalOffsetPts: Number(profile.verticalOffsetPts),
    };
  }

  private printerOf(profile: ProfileRow): { paperSize: PaperSize; stockType: StockType } {
    return { paperSize: profile.paperSize as PaperSize, stockType: profile.stockType as StockType };
  }

  private async findOrThrow(profileId: string, workspaceId: string): Promise<ProfileRow> {
    const profile = await this.repo.findById(profileId, workspaceId);
    if (!profile) {
      throw new NotFoundError("Calibration profile");
    }
    return profile;
  }

  private formatProfile(profile: ProfileRow): CalibrationProfileResponse {
    const stored = normalizeStoredMeasurements(profile.measurementsJson);
    const lastResult = (profile.verificationJson as { outcome?: VerificationOutcome } | null)?.outcome ?? null;

    return {
      id: profile.id,
      profileName: profile.profileName,
      paperSize: profile.paperSize as PaperSize,
      stockType: profile.stockType as StockType,
      tray: profile.tray,
      horizontalOffsetPts: Number(profile.horizontalOffsetPts).toFixed(2),
      verticalOffsetPts: Number(profile.verticalOffsetPts).toFixed(2),
      scaleX: profile.scaleX === null ? null : Number(profile.scaleX).toFixed(4),
      scaleY: profile.scaleY === null ? null : Number(profile.scaleY).toFixed(4),
      measurements: stored ? { unit: stored.unit, sheets: stored.sheets } : null,
      repeatability: stored?.repeatability
        ? {
            sheets: stored.repeatability.sheets,
            spreadXMm: toMm(stored.repeatability.spreadXPts),
            spreadYMm: toMm(stored.repeatability.spreadYPts),
          }
        : null,
      verification: {
        verified: profile.verifiedAt !== null,
        verifiedAt: profile.verifiedAt?.toISOString() ?? null,
        verifiedById: profile.verifiedById,
        lastResult,
      },
      refVersion: profile.refVersion,
      needsRecalibration: profile.refVersion < CALIBRATION_REF.version,
      calibratedById: profile.calibratedById,
      calibratedAt: profile.calibratedAt.toISOString(),
      isDefault: profile.isDefault,
      createdAt: profile.createdAt.toISOString(),
      updatedAt: profile.updatedAt.toISOString(),
    };
  }
}
