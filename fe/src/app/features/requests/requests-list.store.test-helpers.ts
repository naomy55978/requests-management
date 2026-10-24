import { Observable, Subscriber } from 'rxjs';

import { PagedResult, RequestDto, RequestListQuery, SummaryDto } from '../../core/api/api.models';

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

  return { calls, summaryCalls, api: { list: vi.fn(list), summary: vi.fn(summary) } };
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
