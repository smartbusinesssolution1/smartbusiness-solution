import type { CheckLayout } from "../pdf/pdf.types.js";
import { prisma, Prisma } from "@smartbusiness/database";
import type { PaperSize } from "../pdf/pdf.types.js";
import type { CalibrationMeasurements, Repeatability } from "./calibration.math.js";

interface CalibrationValues {
  paperSize: PaperSize;
  horizontalOffsetPts: number;
  verticalOffsetPts: number;
  scaleX: number;
  scaleY: number;
  measurements: CalibrationMeasurements;
  repeatability: Repeatability;
  refVersion: number;
  calibratedById: string;
}

// New offsets invalidate any earlier verification of a printed sample.
const CLEARED_VERIFICATION = { verifiedAt: null, verifiedById: null } as const;

function toColumns(v: CalibrationValues) {
  return {
    paperSize: v.paperSize,
    horizontalOffsetPts: v.horizontalOffsetPts,
    verticalOffsetPts: v.verticalOffsetPts,
    scaleX: v.scaleX,
    scaleY: v.scaleY,
    measurementsJson: { ...v.measurements, repeatability: v.repeatability } as unknown as Prisma.InputJsonValue,
    refVersion: v.refVersion,
    calibratedById: v.calibratedById,
    calibratedAt: new Date(),
    ...CLEARED_VERIFICATION,
  };
}

export class CalibrationRepository {

  async create(data: CalibrationValues & {
    workspaceId: string;
    profileName: string;
    stockType: "PLAIN_PAPER" | "PERFORATED_STOCK";
    layout: CheckLayout;
    tray?: string;
  }) {
    // The first printer profile in a workspace becomes its default.
    return prisma.$transaction(async (tx) => {
      const existingDefault = await tx.calibrationProfile.findFirst({
        where: { workspaceId: data.workspaceId, isDefault: true },
        select: { id: true },
      });

      return tx.calibrationProfile.create({
        data: {
          workspaceId: data.workspaceId,
          profileName: data.profileName,
          stockType: data.stockType,
          layout: data.layout,
          tray: data.tray ?? null,
          isDefault: !existingDefault,
          ...toColumns(data),
        },
      });
    });
  }

  async findById(id: string, workspaceId: string) {
    return prisma.calibrationProfile.findFirst({
      where: { id, workspaceId },
    });
  }

  async list(workspaceId: string) {
    const [items, total] = await Promise.all([
      prisma.calibrationProfile.findMany({
        where: { workspaceId },
        orderBy: [{ isDefault: "desc" }, { createdAt: "desc" }],
      }),
      prisma.calibrationProfile.count({
        where: { workspaceId },
      }),
    ]);
    return { items, total };
  }

  async findDefault(workspaceId: string) {
    return prisma.calibrationProfile.findFirst({
      where: { workspaceId, isDefault: true },
    });
  }

  async findWorkspaceForSample(workspaceId: string) {
    return prisma.workspace.findFirst({
      where: { id: workspaceId },
      select: { businessName: true, addressLine1: true, addressLine2: true, city: true, state: true, zipCode: true },
    });
  }

  async updateDetails(id: string, workspaceId: string, data: {
    profileName?: string;
    tray?: string | null;
    stockType?: "PLAIN_PAPER" | "PERFORATED_STOCK";
    layout?: CheckLayout;
  }, options: { clearVerification?: boolean } = {}): Promise<{ count: number }> {
    return prisma.calibrationProfile.updateMany({
      where: { id, workspaceId },
      // Different paper needs a fresh verification sample.
      data: { ...data, ...(options.clearVerification && CLEARED_VERIFICATION) },
    });
  }

  async recalibrate(id: string, workspaceId: string, values: CalibrationValues): Promise<{ count: number }> {
    return prisma.calibrationProfile.updateMany({
      where: { id, workspaceId },
      data: toColumns(values),
    });
  }

  async adjustOffsets(id: string, workspaceId: string, offsets: {
    horizontalOffsetPts: number;
    verticalOffsetPts: number;
  }): Promise<{ count: number }> {
    return prisma.calibrationProfile.updateMany({
      where: { id, workspaceId },
      data: { ...offsets, ...CLEARED_VERIFICATION },
    });
  }

  async recordVerification(id: string, workspaceId: string, result: {
    passed: boolean;
    userId: string;
    details: unknown;
  }): Promise<{ count: number }> {
    return prisma.calibrationProfile.updateMany({
      where: { id, workspaceId },
      data: {
        verifiedAt: result.passed ? new Date() : null,
        verifiedById: result.passed ? result.userId : null,
        verificationJson: result.details as Prisma.InputJsonValue,
      },
    });
  }

  async setDefault(id: string, workspaceId: string) {
    return prisma.$transaction(async (tx) => {
      await tx.calibrationProfile.updateMany({
        where: { workspaceId, isDefault: true },
        data: { isDefault: false },
      });

      await tx.calibrationProfile.updateMany({
        where: { id, workspaceId },
        data: { isDefault: true },
      });
    });
  }

  async remove(id: string, workspaceId: string): Promise<{ count: number }> {
    return prisma.calibrationProfile.deleteMany({
      where: { id, workspaceId },
    });
  }
}
