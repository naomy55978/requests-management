import { HttpErrorResponse } from '@angular/common/http';

import { FIELD_LABELS } from '../i18n/labels';
import { isProblemDetails } from './problem-details';

const GENERIC = 'אירעה שגיאה לא צפויה. נסו שוב.';

/**
 * Hebrew message for a failed API call. The server's own texts are English, so they are never shown:
 * the message is chosen by the status code and, for 400, by the (camelCase) names of the invalid fields.
 */
export function describeHttpError(error: unknown): string {
  if (!(error instanceof HttpErrorResponse)) {
    return GENERIC;
  }

  switch (error.status) {
    // 0: the browser got no answer; 502/503/504: a proxy or gateway in front of the API got none
    case 0:
    case 502:
    case 503:
    case 504:
      return 'אין חיבור לשרת. ודאו שה־API פועל ונסו שוב.';
    case 400:
      return describeValidationError(error);
    case 401:
      return 'פג תוקף ההתחברות. יש להתחבר מחדש.';
    case 404:
      return 'הפריט המבוקש לא נמצא.';
    case 409:
      return 'הפנייה עודכנה בינתיים על ידי משתמש אחר.';
    case 422:
      return 'המעבר המבוקש אינו מותר מהסטטוס הנוכחי.';
    default:
      return error.status >= 500 ? withTraceId('אירעה שגיאה בשרת. נסו שוב מאוחר יותר.', error) : GENERIC;
  }
}

/** Message for a failed login: 401 means wrong credentials, anything else is described as usual. */
export function describeLoginError(error: unknown): string {
  if (error instanceof HttpErrorResponse && error.status === 401) {
    return 'שם המשתמש או הסיסמה שגויים.';
  }
  return describeHttpError(error);
}

function describeValidationError(error: HttpErrorResponse): string {
  const body: unknown = error.error;
  const fields = isProblemDetails(body) && body.errors ? Object.keys(body.errors) : [];

  // Keys can be nested ("items[1].id"); only the plain field names are translated
  const labels = [...new Set(fields.map((key) => FIELD_LABELS[key]).filter((label): label is string => !!label))];
  return labels.length > 0
    ? `הערכים בשדות הבאים אינם תקינים: ${labels.join(', ')}.`
    : 'הבקשה אינה תקינה. בדקו את הערכים ונסו שוב.';
}

// The trace id lets whoever reads the server log find the exact failed request
function withTraceId(message: string, error: HttpErrorResponse): string {
  const body: unknown = error.error;
  const traceId = isProblemDetails(body) ? body.traceId : undefined;
  return traceId ? `${message} (מזהה: ${traceId})` : message;
}
