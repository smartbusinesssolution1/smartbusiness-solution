import type { Workspace } from "@smartbusiness/database";
import { WorkspaceRepository, type MemberWithRoles } from "./workspace.repository.js";
import {
  AppError,
  ValidationError,
  NotFoundError,
  ConflictError,
} from "../../shared/errors/index.js";
import type { UserTokenService } from "@smartbusiness/auth";
import type { EmailJobs, TypedQueue } from "@smartbusiness/jobs";
import { AuditService } from "../../shared/services/audit.service.js";
import { logger } from "../../shared/services/logger.js";
import { auditChanges } from "../../shared/utils/audit-changes.js";
import type {
  CreateWorkspaceInput,
  UpdateWorkspaceInput,
  AddMemberInput,
  UpdateMemberInput,
} from "./workspace.schema.js";

const PLAN_WORKSPACE_LIMITS: Record<string, number> = {
  TRIAL: 1,
  STARTER: 1,
  PROFESSIONAL: 3,
  BUSINESS: 999,
};

interface AuditContext {
  userId: string;
  tenantId: string;
  ipAddress?: string;
}

// At most one invitation email per person per minute, however often Resend is pressed.
const INVITATION_RESEND_COOLDOWN_MS = 60 * 1000;

// Where a member stands: ACTIVE has a password and signs in; INVITED was emailed a link
// and has not chosen a password yet; INVITATION_EXPIRED needs a new link (Resend).
export type MemberStatus = "ACTIVE" | "INVITED" | "INVITATION_EXPIRED";

type LatestInvitation = { expiresAt: Date; createdAt: Date };

const WORKSPACE_AUDITED_FIELDS = ["businessName", "addressLine1", "addressLine2", "city", "state", "zipCode", "phone"] as const;

export class WorkspaceService {
  constructor(
    private workspaceRepository: WorkspaceRepository,
    private auditService: AuditService,
    // Invitation emails are sent by platform-api's worker; this service only adds the job.
    private emailQueue: Pick<TypedQueue<EmailJobs>, "add">,
    private userTokens: UserTokenService,
  ) {}

  // ═══════════════════════════════════════════════════════
  // WORKSPACE CRUD
  // ═══════════════════════════════════════════════════════

  async createWorkspace(
    tenantId: string,
    userId: string,
    input: CreateWorkspaceInput,
    plan: string,
    productId: string,
    ctx: AuditContext,
  ) {
    const currentCount =
      await this.workspaceRepository.countByTenant(tenantId);
    const limit = PLAN_WORKSPACE_LIMITS[plan] ?? 1;

    if (currentCount >= limit) {
      throw new ValidationError(
        `Your ${plan} plan allows ${limit} workspace(s). Upgrade to add more.`,
        { workspaceLimit: [`Maximum ${limit} workspace(s) allowed`] },
      );
    }

    const workspace = await this.workspaceRepository.create(
      { tenantId, ...input },
      userId,
      productId,
    );

    await this.auditService.log({
      tenantId,
      userId,
      workspaceId: workspace.id,
      action: "WORKSPACE_CREATED",
      entityType: "Workspace",
      entityId: workspace.id,
      details: { businessName: input.businessName },
      ipAddress: ctx.ipAddress,
    });

    return this.formatWorkspace(workspace);
  }

  async getWorkspace(workspaceId: string, tenantId: string) {
    const workspace = await this.workspaceRepository.findById(
      workspaceId,
      tenantId,
    );

    if (!workspace) {
      throw new NotFoundError("Workspace");
    }

    return this.formatWorkspace(workspace);
  }

  async listWorkspaces(userId: string, tenantId: string, productId: string) {
    const workspaces = await this.workspaceRepository.findUserWorkspaces(
      userId,
      tenantId,
      productId,
    );
    return workspaces.map((w) => this.formatWorkspace(w));
  }

