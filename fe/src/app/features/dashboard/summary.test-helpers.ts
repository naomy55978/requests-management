import { Observable, Subscriber } from 'rxjs';

import { SummaryDto } from '../../core/api/api.models';

/** One call to the (fake) summary endpoint, answered by hand like the list calls of the requests tests. */
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

/** A fake API with only the summary endpoint, for the dashboard tests. */
export function createFakeSummaryApi() {
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

  return { summaryCalls, api: { summary: vi.fn(summary) } };
}
