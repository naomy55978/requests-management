import { RequestPriority, RequestStatus } from '../api/api.models';

// Hebrew texts for the values the API sends as English strings. One place, so a label is never repeated.

export const STATUS_LABELS: Record<RequestStatus, string> = {
  New: 'חדשה',
  InProgress: 'בטיפול',
  Waiting: 'ממתינה',
  Completed: 'הושלמה',
};

export const PRIORITY_LABELS: Record<RequestPriority, string> = {
  Low: 'נמוכה',
  Medium: 'בינונית',
  High: 'גבוהה',
};

/** Names of the query/body fields, used in validation messages ("the value of «search» is invalid"). */
export const FIELD_LABELS: Record<string, string> = {
  page: 'מספר עמוד',
  pageSize: 'גודל עמוד',
  status: 'סטטוס',
  priority: 'עדיפות',
  organization: 'ארגון',
  assignedTo: 'מטפל',
  createdFrom: 'מתאריך',
  createdTo: 'עד תאריך',
  search: 'חיפוש',
  sortBy: 'שדה מיון',
  sortDir: 'כיוון מיון',
  userName: 'שם משתמש',
  password: 'סיסמה',
};

/** How many requests are ticked, in Hebrew ("one request was selected" / "5 requests were selected"). */
export function describeSelectedCount(count: number): string {
  return count === 1 ? 'פנייה אחת נבחרה' : `${count} פניות נבחרו`;
}