  async updateWorkspace(
    workspaceId: string,
    tenantId: string,
    input: UpdateWorkspaceInput,
    ctx: AuditContext,
  ) {
    // The business name and address are printed on every check: the log keeps what they were.
    const before = await this.workspaceRepository.findById(workspaceId, tenantId);
    const workspace = await this.workspaceRepository.update(
      workspaceId,
      tenantId,
      input,
    );
    const saved = Object.fromEntries(Object.keys(input).map((k) => [k, workspace[k as keyof Workspace]]));

    await this.auditService.log({
      tenantId,
      userId: ctx.userId,
      workspaceId,
      action: "WORKSPACE_UPDATED",
      entityType: "Workspace",
      entityId: workspaceId,
      details: { changes: auditChanges(before ?? {}, saved, { fields: WORKSPACE_AUDITED_FIELDS }) },
      ipAddress: ctx.ipAddress,
    });

    return this.formatWorkspace(workspace);
  }

  async deleteWorkspace(
    workspaceId: string,
    tenantId: string,
    ctx: AuditContext,
  ) {
    await this.workspaceRepository.softDelete(workspaceId, tenantId);

    await this.auditService.log({
      tenantId,
      userId: ctx.userId,
      workspaceId,
      action: "WORKSPACE_DELETED",
      entityType: "Workspace",
      entityId: workspaceId,
      ipAddress: ctx.ipAddress,
    });
  }

  // ═══════════════════════════════════════════════════════
  // MEMBER MANAGEMENT
  // ═══════════════════════════════════════════════════════

  async listMembers(workspaceId: string, productId: string) {
    const members = await this.workspaceRepository.findMembers(workspaceId, productId);
    const invitations = await this.workspaceRepository.findLatestInvitations(
      workspaceId,
      members.map((m) => m.userId),
    );
    return members.map((m) => this.formatMember(m, productId, invitations.get(m.userId)));
  }

  // ═════════════════════════════════════════════════════════════
  // INVITE A MEMBER
  //
  // The access is given at once, with exactly the chosen roles; then an email job is
  // queued for platform-api's worker:
  //   - a new person is created WITHOUT a password and gets an invitation link to choose
  //     one (they cannot sign in before that);
  //   - someone who already has an account gets "you now have access" and signs in as
  //     usual. If their account is in another company (an outside bookkeeper), they join
  //     this company as a plain member.
  // The reply is the same either way, so inviting cannot be used to find out who has an
  // account. If the email cannot be queued, the access stays and the reply says so: the
  // admin can press Resend.
  // ═════════════════════════════════════════════════════════════

  async addMember(
    workspaceId: string,
    tenantId: string,
    input: AddMemberInput,
    productId: string,
    ctx: AuditContext,
  ) {
    const roles = await this.resolveRoles(productId, input.roleSlugs);

    const existingUser = await this.workspaceRepository.findUserByEmail(input.email);
    let joinTenantId: string | undefined;

    if (existingUser) {
      const tenantMembership = await this.workspaceRepository.findTenantMembership(tenantId, existingUser.id);
      if (!tenantMembership) joinTenantId = tenantId;

      const existingMember = await this.workspaceRepository.findMemberByUserId(workspaceId, existingUser.id);
      // Someone in the workspace only through another product can be given roles here;
      // someone who already has Check Printing roles is changed with PUT, not added twice.
      const hasRolesHere = existingMember?.assignedRoles.some((ar) => ar.role.productId === productId);
      if (hasRolesHere) {
        throw new ConflictError("This user is already a member of this workspace");
      }
    }

    const member = await this.workspaceRepository.addMemberInTransaction(
      existingUser ? null : { tenantId, email: input.email, fullName: input.fullName },
      { workspaceId, userId: existingUser?.id ?? "", joinTenantId },
      productId,
      roles.map((r) => r.id),
      ctx.userId,
    );

    const invitationEmailQueued = await this.queueInvitationEmail(member.userId, workspaceId, ctx.userId);

    await this.auditService.log({
      tenantId,
      userId: ctx.userId,
      workspaceId,
      action: "MEMBER_ADDED",
      entityType: "WorkspaceMember",
      entityId: member.id,
      details: {
        memberEmail: input.email,
        newUserCreated: !existingUser,
        joinedCompany: Boolean(joinTenantId),
        roleSlugs: roles.map((r) => r.slug),
        invitationEmailQueued,
      },
      ipAddress: ctx.ipAddress,
    });

    const invitations = await this.workspaceRepository.findLatestInvitations(workspaceId, [member.userId]);
    return { ...this.formatMember(member, productId, invitations.get(member.userId)), invitationEmailQueued };
  }

