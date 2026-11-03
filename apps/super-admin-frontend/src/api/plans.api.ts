import type {
  PlanConfig,
  SubscriptionRecord,
  ServiceType,
  DurationUnit,
  SubscriptionStatus,
  PaginatedResponse,
} from '../types';
import { apiClient } from './client';

export async function fetchPlans(): Promise<PlanConfig[]> {
  const res = await apiClient<PlanConfig[]>('/api/v1/super-admin/plans');
  return Array.isArray(res) ? res : [];
}

export async function createPlan(
  payload: Omit<PlanConfig, 'id' | 'activeTenantsCount' | 'createdAt'>
): Promise<PlanConfig> {
  return await apiClient<PlanConfig>('/api/v1/super-admin/plans', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function updatePlan(
  planId: string,
  payload: Partial<PlanConfig>
): Promise<PlanConfig> {
  return await apiClient<PlanConfig>(`/api/v1/super-admin/plans/${planId}`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  });
}

export async function deletePlan(planId: string): Promise<{ success: boolean }> {
  return await apiClient<{ success: boolean }>(`/api/v1/super-admin/plans/${planId}`, {
    method: 'DELETE',
  });
}

export interface FetchSubscriptionsParams {
  page?: number;
  pageSize?: number;
  status?: string;
  service?: string;
}

export async function fetchSubscriptions(
  params?: FetchSubscriptionsParams
): Promise<PaginatedResponse<SubscriptionRecord>> {
  const queryParams: Record<string, string | number | undefined> = {};
  if (params?.page) queryParams.page = params.page;
  if (params?.pageSize) queryParams.pageSize = params.pageSize;
  if (params?.status && params.status !== 'ALL') queryParams.status = params.status;
  if (params?.service && params.service !== 'ALL') queryParams.service = params.service;

  const res = await apiClient<PaginatedResponse<SubscriptionRecord> | SubscriptionRecord[]>(
    '/api/v1/super-admin/subscriptions',
    { params: queryParams }
  );

  if (res && typeof res === 'object' && 'items' in res) {
    return res as PaginatedResponse<SubscriptionRecord>;
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

export async function updateSubscription(
  subscriptionId: string,
  payload: {
    planId: string;
    planName: string;
    service: ServiceType;
    durationCount: number;
    durationUnit: DurationUnit;
    status: SubscriptionStatus;
    amount: number;
  }
): Promise<{ success: boolean; message: string }> {
  return await apiClient<{ success: boolean; message: string }>(
    `/api/v1/super-admin/subscriptions/${subscriptionId}`,
    {
      method: 'PATCH',
      body: JSON.stringify(payload),
    }
  );
}

export async function syncStripeWebhooks(): Promise<{ success: boolean; syncedCount: number }> {
  return await apiClient<{ success: boolean; syncedCount: number }>(
    '/api/v1/super-admin/stripe/sync',
    { method: 'POST' }
  );
}
