import {
  approvalRequestEmail,
  checkApprovedEmail,
  checkRejectedEmail,
  type EmailTemplate,
} from "@smartbusiness/email";
import type { EmailJobs, TypedQueue } from "@smartbusiness/jobs";
import { logger } from "../../shared/services/logger.js";
import type { CheckNotificationRepository, Recipient } from "./check-notification.repository.js";

// What a notice needs to know about the check (a check as loaded by CheckRepository).
export interface NotifiableCheck {
  id: string;
  workspaceId: string;
  checkNumber: number;
  amount: unknown;
  payeeName: string;
  memo: string | null;
  createdById: string;
  approvalRound: number;
  bankAccount?: { checkNumberPadding?: number | null } | null;
}

// The approval rule that matched the check (null: open approval by anyone allowed).
export interface NotifiableRule {
  requiredApprovals: number;
  allowSelfApproval: boolean;
  approvers: Array<{ userId: string }>;
}

// ═══════════════════════════════════════════════════════════════
// APPROVAL NOTICES BY EMAIL
//
//   waiting for approval  → every person who can approve it now
//   fully approved        → the writer ("ready to print")
//   rejected              → the writer, with the reason
//
// Each email is built here (Check Printing knows its checks) and queued ready to send;
// platform-api's worker sends it. A notice is a courtesy: if it cannot be queued, the
// approval step it follows still stands, and the failure is logged. Never throws.
// ═══════════════════════════════════════════════════════════════

export class CheckNotificationService {
  constructor(
    private readonly repo: CheckNotificationRepository,
    private readonly emailQueue: Pick<TypedQueue<EmailJobs>, "add">,
    private readonly appUrl: string,
  ) {}

  async approvalRequested(check: NotifiableCheck, rule: NotifiableRule | null): Promise<void> {
    await this.safely("approval-request", check, async () => {
      const workspace = await this.repo.findWorkspace(check.workspaceId);
      if (!workspace) return;

      const approvers = await this.repo.findApprovers({
        workspaceId: check.workspaceId,
        tenantId: workspace.tenantId,
        checkId: check.id,
        round: check.approvalRound,
        designatedUserIds: rule?.approvers.map((a) => a.userId) ?? [],
        // Separation of duties: the writer cannot approve their own check unless the rule allows it.
        excludeUserIds: rule?.allowSelfApproval ? [] : [check.createdById],
      });
      if (approvers.length === 0) return;

      const writerName = (await this.repo.findUserName(check.createdById)) ?? "A colleague";
      for (const approver of approvers) {
        await this.queue(approver, approvalRequestEmail({
          ...this.summary(check, workspace.businessName),
          approverName: approver.fullName,
          writerName,
          memo: check.memo,
          approvalsNeeded: rule?.requiredApprovals ?? 1,
        }));
      }
    });
  }

  async approved(check: NotifiableCheck): Promise<void> {
    await this.safely("check-approved", check, async () => {
      const workspace = await this.repo.findWorkspace(check.workspaceId);
      if (!workspace) return;
      const writer = await this.repo.findWriter(check.createdById, check.workspaceId, workspace.tenantId);
      if (!writer) return;
      await this.queue(writer, checkApprovedEmail({ ...this.summary(check, workspace.businessName), writerName: writer.fullName }));
    });
  }

  async rejected(check: NotifiableCheck, reason: string, rejectedById: string): Promise<void> {
    await this.safely("check-rejected", check, async () => {
      const workspace = await this.repo.findWorkspace(check.workspaceId);
      if (!workspace) return;
      const writer = await this.repo.findWriter(check.createdById, check.workspaceId, workspace.tenantId);
      if (!writer) return;
      const rejectedBy = (await this.repo.findUserName(rejectedById)) ?? "An approver";
      await this.queue(writer, checkRejectedEmail({
        ...this.summary(check, workspace.businessName),
        writerName: writer.fullName,
        rejectedBy,
        reason,
      }));
    });
  }

  // ─── Helpers ──────────────────────────────────────────────

  private summary(check: NotifiableCheck, workspaceName: string) {
    return {
      checkNumber: String(check.checkNumber).padStart(check.bankAccount?.checkNumberPadding ?? 6, "0"),
      amount: `$${Number(check.amount).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
      payeeName: check.payeeName,
      workspaceName,
      // Opens the check after a normal sign-in; nothing in the link signs anyone in.
      checkUrl: `${this.appUrl}/w/${check.workspaceId}/checks/${check.id}`,
    };
  }

  private async queue(to: Recipient, email: EmailTemplate): Promise<void> {
    await this.emailQueue.add("notification-email", { to: to.email, ...email });
  }

  private async safely(kind: string, check: NotifiableCheck, send: () => Promise<void>): Promise<void> {
    try {
      await send();
    } catch (err) {
      logger.error({ err, kind, checkId: check.id, workspaceId: check.workspaceId }, "Could not queue a check notification email");
    }
  }
}
