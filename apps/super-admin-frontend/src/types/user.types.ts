import type { ServiceType } from './plan.types';

export type TenantRole = 'OWNER';

export type UserStatus = 'ACTIVE' | 'LOCKED' | 'SUSPENDED';

export interface WorkspaceSummary {
  id: string;
  businessName: string;
  address: string;
  city: string;
  state: string;
  zipCode: string;
  bankAccountsCount: number;
}

export interface AdminUserRecord {
  id: string;
  fullName: string;
  email: string;
  isActive: boolean;
  tenantId: string;
  tenantName: string;
  tenantRole: TenantRole;
  status: UserStatus;
  workspacesCount: number;
  workspaces?: WorkspaceSummary[];
  city: string;
  state: string;
  lastLoginAt: string;
  lastIpAddress: string;
  failedLoginCount: number;
  lockedUntil?: string | null;
  serviceType: ServiceType;
  planName: string;
  planPrice: number;
  planDuration: string;
}
