import type { AdminUserRecord } from '../types';
import { apiClient } from './client';

export const MOCK_ADMIN_USERS: AdminUserRecord[] = [
  {
    id: 'usr_84920489',
    fullName: 'Marcus Vance',
    email: 'marcus@apexholdings.us',
    isActive: true,
    tenantId: 'tenant_apex_84920489',
    tenantName: 'Apex Holdings LLC',
    tenantRole: 'OWNER',
    status: 'ACTIVE',
    workspacesCount: 3,
    city: 'Austin',
    state: 'TX',
    lastLoginAt: new Date(Date.now() - 10 * 60 * 1000).toISOString(),
    lastIpAddress: '64.124.18.29',
    failedLoginCount: 0,
    serviceType: 'BOTH',
    planName: 'Enterprise All-Access Bundle',
    planPrice: 299,
    planDuration: 'Monthly (1 Month)',
    workspaces: [
      {
        id: 'ws_77192',
        businessName: 'Austin Corporate HQ',
        address: '100 Congress Ave, Suite 200',
        city: 'Austin',
        state: 'TX',
        zipCode: '78701',
        bankAccountsCount: 2,
      },
      {
        id: 'ws_77193',
        businessName: 'Dallas Distribution Hub',
        address: '2400 Elm St',
        city: 'Dallas',
        state: 'TX',
        zipCode: '75201',
        bankAccountsCount: 1,
      },
      {
        id: 'ws_77194',
        businessName: 'Houston Regional Office',
        address: '1000 Louisiana St',
        city: 'Houston',
        state: 'TX',
        zipCode: '77002',
        bankAccountsCount: 1,
      },
    ],
  },
  {
    id: 'usr_99302144',
    fullName: 'Dr. Sarah Jenkins',
    email: 's.jenkins@beaconhealth.org',
    isActive: true,
    tenantId: 'tenant_beacon_99302144',
    tenantName: 'Beacon Healthcare Group',
    tenantRole: 'OWNER',
    status: 'ACTIVE',
    workspacesCount: 8,
    city: 'Miami',
    state: 'FL',
    lastLoginAt: new Date(Date.now() - 65 * 60 * 1000).toISOString(),
    lastIpAddress: '73.189.44.102',
    failedLoginCount: 0,
    serviceType: 'CLOCK_IN_CLOCK_OUT',
    planName: 'ClockIn-ClockOut Annual Pass',
    planPrice: 390,
    planDuration: 'Annual (1 Year)',
    workspaces: [
      {
        id: 'ws_88201',
        businessName: 'Miami Urgent Care Central',
        address: '1501 NW 9th Ave',
        city: 'Miami',
        state: 'FL',
        zipCode: '33136',
        bankAccountsCount: 3,
      },
      {
        id: 'ws_88202',
        businessName: 'Fort Lauderdale Clinic',
        address: '1600 S Federal Hwy',
        city: 'Fort Lauderdale',
        state: 'FL',
        zipCode: '33316',
        bankAccountsCount: 2,
      },
    ],
  },
  {
    id: 'usr_33109281',
    fullName: 'David Thorne',
    email: 'dthorne@pacificcoast.com',
    isActive: false,
    tenantId: 'tenant_pacific_33109281',
    tenantName: 'Pacific Coast Logistics',
    tenantRole: 'OWNER',
    status: 'LOCKED',
    workspacesCount: 2,
    city: 'Seattle',
    state: 'WA',
    lastLoginAt: new Date(Date.now() - 5 * 60 * 1000).toISOString(),
    lastIpAddress: '198.51.100.41',
    failedLoginCount: 5,
    lockedUntil: new Date(Date.now() + 25 * 60 * 1000).toISOString(),
    serviceType: 'CHECK_PRINTING',
    planName: 'Check Printing Monthly',
    planPrice: 49,
    planDuration: 'Monthly (1 Month)',
    workspaces: [
      {
        id: 'ws_99101',
        businessName: 'Seattle Port Logistics Yard',
        address: '2900 11th Ave SW',
        city: 'Seattle',
        state: 'WA',
        zipCode: '98134',
        bankAccountsCount: 1,
      },
    ],
  },
  {
    id: 'usr_47182903',
    fullName: 'Elena Rostova',
    email: 'elena@tristate-elec.com',
    isActive: true,
    tenantId: 'tenant_tristate_47182903',
    tenantName: 'Tri-State Electrical Corp',
    tenantRole: 'OWNER',
    status: 'ACTIVE',
    workspacesCount: 4,
    city: 'Newark',
    state: 'NJ',
    lastLoginAt: new Date(Date.now() - 180 * 60 * 1000).toISOString(),
    lastIpAddress: '24.180.99.12',
    failedLoginCount: 0,
    serviceType: 'BOTH',
    planName: 'Enterprise All-Access Bundle',
    planPrice: 299,
    planDuration: 'Monthly (1 Month)',
    workspaces: [
      {
        id: 'ws_44101',
        businessName: 'Newark Contracting HQ',
        address: '570 Broad St',
        city: 'Newark',
        state: 'NJ',
        zipCode: '07102',
        bankAccountsCount: 2,
      },
    ],
  },
  {
    id: 'usr_55210984',
    fullName: 'Robert Sterling',
    email: 'r.sterling@sterlingcap.com',
    isActive: true,
    tenantId: 'tenant_sterling_55210984',
    tenantName: 'Sterling Capital Partners',
    tenantRole: 'OWNER',
    status: 'ACTIVE',
    workspacesCount: 5,
    city: 'Chicago',
    state: 'IL',
    lastLoginAt: new Date(Date.now() - 420 * 60 * 1000).toISOString(),
    lastIpAddress: '12.174.55.90',
    failedLoginCount: 0,
    serviceType: 'CHECK_PRINTING',
    planName: 'Check Printing Annual Pass',
    planPrice: 490,
    planDuration: 'Annual (1 Year)',
    workspaces: [
      {
        id: 'ws_55101',
        businessName: 'Chicago Financial District Branch',
        address: '233 S Wacker Dr, Suite 4400',
        city: 'Chicago',
        state: 'IL',
        zipCode: '60606',
        bankAccountsCount: 4,
      },
    ],
  },
];

