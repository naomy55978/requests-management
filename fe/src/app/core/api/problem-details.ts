/**
 * Error body of the API (RFC 9457 ProblemDetails). 400 is a ValidationProblemDetails: `errors` maps a camelCase
 * field name to its messages. 409 and 422 carry extra members (`currentStatus`, `currentVersion`, `allowedStatuses`).
 * The texts are in English and are not shown to the user; the UI maps status code and field names to Hebrew.
 */
export interface ProblemDetails {
  type?: string;
  title?: string;
  status?: number;
  detail?: string;
  traceId?: string;
  errors?: Record<string, string[]>;
  [extension: string]: unknown;
}

export function isProblemDetails(body: unknown): body is ProblemDetails {
  return typeof body === 'object' && body !== null;
}