  // ═════════════════════════════════════════════════════════════
  // RESEND AN INVITATION
  //
  // For someone who has not chosen a password yet: a new link is emailed and the old one
  // stops working (the worker replaces it). At most once a minute per person.
  // ═════════════════════════════════════════════════════════════

  async resendInvitation(workspaceId: string, tenantId: string, memberId: string, ctx: AuditContext) {
    const member = await this.workspaceRepository.findMemberById(memberId);
    if (!member || member.workspaceId !== workspaceId || member.workspace.tenantId !== tenantId) {
      throw new NotFoundError("Member");
    }
    if (member.user.passwordHash !== null) {
      throw new ConflictError(
        `${member.user.fullName} has already set up their account and signs in with their own password. There is no invitation to resend.`,
      );
    }

    const latest = (await this.workspaceRepository.findLatestInvitations(workspaceId, [member.userId])).get(member.userId);
    if (latest && Date.now() - latest.createdAt.getTime() < INVITATION_RESEND_COOLDOWN_MS) {
      throw new AppError(
        "An invitation was sent to this person less than a minute ago. Wait a minute before sending another.",
        429,
        "INVITATION_RECENTLY_SENT",
      );
    }

    if (!(await this.queueInvitationEmail(member.userId, workspaceId, ctx.userId))) {
      throw new AppError("We couldn't send the invitation right now. Try again in a moment.", 503, "SERVICE_UNAVAILABLE");
    }

    await this.auditService.log({
      tenantId,
      userId: ctx.userId,
      workspaceId,
      action: "INVITATION_RESENT",
      entityType: "WorkspaceMember",
      entityId: memberId,
      details: { memberEmail: member.user.email },
      ipAddress: ctx.ipAddress,
    });

    return { message: `A new invitation is on its way to ${member.user.email}. Earlier links no longer work.` };
  }

  async updateMember(
    workspaceId: string,
    tenantId: string,
    memberId: string,
    input: UpdateMemberInput,
    productId: string,
    ctx: AuditContext,
  ) {
    const member = await this.workspaceRepository.findMemberById(memberId);

    if (
      !member ||
      member.workspaceId !== workspaceId ||
      member.workspace.tenantId !== tenantId
    ) {
      throw new NotFoundError("Member");
    }

    const roles = await this.resolveRoles(productId, input.roleSlugs);

    // The last-admin rule is checked inside the repository's locked transaction.
    const { member: updated, previousRoleSlugs } = await this.workspaceRepository.setMemberRoles(
      memberId,
      workspaceId,
      productId,
      roles,
      ctx.userId,
    );

    await this.auditService.log({
      tenantId,
      userId: ctx.userId,
      workspaceId,
      action: "MEMBER_UPDATED",
      entityType: "WorkspaceMember",
      entityId: memberId,
      details: {
        memberEmail: updated.user.email,
        previousRoleSlugs,
        roleSlugs: roles.map((r) => r.slug),
      },
      ipAddress: ctx.ipAddress,
    });

    const invitations = await this.workspaceRepository.findLatestInvitations(workspaceId, [updated.userId]);
    return this.formatMember(updated, productId, invitations.get(updated.userId));
  }

  async removeMember(
    workspaceId: string,
    tenantId: string,
    memberId: string,
    productId: string,
    ctx: AuditContext,
  ) {
    const member = await this.workspaceRepository.findMemberById(memberId);

    if (
      !member ||
      member.workspaceId !== workspaceId ||
      member.workspace.tenantId !== tenantId
    ) {
      throw new NotFoundError("Member");
    }

    if (member.userId === ctx.userId) {
      throw new ValidationError(
        "You cannot remove yourself. Ask another Admin to remove you.",
        { member: ["Cannot remove yourself from the workspace"] },
      );
    }

    // Removes this product's roles (and the membership, when no product role is left).
    // The last-admin rule is checked inside the repository's locked transaction.
    const { removedRoleSlugs, leftWorkspace } = await this.workspaceRepository.removeFromProduct(
      memberId,
      workspaceId,
      productId,
    );

    // Someone who no longer has any access to this workspace must not be able to use an
    // emailed link to it ("cancel the invitation"). Accepting checks the membership too.
    const revokedInvitations = leftWorkspace
      ? await this.userTokens.revokeForUser(member.userId, "INVITATION", { workspaceId })
      : 0;

    await this.auditService.log({
      tenantId,
      userId: ctx.userId,
      workspaceId,
      action: "MEMBER_REMOVED",
      entityType: "WorkspaceMember",
      entityId: memberId,
      details: {
        removedUserEmail: member.user.email,
        roleSlugs: removedRoleSlugs,
        leftWorkspace,
        revokedInvitations,
      },
      ipAddress: ctx.ipAddress,
    });
  }

