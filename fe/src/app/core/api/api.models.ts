// Types that match the backend DTOs (requests-management-be, project RequestsManagement.DTO).
// Enums travel as strings, `version` is the base64 row version, dates are ISO-8601 strings in UTC.

export type RequestStatus = 'New' | 'InProgress' | 'Waiting' | 'Completed';
export type RequestPriority = 'Low' | 'Medium' | 'High';
export type RequestSortField = 'createdAt' | 'updatedAt' | 'priority' | 'status' | 'title';
export type SortDirection = 'asc' | 'desc';

export const REQUEST_STATUSES: readonly RequestStatus[] = ['New', 'InProgress', 'Waiting', 'Completed'];
export const REQUEST_PRIORITIES: readonly RequestPriority[] = ['Low', 'Medium', 'High'];

export interface RequestDto {
  id: number;
  title: string;
  organizationName: string;
  status: RequestStatus;
  priority: RequestPriority;
  assignedTo: string | null;
  createdAt: string;
  updatedAt: string;
  version: string;
}

export interface PagedResult<T> {
  items: T[];
  page: number;
  pageSize: number;
  totalCount: number;
  totalPages: number;
}

/** Value of the `assignedTo` query parameter that selects requests without a handler. */
export const UNASSIGNED = 'unassigned';

/** All query parameters of GET /api/requests, as the UI holds them. Empty values are not sent. */
export interface RequestListQuery {
  page: number;
  pageSize: number;
  status: RequestStatus[];
  priority: RequestPriority[];
  organization: string;
  /** A user name, or {@link UNASSIGNED}. */
  assignedTo: string;
  /** First creation day, `yyyy-MM-dd` (UTC day, inclusive). */
  createdFrom: string | null;
  /** Last creation day, `yyyy-MM-dd` (UTC day, inclusive). */
  createdTo: string | null;
  search: string;
  sortBy: RequestSortField;
  sortDir: SortDirection;
}

export interface LoginRequest {
  userName: string;
  password: string;
}

export interface LoginResponse {
  accessToken: string;
  expiresAt: string;
  userName: string;
  displayName: string;
}
