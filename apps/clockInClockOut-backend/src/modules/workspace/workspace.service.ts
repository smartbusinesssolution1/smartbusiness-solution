import { WorkspaceRepository } from "./workspace.repository.js";
import { NotFoundError } from "../../shared/errors/index.js";
import { CreateWorkspaceInput } from "./workspace.schema.js";

export interface WorkspaceResponseDTO {
  id: string;
  tenantId: string;
  name: string;
  businessName: string;
  address?: string;
  addressLine1?: string;
  addressLine2?: string | null;
  city?: string;
  state?: string;
  zipCode?: string;
  phone?: string | null;
  isDefault: boolean;
  employeeCount: number;
  geofenceConfigured: boolean;
  role?: string;
  userRole?: string;
  settings?: {
    latitude: number;
    longitude: number;
    radiusMeters: number;
    graceMinutes: number | null;
  } | null;
  createdAt?: string;
}

export class WorkspaceService {
  constructor(private workspaceRepository: WorkspaceRepository) { }

  private formatWorkspace(w: any, index = 0): WorkspaceResponseDTO {
    return {
      id: w.id,
      tenantId: w.tenantId,
      name: w.businessName,
      businessName: w.businessName,
      address: w.addressLine1,
      addressLine1: w.addressLine1,
      addressLine2: w.addressLine2,
      city: w.city,
      state: w.state,
      zipCode: w.zipCode,
      phone: w.phone,
      isDefault: index === 0,
      employeeCount: w._count?.members ?? 0,
      geofenceConfigured: Boolean(w.attendanceSettings),
      settings: w.attendanceSettings
        ? {
          latitude: Number(w.attendanceSettings.latitude),
          longitude: Number(w.attendanceSettings.longitude),
          radiusMeters: w.attendanceSettings.radiusMeters,
          graceMinutes: w.attendanceSettings.graceMinutes,
        }
        : null,
      createdAt: w.createdAt?.toISOString?.() ?? w.createdAt,
    };
  }

  /**
   * List all workspaces belonging to the tenant.
   */
  async listWorkspaces(tenantId: string): Promise<WorkspaceResponseDTO[]> {
    const records = await this.workspaceRepository.findWorkspacesByTenant(tenantId);
    return records.map((record, idx) => this.formatWorkspace(record, idx));
  }

  /**
   * Fetch a single workspace by ID for the tenant.
   */
  async getWorkspace(workspaceId: string, tenantId: string): Promise<WorkspaceResponseDTO> {
    const record = await this.workspaceRepository.findWorkspaceById(workspaceId, tenantId);
    if (!record) {
      throw new NotFoundError("Workspace");
    }
    return this.formatWorkspace(record, 0);
  }

  async listAccessibleWorkspaces(
    tenantId: string,
    userId: string,
    tenantRole = "",
  ): Promise<WorkspaceResponseDTO[]> {
    const isOwner = (tenantRole || "").toUpperCase() === "OWNER";
    const workspaces = await this.workspaceRepository.listByTenantAndUser(tenantId, userId, isOwner);

    return workspaces.map(({ _count, attendanceSettings, members, ...w }: any, index: number) => {
      const member = members && members.length > 0 ? members[0] : null;
      const empRole = member?.employeeProfiles?.[0]?.role?.toLowerCase();
      const hasAdminAssignedRole = member?.assignedRoles?.some(
        (ar: any) =>
          ar.role?.slug?.toLowerCase().includes("admin") ||
          ar.role?.name?.toLowerCase().includes("admin"),
      );

      let role = "EMPLOYEE";

      // Priority 1: Exact role defined in the employee table for this workspace
      if (empRole) {
        role = empRole === "admin" ? "ADMIN" : "EMPLOYEE";
      } else if (hasAdminAssignedRole) {
        role = "ADMIN";
      } else if (isOwner) {
        role = "OWNER";
      } else if ((tenantRole || "").toUpperCase() === "ADMIN") {
        role = "ADMIN";
      } else {
        role = "EMPLOYEE";
      }

      console.log("[Workspace Role] Workspace:", w.businessName, "| empRole:", empRole, "| Assigned:", role);

      return {
        ...w,
        name: w.businessName,
        isDefault: index === 0,
        employeeCount: _count.members,
        geofenceConfigured: attendanceSettings !== null,
        role,
        userRole: role,
        settings: attendanceSettings
          ? {
              latitude: Number(attendanceSettings.latitude),
              longitude: Number(attendanceSettings.longitude),
              radiusMeters: attendanceSettings.radiusMeters,
              graceMinutes: attendanceSettings.graceMinutes,
            }
          : null,
        createdAt: w.createdAt?.toISOString?.() ?? w.createdAt,
        updatedAt: w.updatedAt?.toISOString?.() ?? w.updatedAt,
      };
    });
  }

  /**
   * Create a new workspace and register the creator as member.
   */
  async createWorkspace(
    tenantId: string,
    userId: string,
    input: CreateWorkspaceInput,
  ): Promise<WorkspaceResponseDTO> {
    const record = await this.workspaceRepository.createWorkspace(
      {
        tenantId,
        businessName: input.businessName,
        addressLine1: input.addressLine1,
        addressLine2: input.addressLine2,
        city: input.city,
        state: input.state,
        zipCode: input.zipCode,
        phone: input.phone,
      },
      userId,
    );

    return this.formatWorkspace(record, 1);
  }

  /**
   * Update an existing workspace.
   */
  async updateWorkspace(
    workspaceId: string,
    tenantId: string,
    input: Partial<CreateWorkspaceInput>,
  ): Promise<WorkspaceResponseDTO> {
    const existing = await this.workspaceRepository.findWorkspaceById(workspaceId, tenantId);
    if (!existing) {
      throw new NotFoundError("Workspace");
    }

    const updated = await this.workspaceRepository.updateWorkspace(workspaceId, tenantId, input);
    return this.formatWorkspace(updated, 0);
  }
}

