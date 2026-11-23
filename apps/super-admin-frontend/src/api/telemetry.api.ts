import type { ErrorLogRecord, PaginatedResponse } from '../types';
import { apiClient } from './client';

export interface FetchTelemetryLogsParams {
  page?: number;
  pageSize?: number;
  search?: string;
  severity?: string;
  service?: string;
}

export async function fetchTelemetryLogs(
  params?: FetchTelemetryLogsParams
): Promise<PaginatedResponse<ErrorLogRecord>> {
  const queryParams: Record<string, string | number | undefined> = {};
  if (params?.page) queryParams.page = params.page;
  if (params?.pageSize) queryParams.pageSize = params.pageSize;
  if (params?.search) queryParams.search = params.search;
  if (params?.severity && params.severity !== 'ALL') queryParams.severity = params.severity;
  if (params?.service && params.service !== 'ALL') queryParams.service = params.service;

  const res = await apiClient<PaginatedResponse<ErrorLogRecord> | ErrorLogRecord[]>(
    '/api/v1/super-admin/telemetry',
    { params: queryParams }
  );

  if (res && typeof res === 'object' && 'items' in res) {
    return res as PaginatedResponse<ErrorLogRecord>;
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
