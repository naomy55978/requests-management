import { HttpErrorResponse } from '@angular/common/http';

import { describeHttpError, describeLoginError } from './error-messages';

function httpError(status: number, body: unknown = null): HttpErrorResponse {
  return new HttpErrorResponse({ status, error: body });
}

describe('describeHttpError', () => {
  it.each([0, 502, 503, 504])('says the server is unreachable when there is no answer (status %i)', (status) => {
    expect(describeHttpError(httpError(status))).toContain('אין חיבור לשרת');
  });

  it('names the invalid fields of a 400 in Hebrew, never the English server text', () => {
    const message = describeHttpError(
      httpError(400, { title: 'One or more validation errors occurred.', errors: { search: ['too long'], pageSize: ['range'] } }),
    );

    expect(message).toContain('חיפוש');
    expect(message).toContain('גודל עמוד');
    expect(message).not.toContain('too long');
  });

  it('gives a generic 400 message when no field is known', () => {
    expect(describeHttpError(httpError(400, { errors: { 'items[1].id': ['x'] } }))).toContain('הבקשה אינה תקינה');
    expect(describeHttpError(httpError(400))).toContain('הבקשה אינה תקינה');
  });

  it('maps the other status codes', () => {
    expect(describeHttpError(httpError(401))).toContain('התחבר');
    expect(describeHttpError(httpError(404))).toContain('לא נמצא');
    expect(describeHttpError(httpError(409))).toContain('עודכנה');
    expect(describeHttpError(httpError(422))).toContain('אינו מותר');
  });

  it('adds the trace id to a server error, so the failed request can be found in the log', () => {
    expect(describeHttpError(httpError(500, { traceId: '00-abc' }))).toContain('00-abc');
    expect(describeHttpError(httpError(500))).toContain('שגיאה בשרת');
  });

  it('handles errors that did not come from HTTP', () => {
    expect(describeHttpError(new Error('boom'))).toContain('שגיאה לא צפויה');
  });
});

describe('describeLoginError', () => {
  it('reports wrong credentials for a 401, without revealing which field was wrong', () => {
    expect(describeLoginError(httpError(401))).toBe('שם המשתמש או הסיסמה שגויים.');
  });

  it('describes other failures like any other call', () => {
    expect(describeLoginError(httpError(0))).toContain('אין חיבור לשרת');
  });
});
