import { HttpErrorResponse } from '@angular/common/http';

import { REQUEST_STATUSES, RequestDto, RequestStatus } from '../../core/api/api.models';
import { describeHttpError } from '../../core/api/error-messages';
import { STATUS_LABELS } from '../../core/i18n/labels';
import { isProblemDetails } from '../../core/api/problem-details';

/** What the server says the request looks like now (the extra members of a 409 and a 422). */
export interface CurrentRequestState {
  status: RequestStatus;
  version: string;
  /** Only the 409 carries it. */
  updatedAt?: string;
}

/** Why a status change did not happen, with the Hebrew message to show. */
export type StatusUpdateFailure =
  /** 409: someone else changed the request since it was read. `current` is what it looks like now. */
  | { kind: 'conflict'; message: string; current: CurrentRequestState | null }
  /** 422: the change is not allowed from the current status. */
  | {
      kind: 'invalid-transition';
      message: string;
      current: CurrentRequestState | null;
      allowedStatuses: RequestStatus[];
    }
  | { kind: 'not-found'; message: string }
  | { kind: 'error'; message: string };

export type StatusChangeOutcome = { kind: 'updated'; request: RequestDto } | StatusUpdateFailure;

/** Turns the failed PATCH into an outcome the UI can act on. Pure: the same error always gives the same result. */
export function toStatusUpdateFailure(error: unknown): StatusUpdateFailure {
  if (!(error instanceof HttpErrorResponse)) {
    return { kind: 'error', message: describeHttpError(error) };
  }

  switch (error.status) {
    case 409:
      return {
        kind: 'conflict',
        message: 'הפנייה עודכנה בינתיים על ידי משתמש אחר. הנתונים רועננו – אפשר לנסות שוב.',
        current: readCurrentState(error.error),
      };
    case 422: {
      const allowedStatuses = readAllowedStatuses(error.error);
      return {
        kind: 'invalid-transition',
        message: describeAllowed(allowedStatuses),
        current: readCurrentState(error.error),
        allowedStatuses,
      };
    }
    case 404:
      return { kind: 'not-found', message: 'הפנייה לא נמצאה, ייתכן שנמחקה. הרשימה נטענת מחדש.' };
    default:
      return { kind: 'error', message: describeHttpError(error) };
  }
}

/** The summary is refreshed when the server may have changed data (and so dropped its cache): after a change and after a 409. */
export function refreshesSummary(outcome: StatusChangeOutcome): boolean {
  return outcome.kind === 'updated' || outcome.kind === 'conflict';
}

/** The row as the server says it is now. A member that is missing keeps the value the row has. */
export function withCurrentState(row: RequestDto, current: CurrentRequestState): RequestDto {
  return { ...row, status: current.status, version: current.version, updatedAt: current.updatedAt ?? row.updatedAt };
}

function describeAllowed(allowed: RequestStatus[]): string {
  return allowed.length > 0
    ? `המעבר אינו מותר מהסטטוס הנוכחי. מעברים מותרים: ${allowed.map((s) => STATUS_LABELS[s]).join(', ')}.`
    : 'המעבר אינו מותר: הפנייה הושלמה והסטטוס שלה סופי.';
}

function readCurrentState(body: unknown): CurrentRequestState | null {
  if (!isProblemDetails(body)) {
    return null;
  }
  const status = toStatus(body['currentStatus']);
  const version = body['currentVersion'];
  if (!status || typeof version !== 'string') {
    return null;
  }
  const updatedAt = body['currentUpdatedAt'];
  return typeof updatedAt === 'string' ? { status, version, updatedAt } : { status, version };
}

function readAllowedStatuses(body: unknown): RequestStatus[] {
  const list = isProblemDetails(body) ? body['allowedStatuses'] : undefined;
  return Array.isArray(list) ? list.map(toStatus).filter((s): s is RequestStatus => s !== null) : [];
}

function toStatus(value: unknown): RequestStatus | null {
  return REQUEST_STATUSES.find((status) => status === value) ?? null;
}
