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
  settings?: {
    latitude: number;
    longitude: number;
    radiusMeters: number;
    graceMinutes: number | null;
  } | null;
  createdAt?: string;
}

export class WorkspaceService {
  constructor(private workspaceRepository: WorkspaceRepository) {}

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
}

