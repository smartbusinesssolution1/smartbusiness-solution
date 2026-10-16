import { prisma, type CheckPrintingSettings } from "@smartbusiness/database";

export interface SettingsChanges {
  approvalEnabled?: boolean;
  maxCheckAmount?: number;
  maxPastDays?: number;
  maxFutureDays?: number;
}

export class CheckPrintingSettingsRepository {
  // Returns the workspace's settings, creating them with the database defaults if they
  // don't exist yet. Settings are created lazily because a workspace is a platform
  // concept: the code that creates workspaces must not need to know about each product.
  // This also repairs workspaces that existed before the settings table.
  //
  // skipDuplicates makes Prisma send INSERT ... ON CONFLICT DO NOTHING, so when several
  // requests arrive together the database lets exactly one insert win and the others do
  // nothing. A "find, then create if missing" in two steps would let both requests see
  // "missing" and the second insert would fail on the primary key.
  async ensure(workspaceId: string): Promise<CheckPrintingSettings> {
    await prisma.checkPrintingSettings.createMany({
      data: [{ workspaceId }],
      skipDuplicates: true,
    });
    return prisma.checkPrintingSettings.findUniqueOrThrow({ where: { workspaceId } });
  }

  async update(workspaceId: string, changes: SettingsChanges): Promise<CheckPrintingSettings> {
    return prisma.checkPrintingSettings.update({
      where: { workspaceId },
      data: changes,
    });
  }
}
