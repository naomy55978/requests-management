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

/** GET /api/requests/summary: counts over the whole table (the server caches it for 60 seconds, D-11). */
export interface SummaryDto {
  total: number;
  byStatus: { status: RequestStatus; count: number }[];
  byPriority: { priority: RequestPriority; count: number }[];
  /** The organizations with the most open (not completed) requests, most first. */
  topOrganizations: { organizationName: string; openRequests: number }[];
}

/** Body of PATCH /api/requests/{id}/status. `version` is the one the user saw; the server rejects an older one (409). */
export interface StatusChangeBody {
  newStatus: RequestStatus;
  version: string;
}

/** The most items one POST /api/requests/bulk-status accepts (the API answers 400 above it). */
export const BULK_MAX_ITEMS = 100;

export type BulkOutcome = 'Updated' | 'NotFound' | 'Conflict' | 'InvalidTransition';

export interface BulkItem {
  id: number;
  /** The version the user saw; an older one makes that item a Conflict. */
  version: string;
}

export interface BulkStatusBody {
  newStatus: RequestStatus;
  items: BulkItem[];
}

/** The result of ONE item of a Bulk call. Members that do not apply to the outcome are missing. */
export interface BulkItemResult {
  id: number;
  outcome: BulkOutcome;
  /** Updated: the request as it is now, with its new version. */
  request?: RequestDto;
  /** Conflict and InvalidTransition: how the request looks now. */
  currentStatus?: RequestStatus;
  currentVersion?: string;
  currentUpdatedAt?: string;
  /** InvalidTransition: where the request can go from its current status. */
  allowedStatuses?: RequestStatus[];
}

/** 200 of POST /api/requests/bulk-status: Partial Success, one result per item in the order sent (D-08, D-19). */
export interface BulkStatusResponse {
  total: number;
  succeeded: number;
  failed: number;
  results: BulkItemResult[];
}
