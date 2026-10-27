import { RequestStatus } from './api.models';

/**
 * The statuses a request can move to from each status (D-05), used ONLY to decide which choices the menu offers.
 * The server is the authority: it checks every change and answers 422 with the real `allowedStatuses`, so a
 * stale copy here can offer a choice the server refuses, but can never allow an illegal change.
 *
 * A copy of `StatusTransitions` in the backend (BL). Kept in step by a unit test that spells out all 16 combinations.
 */
const ALLOWED_TRANSITIONS: Record<RequestStatus, readonly RequestStatus[]> = {
  New: ['InProgress', 'Waiting'],
  InProgress: ['Waiting', 'Completed'],
  Waiting: ['InProgress', 'Completed'],
  Completed: [],
};

/** The statuses the request can be moved to (empty for a completed request, which is final). */
export function allowedNext(status: RequestStatus): readonly RequestStatus[] {
  return ALLOWED_TRANSITIONS[status];
}