  // ═══════════════════════════════════════════════════════
  // PRIVATE HELPERS
  // ═══════════════════════════════════════════════════════

  // Adds the email job (IDs only: the worker creates the link when it runs). A failure is
  // reported, not thrown: the access was already given.
  private async queueInvitationEmail(userId: string, workspaceId: string, invitedById: string): Promise<boolean> {
    try {
      await this.emailQueue.add("workspace-invitation", { userId, workspaceId, invitedById });
      return true;
    } catch (err) {
      logger.error({ err, userId, workspaceId }, "Could not queue an invitation email");
      return false;
    }
  }

  // The product's roles for these slugs. A slug listed twice counts once; an unknown slug
  // is named in the error.
  private async resolveRoles(productId: string, roleSlugs: string[]) {
    const slugs = [...new Set(roleSlugs)];
    const roles = await this.workspaceRepository.findRolesByProductAndSlugs(productId, slugs);

    if (roles.length !== slugs.length) {
      const found = new Set(roles.map((r) => r.slug));
      const invalid = slugs.filter((s) => !found.has(s));
      throw new ValidationError(
        `Invalid role(s): ${invalid.join(", ")}`,
        { roleSlugs: [`Unknown roles: ${invalid.join(", ")}`] },
      );
    }
    return roles;
  }

  // Platform fields only. Check-printing settings: GET /workspaces/:wid/check-printing-settings.
  private formatWorkspace(workspace: Workspace) {
    return {
      id: workspace.id,
      businessName: workspace.businessName,
      addressLine1: workspace.addressLine1,
      addressLine2: workspace.addressLine2,
      city: workspace.city,
      state: workspace.state,
      zipCode: workspace.zipCode,
      phone: workspace.phone,
      logoUrl: workspace.logoUrl,
      createdAt: workspace.createdAt,
    };
  }

  // This product's view of a member: only its roles and their permissions. Roles the
  // member holds in other products of the platform are not shown here.
  private formatMember(member: MemberWithRoles, productId: string, invitation?: LatestInvitation) {
    const productRoles = member.assignedRoles.filter((ar) => ar.role.productId === productId);
    const roleSlugs = productRoles.map((ar) => ar.role.slug);

    const permissionSet = new Set<string>();
    for (const ar of productRoles) {
      for (const rp of ar.role.rolePermissions) {
        permissionSet.add(rp.permission.action);
      }
    }

    return {
      id: member.id,
      userId: member.userId,
      email: member.user.email,
      fullName: member.user.fullName,
      isActive: member.user.isActive,
      lastLoginAt: member.user.lastLoginAt,
      ...this.memberStatus(member, invitation),
      roles: roleSlugs,
      permissions: [...permissionSet],
      createdAt: member.createdAt,
    };
  }

  // The password itself never leaves this method: only whether one was chosen.
  private memberStatus(member: MemberWithRoles, invitation?: LatestInvitation): {
    status: MemberStatus;
    invitationExpiresAt: Date | null;
  } {
    if (member.user.passwordHash !== null) return { status: "ACTIVE", invitationExpiresAt: null };
    // No link yet: the email job has not run. It counts as invited (being sent).
    if (!invitation) return { status: "INVITED", invitationExpiresAt: null };
    const expired = invitation.expiresAt.getTime() <= Date.now();
    return { status: expired ? "INVITATION_EXPIRED" : "INVITED", invitationExpiresAt: invitation.expiresAt };
  }
}
