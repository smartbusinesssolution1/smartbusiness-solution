export type ServiceType = 'CHECK_PRINTING' | 'CLOCK_IN_CLOCK_OUT' | 'BOTH';

export type DurationUnit = 'DAY' | 'MONTH' | 'YEAR';

export type SubscriptionStatus =
  | 'TRIALING'
  | 'ACTIVE'
  | 'PAST_DUE'
  | 'CANCELED'
  | 'EXPIRED';

export interface PlanConfig {
  id: string;
  name: string;
  service: ServiceType;
  durationCount: number;
  durationUnit: DurationUnit;
  price: number;
  status: 'ACTIVE' | 'INACTIVE';
  activeTenantsCount: number;
  description?: string;
  createdAt: string;
}

export interface SubscriptionRecord {
  id: string;
  tenantId: string;
  tenantName: string;
  billingEmail: string;
  location: string;
  planId: string;
  planName: string;
  service: ServiceType;
  durationCount: number;
  durationUnit: DurationUnit;
  status: SubscriptionStatus;
  stripeCustomerId: string;
  stripeSubscriptionId?: string;
  amount: number;
  currentPeriodEndsAt: string;
}
