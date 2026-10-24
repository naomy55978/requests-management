import { Observable, Subscriber } from 'rxjs';

import {
  BulkItem,
  BulkStatusResponse,
  PagedResult,
  RequestDto,
  RequestListQuery,
  RequestStatus,
  SummaryDto,
} from '../../core/api/api.models';

/** One status change sent to the (fake) API, answered by hand. */
export interface FakeStatusCall {
  id: number;
  newStatus: RequestStatus;
  version: string;
  cancelled: boolean;
  respond(request: RequestDto): void;
  fail(error: unknown): void;
}

/** One Bulk call sent to the (fake) API, answered by hand. */
export interface FakeBulkCall {
  newStatus: RequestStatus;
  items: BulkItem[];
  cancelled: boolean;
  respond(response: BulkStatusResponse): void;
  fail(error: unknown): void;
}

/** One call to the (fake) summary endpoint, answered by hand like {@link FakeCall}. */
export interface FakeSummaryCall {
  cancelled: boolean;
  respond(summary?: SummaryDto): void;
  fail(error: unknown): void;
}

export function fakeSummary(): SummaryDto {
  return {
    total: 1234,
    byStatus: [
      { status: 'New', count: 100 },
      { status: 'InProgress', count: 200 },
      { status: 'Waiting', count: 300 },
      { status: 'Completed', count: 634 },
    ],
    byPriority: [
      { priority: 'Low', count: 400 },
      { priority: 'Medium', count: 500 },
      { priority: 'High', count: 334 },
    ],
    topOrganizations: [
      { organizationName: 'גליל לוגיסטיקה בע״מ', openRequests: 40 },
      { organizationName: 'Cedar Software Ltd', openRequests: 20 },
    ],
  };
}

/** One call the store made to the (fake) API, which the test answers by hand. */
export interface FakeCall {
  query: RequestListQuery;
  /** True when the store unsubscribed before the call was answered (= the HTTP request would be cancelled). */
  cancelled: boolean;
  respond(items?: RequestDto[], totalCount?: number): void;
  fail(error: unknown): void;
}

export function createFakeApi() {
  const calls: FakeCall[] = [];

  const list = (query: RequestListQuery) =>
    new Observable<PagedResult<RequestDto>>((subscriber: Subscriber<PagedResult<RequestDto>>) => {
      let answered = false;
      const call: FakeCall = {
        query,
        cancelled: false,
        respond: (items = [], totalCount = items.length) => {
          answered = true;
          subscriber.next({
            items,
            page: query.page,
            pageSize: query.pageSize,
            totalCount,
            totalPages: Math.ceil(totalCount / query.pageSize),
          });
          subscriber.complete();
        },
        fail: (error) => {
          answered = true;
          subscriber.error(error);
        },
      };
      calls.push(call);
      return () => {
        if (!answered) {
          call.cancelled = true;
        }
      };
    });

  const summaryCalls: FakeSummaryCall[] = [];
  const statusCalls: FakeStatusCall[] = [];
  const bulkCalls: FakeBulkCall[] = [];

  const bulkChangeStatus = (newStatus: RequestStatus, items: BulkItem[]) =>
    new Observable<BulkStatusResponse>((subscriber: Subscriber<BulkStatusResponse>) => {
      let answered = false;
      const call: FakeBulkCall = {
        newStatus,
        items,
        cancelled: false,
        respond: (response) => {
          answered = true;
          subscriber.next(response);
          subscriber.complete();
        },
        fail: (error) => {
          answered = true;
          subscriber.error(error);
        },
      };
      bulkCalls.push(call);
      return () => {
        if (!answered) {
          call.cancelled = true;
        }
      };
    });

  const changeStatus = (id: number, newStatus: RequestStatus, version: string) =>
    new Observable<RequestDto>((subscriber: Subscriber<RequestDto>) => {
      let answered = false;
      const call: FakeStatusCall = {
        id,
        newStatus,
        version,
        cancelled: false,
        respond: (request) => {
          answered = true;
          subscriber.next(request);
          subscriber.complete();
        },
        fail: (error) => {
          answered = true;
          subscriber.error(error);
        },
      };
      statusCalls.push(call);
      return () => {
        if (!answered) {
          call.cancelled = true;
        }
      };
    });

  const summary = () =>
    new Observable<SummaryDto>((subscriber: Subscriber<SummaryDto>) => {
      let answered = false;
      const call: FakeSummaryCall = {
        cancelled: false,
        respond: (data = fakeSummary()) => {
          answered = true;
          subscriber.next(data);
          subscriber.complete();
        },
        fail: (error) => {
          answered = true;
          subscriber.error(error);
        },
      };
      summaryCalls.push(call);
      return () => {
        if (!answered) {
          call.cancelled = true;
        }
      };
    });

  return {
    calls,
    summaryCalls,
    statusCalls,
    bulkCalls,
    api: { list: vi.fn(list), summary: vi.fn(summary), changeStatus: vi.fn(changeStatus), bulkChangeStatus: vi.fn(bulkChangeStatus) },
  };
}

export function fakeRequest(id: number): RequestDto {
  return {
    id,
    title: `Request ${id}`,
    organizationName: 'Acme',
    status: 'New',
    priority: 'Medium',
    assignedTo: null,
    createdAt: '2026-01-01T10:00:00Z',
    updatedAt: '2026-01-01T10:00:00Z',
    version: 'AAAAAAAAB9E=',
  };
}
