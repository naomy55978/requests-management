import { Observable, Subscriber } from 'rxjs';

import { PagedResult, RequestDto, RequestListQuery } from '../../core/api/api.models';

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

  return { calls, api: { list: vi.fn(list) } };
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
