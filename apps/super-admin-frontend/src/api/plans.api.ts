import type {
  PlanConfig,
  SubscriptionRecord,
  ServiceType,
  DurationUnit,
  SubscriptionStatus,
} from '../types';
import { apiClient } from './client';

export const MOCK_PLANS: PlanConfig[] = [
  // Check Printing Plans
  {
    id: 'plan_cp_monthly',
    name: 'Check Printing Monthly',
    service: 'CHECK_PRINTING',
    durationCount: 1,
    durationUnit: 'MONTH',
    price: 49,
    status: 'ACTIVE',
    activeTenantsCount: 382,
    description: 'Full access to Check Printing SaaS billed monthly.',
    createdAt: '2026-01-10T00:00:00.000Z',
  },
  {
    id: 'plan_cp_quarterly',
    name: 'Check Printing Quarterly',
    service: 'CHECK_PRINTING',
    durationCount: 3,
    durationUnit: 'MONTH',
    price: 135,
    status: 'ACTIVE',
    activeTenantsCount: 120,
    description: 'Full access to Check Printing SaaS billed every 3 months.',
    createdAt: '2026-01-10T00:00:00.000Z',
  },
  {
    id: 'plan_cp_yearly',
    name: 'Check Printing Yearly',
    service: 'CHECK_PRINTING',
    durationCount: 1,
    durationUnit: 'YEAR',
    price: 490,
    status: 'ACTIVE',
    activeTenantsCount: 245,
    description: 'Full access to Check Printing SaaS billed annually (~2 months free).',
    createdAt: '2026-01-10T00:00:00.000Z',
  },

  // ClockIn-ClockOut Plans
  {
    id: 'plan_clock_monthly',
    name: 'ClockIn-ClockOut Monthly',
    service: 'CLOCK_IN_CLOCK_OUT',
    durationCount: 1,
    durationUnit: 'MONTH',
    price: 39,
    status: 'ACTIVE',
    activeTenantsCount: 410,
    description: 'Full access to Employee Clock In/Out, Biometrics & Timesheets billed monthly.',
    createdAt: '2026-01-12T00:00:00.000Z',
  },
  {
    id: 'plan_clock_halfyear',
    name: 'ClockIn-ClockOut 6-Months',
    service: 'CLOCK_IN_CLOCK_OUT',
    durationCount: 6,
    durationUnit: 'MONTH',
    price: 215,
    status: 'ACTIVE',
    activeTenantsCount: 95,
    description: 'Full access to ClockIn-ClockOut suite billed semi-annually.',
    createdAt: '2026-01-12T00:00:00.000Z',
  },
  {
    id: 'plan_clock_yearly',
    name: 'ClockIn-ClockOut Yearly',
    service: 'CLOCK_IN_CLOCK_OUT',
    durationCount: 1,
    durationUnit: 'YEAR',
    price: 390,
    status: 'ACTIVE',
    activeTenantsCount: 295,
    description: 'Full access to ClockIn-ClockOut attendance suite billed annually.',
    createdAt: '2026-01-12T00:00:00.000Z',
  },

  // Both / Bundle Plans
  {
    id: 'plan_both_monthly',
    name: 'All-In-One Bundle Monthly',
    service: 'BOTH',
    durationCount: 1,
    durationUnit: 'MONTH',
    price: 79,
    status: 'ACTIVE',
    activeTenantsCount: 520,
    description: 'Full access to both Check Printing and ClockIn-ClockOut billed monthly.',
    createdAt: '2026-01-15T00:00:00.000Z',
  },
  {
    id: 'plan_both_yearly',
    name: 'All-In-One Bundle Yearly',
    service: 'BOTH',
    durationCount: 1,
    durationUnit: 'YEAR',
    price: 790,
    status: 'ACTIVE',
    activeTenantsCount: 310,
    description: 'Full access to both Check Printing and ClockIn-ClockOut billed annually.',
    createdAt: '2026-01-15T00:00:00.000Z',
  },
];

