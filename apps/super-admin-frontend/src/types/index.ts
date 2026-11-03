export * from './plan.types';
export * from './user.types';
export * from './telemetry.types';
export * from './dashboard.types';

export interface PaginationMeta {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

export interface PaginatedResponse<T> {
  items: T[];
  pagination: PaginationMeta;
}
