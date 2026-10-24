import { BulkItemResult, BulkOutcome, BulkStatusResponse, REQUEST_STATUSES, RequestStatus } from '../../core/api/api.models';
import { STATUS_LABELS } from '../../core/i18n/labels';

/** What a Bulk call came to: the server's answer for every item, or the failure of the call itself (nothing was saved). */
export type BulkChangeOutcome =
  | { kind: 'done'; response: BulkStatusResponse; titles: ReadonlyMap<number, string> }
  | { kind: 'error'; message: string };

/** One line of the result table. */
export interface BulkResultRow {
  id: number;
  title: string;
  outcome: BulkOutcome;
  /** True only for "updated"; the others changed nothing. */
  success: boolean;
  /** The result in Hebrew, with the details the user needs to act (the current status, the allowed ones). */
  text: string;
}

/** Hebrew name of each outcome, for the counts. */
export const BULK_OUTCOME_LABELS: Record<BulkOutcome, string> = {
  Updated: 'עודכנו',
  NotFound: 'לא נמצאו',
  Conflict: 'עודכנו בינתיים על ידי אחר',
  InvalidTransition: 'מעבר אסור',
};

const OUTCOME_ORDER: readonly BulkOutcome[] = ['Updated', 'Conflict', 'InvalidTransition', 'NotFound'];

/** The result lines in the order the items were sent (the server keeps that order). */
export function toBulkResultRows(results: readonly BulkItemResult[], titles: ReadonlyMap<number, string>): BulkResultRow[] {
  return results.map((result) => ({
    id: result.id,
    title: titles.get(result.id) ?? '',
    outcome: result.outcome,
    success: result.outcome === 'Updated',
    text: describeResult(result),
  }));
}

/** How many items ended with each outcome, in the order they are shown: only the outcomes that happened. */
export function countOutcomes(results: readonly BulkItemResult[]): { outcome: BulkOutcome; label: string; count: number }[] {
  return OUTCOME_ORDER.map((outcome) => ({
    outcome,
    label: BULK_OUTCOME_LABELS[outcome],
    count: results.filter((result) => result.outcome === outcome).length,
  })).filter((entry) => entry.count > 0);
}

/**
 * The summary is refreshed when the server's data changed (an update) or turned out to be different from what
 * the user saw (a conflict): in both cases the server has dropped its cache (D-11, D-20).
 */
export function bulkRefreshesSummary(response: BulkStatusResponse): boolean {
  return response.results.some((result) => result.outcome === 'Updated' || result.outcome === 'Conflict');
}

function describeResult(result: BulkItemResult): string {
  switch (result.outcome) {
    case 'Updated':
      return result.request ? `עודכנה ל«${STATUS_LABELS[result.request.status]}»` : 'עודכנה';
    case 'NotFound':
      return 'הפנייה לא נמצאה';
    case 'Conflict':
      return `עודכנה בינתיים על ידי משתמש אחר${current(result)}. לא בוצע שינוי`;
    case 'InvalidTransition':
      return `מעבר אסור${current(result)}${allowed(result.allowedStatuses)}. לא בוצע שינוי`;
  }
}

function current(result: BulkItemResult): string {
  const status = REQUEST_STATUSES.find((s) => s === result.currentStatus);
  return status ? ` (כעת «${STATUS_LABELS[status]}»)` : '';
}

function allowed(statuses: readonly RequestStatus[] | undefined): string {
  if (!statuses) {
    return '';
  }
  return statuses.length > 0
    ? `, מותר: ${statuses.map((s) => STATUS_LABELS[s]).join(', ')}`
    : ', הסטטוס סופי';
}