export async function fetchAdminUsers(): Promise<AdminUserRecord[]> {
  try {
    return await apiClient<AdminUserRecord[]>('/api/v1/super-admin/users');
  } catch {
    return MOCK_ADMIN_USERS;
  }
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
  serviceType: import('../types').ServiceType;
  planName: string;
  planPrice: number;
  planDuration: string;
}

export async function createOrganization(payload: CreateOrganizationPayload): Promise<AdminUserRecord> {
  try {
    return await apiClient<AdminUserRecord>('/api/v1/super-admin/organizations', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  } catch {
    const newRecord: AdminUserRecord = {
      id: `usr_${Math.random().toString(36).slice(2, 10)}`,
      fullName: payload.fullName,
      email: payload.email,
      isActive: true,
      tenantId: `tenant_${payload.tenantName.toLowerCase().replace(/[^a-z0-9]/g, '_')}_${Math.random().toString(36).slice(2, 8)}`,
      tenantName: payload.tenantName,
      tenantRole: 'OWNER',
      status: 'ACTIVE',
      workspacesCount: 1,
      city: payload.city,
      state: payload.state,
      lastLoginAt: new Date().toISOString(),
      lastIpAddress: '127.0.0.1',
      failedLoginCount: 0,
      serviceType: payload.serviceType,
      planName: payload.planName,
      planPrice: payload.planPrice,
      planDuration: payload.planDuration,
      workspaces: [
        {
          id: `ws_${Math.random().toString(36).slice(2, 8)}`,
          businessName: payload.workspaceName || `${payload.tenantName} HQ`,
          address: payload.workspaceAddress || '100 Main St',
          city: payload.city,
          state: payload.state,
          zipCode: payload.zipCode || '10001',
          bankAccountsCount: 0,
        },
      ],
    };
    return newRecord;
  }
}

export async function unlockUser(userId: string): Promise<{ success: boolean }> {
  try {
    return await apiClient<{ success: boolean }>(`/api/v1/super-admin/users/${userId}/unlock`, {
      method: 'POST',
    });
  } catch {
    return { success: true };
  }
}
