import type { AdminUserRecord, ServiceType, PaginatedResponse } from '../types';
import { apiClient } from './client';

export interface FetchAdminUsersParams {
  page?: number;
  pageSize?: number;
  search?: string;
  service?: string;
  status?: string;
}

export async function fetchAdminUsers(
  params?: FetchAdminUsersParams
): Promise<PaginatedResponse<AdminUserRecord>> {
  const queryParams: Record<string, string | number | undefined> = {};
  if (params?.page) queryParams.page = params.page;
  if (params?.pageSize) queryParams.pageSize = params.pageSize;
  if (params?.search) queryParams.search = params.search;
  if (params?.service && params.service !== 'ALL') queryParams.service = params.service;
  if (params?.status && params.status !== 'ALL') queryParams.status = params.status;

  const res = await apiClient<PaginatedResponse<AdminUserRecord> | AdminUserRecord[]>(
    '/api/v1/super-admin/users',
    { params: queryParams }
  );

  if (res && typeof res === 'object' && 'items' in res) {
    return res as PaginatedResponse<AdminUserRecord>;
  }

  const items = Array.isArray(res) ? res : [];
  return {
    items,
    pagination: {
      page: params?.page ?? 1,
      pageSize: params?.pageSize ?? (items.length || 10),
      total: items.length,
      totalPages: 1,
    },
  };
}

export interface CreateOrganizationPayload {
  tenantName: string;
  billingEmail: string;
  fullName: string;
  email: string;
  password?: string;
  city: string;
  state: string;
  workspaceName?: string;
  workspaceAddress?: string;
  zipCode?: string;
  serviceType: ServiceType;
  planName: string;
  planPrice: number;
  planDuration: string;
}

export async function createOrganization(payload: CreateOrganizationPayload): Promise<AdminUserRecord> {
  return await apiClient<AdminUserRecord>('/api/v1/super-admin/organizations', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function unlockUser(userId: string): Promise<{ success: boolean }> {
  return await apiClient<{ success: boolean }>(`/api/v1/super-admin/users/${userId}/unlock`, {
    method: 'POST',
  });
}