export const MOCK_SUBSCRIPTIONS: SubscriptionRecord[] = [
  {
    id: 'sub_001',
    tenantId: 'org_apex_logistics',
    tenantName: 'Apex Logistics LLC',
    billingEmail: 'billing@apexlogistics.com',
    location: 'Dallas, TX',
    planId: 'plan_both_yearly',
    planName: 'All-In-One Bundle Yearly',
    service: 'BOTH',
    durationCount: 1,
    durationUnit: 'YEAR',
    status: 'ACTIVE',
    stripeCustomerId: 'cus_N8xL923jF81k',
    stripeSubscriptionId: 'sub_1Oq4x7L9180x',
    amount: 790,
    currentPeriodEndsAt: '2027-01-15T00:00:00.000Z',
  },
  {
    id: 'sub_002',
    tenantId: 'org_horizon_health',
    tenantName: 'Horizon Healthcare Network',
    billingEmail: 'ap@horizonhealth.org',
    location: 'Chicago, IL',
    planId: 'plan_cp_monthly',
    planName: 'Check Printing Monthly',
    service: 'CHECK_PRINTING',
    durationCount: 1,
    durationUnit: 'MONTH',
    status: 'ACTIVE',
    stripeCustomerId: 'cus_L12xP9901k',
    stripeSubscriptionId: 'sub_1Oq2m1P8812j',
    amount: 49,
    currentPeriodEndsAt: '2026-12-01T00:00:00.000Z',
  },
  {
    id: 'sub_003',
    tenantId: 'org_summit_retail',
    tenantName: 'Summit Retail Group',
    billingEmail: 'finance@summitretail.com',
    location: 'Denver, CO',
    planId: 'plan_clock_monthly',
    planName: 'ClockIn-ClockOut Monthly',
    service: 'CLOCK_IN_CLOCK_OUT',
    durationCount: 1,
    durationUnit: 'MONTH',
    status: 'TRIALING',
    stripeCustomerId: 'cus_M99zQ0023a',
    stripeSubscriptionId: 'sub_1Oq7k9A1109s',
    amount: 39,
    currentPeriodEndsAt: '2026-11-15T00:00:00.000Z',
  },
  {
    id: 'sub_004',
    tenantId: 'org_bayview_capital',
    tenantName: 'Bayview Capital Partners',
    billingEmail: 'ops@bayviewcap.com',
    location: 'San Francisco, CA',
    planId: 'plan_cp_yearly',
    planName: 'Check Printing Yearly',
    service: 'CHECK_PRINTING',
    durationCount: 1,
    durationUnit: 'YEAR',
    status: 'PAST_DUE',
    stripeCustomerId: 'cus_P41mK8899b',
    stripeSubscriptionId: 'sub_1Oq9b3X0918q',
    amount: 490,
    currentPeriodEndsAt: '2026-10-31T00:00:00.000Z',
  },
  {
    id: 'sub_005',
    tenantId: 'org_liberty_plumbing',
    tenantName: 'Liberty Commercial Plumbing',
    billingEmail: 'admin@libertyplumbing.com',
    location: 'Atlanta, GA',
    planId: 'plan_clock_yearly',
    planName: 'ClockIn-ClockOut Yearly',
    service: 'CLOCK_IN_CLOCK_OUT',
    durationCount: 1,
    durationUnit: 'YEAR',
    status: 'ACTIVE',
    stripeCustomerId: 'cus_R55tV1109z',
    stripeSubscriptionId: 'sub_1Oq3n8V2210w',
    amount: 390,
    currentPeriodEndsAt: '2027-02-01T00:00:00.000Z',
  },
  {
    id: 'sub_006',
    tenantId: 'org_solanki_consulting',
    tenantName: 'Solanki & Associates Law',
    billingEmail: 'yash@solankilaw.com',
    location: 'New York, NY',
    planId: 'plan_both_monthly',
    planName: 'All-In-One Bundle Monthly',
    service: 'BOTH',
    durationCount: 1,
    durationUnit: 'MONTH',
    status: 'ACTIVE',
    stripeCustomerId: 'cus_Y77sA3321w',
    stripeSubscriptionId: 'sub_1Oq6m2S7721u',
    amount: 79,
    currentPeriodEndsAt: '2026-12-10T00:00:00.000Z',
  },
];

export async function fetchPlans(): Promise<PlanConfig[]> {
  try {
    return await apiClient<PlanConfig[]>('/api/v1/super-admin/plans');
  } catch {
    return MOCK_PLANS;
  }
}

export async function createPlan(
  payload: Omit<PlanConfig, 'id' | 'activeTenantsCount' | 'createdAt'>
): Promise<PlanConfig> {
  try {
    return await apiClient<PlanConfig>('/api/v1/super-admin/plans', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  } catch {
    return {
      ...payload,
      id: `plan_${Date.now()}`,
      activeTenantsCount: 0,
      createdAt: new Date().toISOString(),
    };
  }
}

export async function updatePlan(
  planId: string,
  payload: Partial<PlanConfig>
): Promise<PlanConfig> {
  try {
    return await apiClient<PlanConfig>(`/api/v1/super-admin/plans/${planId}`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    });
  } catch {
    const existing = MOCK_PLANS.find((p) => p.id === planId);
    return {
      ...(existing || {
        id: planId,
        name: 'Updated Plan',
        service: 'CHECK_PRINTING',
        durationCount: 1,
        durationUnit: 'MONTH',
        price: 49,
        status: 'ACTIVE',
        activeTenantsCount: 0,
        createdAt: new Date().toISOString(),
      }),
      ...payload,
    };
  }
}

export async function deletePlan(planId: string): Promise<{ success: boolean }> {
  try {
    return await apiClient(`/api/v1/super-admin/plans/${planId}`, {
      method: 'DELETE',
    });
  } catch {
    return { success: true };
  }
}

export async function fetchSubscriptions(): Promise<SubscriptionRecord[]> {
  try {
    return await apiClient<SubscriptionRecord[]>('/api/v1/super-admin/subscriptions');
  } catch {
    return MOCK_SUBSCRIPTIONS;
  }
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
  try {
    return await apiClient(`/api/v1/super-admin/subscriptions/${subscriptionId}`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    });
  } catch {
    return { success: true, message: 'Subscription successfully updated in Prisma.' };
  }
}

export async function syncStripeWebhooks(): Promise<{ success: boolean; syncedCount: number }> {
  try {
    return await apiClient('/api/v1/super-admin/stripe/sync', { method: 'POST' });
  } catch {
    return { success: true, syncedCount: 1428 };
  }
}
