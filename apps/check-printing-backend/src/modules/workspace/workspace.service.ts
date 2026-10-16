import type { Workspace } from "@smartbusiness/database";
import { WorkspaceRepository, type MemberWithRoles } from "./workspace.repository.js";
import {
  ValidationError,
  NotFoundError,
  ConflictError,
} from "../../shared/errors/index.js";
import { PasswordService } from "@smartbusiness/auth";
import { AuditService } from "../../shared/services/audit.service.js";
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

export class WorkspaceService {
  constructor(
    private workspaceRepository: WorkspaceRepository,
    private auditService: AuditService,
    private passwordService: PasswordService,
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
    const workspace = await this.workspaceRepository.update(
      workspaceId,
      tenantId,
      input,
    );

    await this.auditService.log({
      tenantId,
      userId: ctx.userId,
      workspaceId,
      action: "WORKSPACE_UPDATED",
      entityType: "Workspace",
      entityId: workspaceId,
      details: { fields: Object.keys(input) },
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
    return members.map((m) => this.formatMember(m, productId));
  }

  async addMember(
    workspaceId: string,
    tenantId: string,
    input: AddMemberInput,
    productId: string,
    ctx: AuditContext,
  ) {
    const roles = await this.resolveRoles(productId, input.roleSlugs);

    const existingUser =
      await this.workspaceRepository.findUserByEmail(input.email);

    let needsUserCreation = false;
    let userId = existingUser?.id ?? "";

    if (existingUser) {
      const tenantMembership =
        await this.workspaceRepository.findTenantMembership(
          tenantId,
          existingUser.id,
        );

      if (!tenantMembership) {
        throw new ValidationError(
          "Unable to add this user. Please contact support.",
          { email: ["This email cannot be added to this workspace"] },
        );
      }

      const existingMember =
        await this.workspaceRepository.findMemberByUserId(
          workspaceId,
          existingUser.id,
        );

      // Someone in the workspace only through another product can be given roles here;
      // someone who already has Check Printing roles is changed with PUT, not added twice.
      const hasRolesHere = existingMember?.assignedRoles.some((ar) => ar.role.productId === productId);
      if (hasRolesHere) {
        throw new ConflictError(
          "This user is already a member of this workspace",
        );
      }
    } else {
      needsUserCreation = true;
    }

    let userData = null;
    if (needsUserCreation) {
      const tempPassword = crypto.randomUUID();
      const passwordHash = await this.passwordService.hash(tempPassword);

      userData = {
        tenantId,
        email: input.email,
        fullName: input.fullName,
        passwordHash,
      };
    }

    const member = await this.workspaceRepository.addMemberInTransaction(
      userData,
      { workspaceId, userId },
      productId,
      roles.map((r) => r.id),
      ctx.userId,
    );

    await this.auditService.log({
      tenantId,
      userId: ctx.userId,
      workspaceId,
      action: "MEMBER_ADDED",
      entityType: "WorkspaceMember",
      entityId: member.id,
      details: {
        memberEmail: input.email,
        newUserCreated: needsUserCreation,
        roleSlugs: roles.map((r) => r.slug),
      },
      ipAddress: ctx.ipAddress,
    });

    return this.formatMember(member, productId);
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

    return this.formatMember(updated, productId);
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
      },
      ipAddress: ctx.ipAddress,
    });
  }

  // ═══════════════════════════════════════════════════════
  // PRIVATE HELPERS
  // ═══════════════════════════════════════════════════════

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
  private formatMember(member: MemberWithRoles, productId: string) {
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
      roles: roleSlugs,
      permissions: [...permissionSet],
      createdAt: member.createdAt,
    };
  }
}
