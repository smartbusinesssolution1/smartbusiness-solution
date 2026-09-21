import { WorkspaceRepository } from "./workspace.repository.js";
import {
  ValidationError,
  NotFoundError,
  ConflictError,
  ForbiddenError,
} from "../../shared/errors/index.js";
import { AuditService } from "../../shared/services/audit.service.js";
import { PasswordService } from "../../shared/services/password.service.js";
import type { Workspace } from "@smartbusiness/database";
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
    ctx: AuditContext,
  ) {
    const tenant = await this.workspaceRepository.findTenantById(tenantId);

    if (!tenant) {
      throw new NotFoundError("Tenant");
    }

    const currentCount = await this.workspaceRepository.countByTenant(tenantId);
    const limit = PLAN_WORKSPACE_LIMITS[tenant.plan] ?? 1;

    if (currentCount >= limit) {
      throw new ValidationError(
        `Your ${tenant.plan} plan allows ${limit} workspace(s). Upgrade to add more.`,
        { workspaceLimit: [`Maximum ${limit} workspace(s) allowed`] },
      );
    }

    const workspace = await this.workspaceRepository.create(
      { tenantId, ...input },
      userId,
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
    const workspace = await this.workspaceRepository.findById(workspaceId, tenantId);

    if (!workspace) {
      throw new NotFoundError("Workspace");
    }

    return this.formatWorkspace(workspace);
  }

  async listWorkspaces(userId: string, tenantId: string) {
    const workspaces = await this.workspaceRepository.findUserWorkspaces(userId, tenantId);
    return workspaces.map((w) => this.formatWorkspace(w));
  }

  async updateWorkspace(
    workspaceId: string,
    tenantId: string,
    input: UpdateWorkspaceInput,
    ctx: AuditContext,
  ) {
    const workspace = await this.workspaceRepository.update(workspaceId, tenantId, input);

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

  async deleteWorkspace(workspaceId: string, tenantId: string, ctx: AuditContext) {
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

  async listMembers(workspaceId: string) {
    const members = await this.workspaceRepository.findMembers(workspaceId);

    return members.map((m) => ({
      id: m.id,
      userId: m.userId,
      email: m.user.email,
      fullName: m.user.fullName,
      isActive: m.user.isActive,
      lastLoginAt: m.user.lastLoginAt,
      permissions: {
        isSuperUser: m.isSuperUser,
        canCreate: m.canCreate,
        canPrint: m.canPrint,
        canApprove: m.canApprove,
      },
      createdAt: m.createdAt,
    }));
  }

  async addMember(
    workspaceId: string,
    tenantId: string,
    input: AddMemberInput,
    ctx: AuditContext,
  ) {
    const existingUser = await this.workspaceRepository.findUserByEmail(input.email);

    if (existingUser && existingUser.tenantId !== tenantId) {
      throw new ValidationError(
        "Unable to add this user. Please contact support.",
        { email: ["This email cannot be added to this workspace"] },
      );
    }

    let needsUserCreation = false;
    let userId = existingUser?.id ?? "";

    if (!existingUser) {
      needsUserCreation = true;
    } else {
      const existingMember = await this.workspaceRepository.findMemberByUserId(
        workspaceId,
        existingUser.id,
      );

      if (existingMember) {
        throw new ConflictError("This user is already a member of this workspace");
      }
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
      {
        workspaceId,
        userId,
        isSuperUser: input.permissions.isSuperUser,
        canCreate: input.permissions.canCreate,
        canPrint: input.permissions.canPrint,
        canApprove: input.permissions.canApprove,
      },
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
        permissions: input.permissions,
      },
      ipAddress: ctx.ipAddress,
    });

    return {
      id: member.id,
      userId: member.userId,
      email: member.user.email,
      fullName: member.user.fullName,
      permissions: {
        isSuperUser: member.isSuperUser,
        canCreate: member.canCreate,
        canPrint: member.canPrint,
        canApprove: member.canApprove,
      },
    };
  }

  async updateMember(
    workspaceId: string,
    tenantId: string,
    memberId: string,
    input: UpdateMemberInput,
    ctx: AuditContext,
  ) {
    const member = await this.workspaceRepository.findMemberById(memberId);

    if (!member || member.workspaceId !== workspaceId || member.workspace.tenantId !== tenantId) {
      throw new NotFoundError("Member");
    }

    if (member.isSuperUser && input.permissions.isSuperUser === false) {
      const superUserCount = await this.workspaceRepository.countSuperUsers(workspaceId);

      if (superUserCount <= 1) {
        throw new ValidationError(
          "Cannot remove the last Super User. Promote another member first.",
          { isSuperUser: ["At least one Super User is required"] },
        );
      }
    }

    const updated = await this.workspaceRepository.updateMember(memberId, input.permissions);

    await this.auditService.log({
      tenantId,
      userId: ctx.userId,
      workspaceId,
      action: "MEMBER_UPDATED",
      entityType: "WorkspaceMember",
      entityId: memberId,
      details: {
        memberEmail: updated.user.email,
        permissionChanges: input.permissions,
      },
      ipAddress: ctx.ipAddress,
    });

    return {
      id: updated.id,
      userId: updated.userId,
      email: updated.user.email,
      fullName: updated.user.fullName,
      permissions: {
        isSuperUser: updated.isSuperUser,
        canCreate: updated.canCreate,
        canPrint: updated.canPrint,
        canApprove: updated.canApprove,
      },
    };
  }

  async removeMember(
    workspaceId: string,
    tenantId: string,
    memberId: string,
    ctx: AuditContext,
  ) {
    const member = await this.workspaceRepository.findMemberById(memberId);

    if (!member || member.workspaceId !== workspaceId || member.workspace.tenantId !== tenantId) {
      throw new NotFoundError("Member");
    }

    if (member.userId === ctx.userId) {
      throw new ValidationError(
        "You cannot remove yourself. Ask another Super User to remove you.",
        { member: ["Cannot remove yourself from the workspace"] },
      );
    }

    if (member.isSuperUser) {
      const superUserCount = await this.workspaceRepository.countSuperUsers(workspaceId);

      if (superUserCount <= 1) {
        throw new ValidationError(
          "Cannot remove the last Super User. Promote another member first.",
          { member: ["At least one Super User is required"] },
        );
      }
    }

    await this.workspaceRepository.removeMember(memberId);

    await this.auditService.log({
      tenantId,
      userId: ctx.userId,
      workspaceId,
      action: "MEMBER_REMOVED",
      entityType: "WorkspaceMember",
      entityId: memberId,
      details: { removedUserEmail: member.user.email },
      ipAddress: ctx.ipAddress,
    });
  }

  // ═══════════════════════════════════════════════════════
  // PRIVATE HELPERS
  // ═══════════════════════════════════════════════════════

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
      approvalEnabled: workspace.approvalEnabled,
      maxCheckAmount: workspace.maxCheckAmount?.toString(),
      maxPastDays: workspace.maxPastDays,
      maxFutureDays: workspace.maxFutureDays,
      createdAt: workspace.createdAt,
    };
  }
}
