import type { CheckPrintingSettings } from "@smartbusiness/database";
import { AuditService } from "../../shared/services/audit.service.js";
import { CheckPrintingSettingsRepository, type SettingsChanges } from "./check-printing-settings.repository.js";
import type { UpdateCheckPrintingSettingsInput } from "./check-printing-settings.schemas.js";

interface AuditContext {
  userId: string;
  tenantId: string;
  ipAddress?: string;
}

// ═══════════════════════════════════════════════════════════════
// CHECK-PRINTING SETTINGS (one row per workspace)
//
// The limits every check is validated against (maximum amount, how far the date may be
// in the past or future) and the approval workflow's master switch.
//
// Every reader goes through ensure(), so the row exists from the first time anyone in
// the workspace needs it. The defaults live in one place: the database schema.
//
// The approval switch is changed only through the approval-rule module's toggle, which
// keeps its own audit actions (APPROVAL_WORKFLOW_ENABLED / _DISABLED); the limits are
// changed here.
// ═══════════════════════════════════════════════════════════════

type LimitField = "maxCheckAmount" | "maxPastDays" | "maxFutureDays";
const LIMIT_FIELDS: LimitField[] = ["maxCheckAmount", "maxPastDays", "maxFutureDays"];

export class CheckPrintingSettingsService {
  constructor(
    private readonly repository: CheckPrintingSettingsRepository,
    private readonly auditService: AuditService,
  ) {}

  // The raw row, for other services that validate checks against it.
  async forWorkspace(workspaceId: string): Promise<CheckPrintingSettings> {
    return this.repository.ensure(workspaceId);
  }

  async get(workspaceId: string) {
    return formatSettings(await this.repository.ensure(workspaceId));
  }

  async updateLimits(workspaceId: string, input: UpdateCheckPrintingSettingsInput, ctx: AuditContext) {
    const before = await this.repository.ensure(workspaceId);

    // Only fields whose value actually changes are written and audited, so the audit log
    // answers "who changed the limit from X to Y", not "someone pressed Save".
    const changes: SettingsChanges = {};
    const audited: Record<string, { from: string | number; to: string | number }> = {};
    for (const field of LIMIT_FIELDS) {
      const next = input[field];
      if (next === undefined) continue;
      const from = displayValue(field, before[field]);
      const to = displayValue(field, next);
      if (from === to) continue;
      changes[field] = next;
      audited[field] = { from, to };
    }

    if (Object.keys(changes).length === 0) return formatSettings(before);

    const after = await this.repository.update(workspaceId, changes);

    await this.auditService.log({
      tenantId: ctx.tenantId,
      userId: ctx.userId,
      workspaceId,
      action: "CHECK_PRINTING_SETTINGS_UPDATED",
      entityType: "CheckPrintingSettings",
      entityId: workspaceId,
      details: { changes: audited },
      ipAddress: ctx.ipAddress,
    });

    return formatSettings(after);
  }

  // Used by the approval toggle; the caller writes the audit row.
  async setApprovalEnabled(workspaceId: string, enabled: boolean): Promise<CheckPrintingSettings> {
    await this.repository.ensure(workspaceId);
    return this.repository.update(workspaceId, { approvalEnabled: enabled });
  }
}

// Money as a fixed two-decimal string (as checks are returned), day counts as numbers.
function displayValue(field: LimitField, value: unknown): string | number {
  return field === "maxCheckAmount" ? Number(value).toFixed(2) : Number(value);
}

function formatSettings(settings: CheckPrintingSettings) {
  return {
    workspaceId: settings.workspaceId,
    approvalEnabled: settings.approvalEnabled,
    maxCheckAmount: Number(settings.maxCheckAmount).toFixed(2),
    maxPastDays: settings.maxPastDays,
    maxFutureDays: settings.maxFutureDays,
    updatedAt: settings.updatedAt,
  };
}
