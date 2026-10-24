import { HttpErrorResponse } from '@angular/common/http';

import { fakeRequest } from './requests-list.store.test-helpers';
import { refreshesSummary, toStatusUpdateFailure, withCurrentState } from './status-update-failure';

function problem(status: number, body: Record<string, unknown> | null = {}): HttpErrorResponse {
  return new HttpErrorResponse({ status, error: body });
}

describe('toStatusUpdateFailure', () => {
  describe('409 – someone else changed the request', () => {
    const body = { currentStatus: 'InProgress', currentVersion: 'AAAAAAAAB9w=', currentUpdatedAt: '2026-10-23T09:29:58Z' };

    it('explains it in Hebrew and says the user can try again', () => {
      const failure = toStatusUpdateFailure(problem(409, body));

      expect(failure.kind).toBe('conflict');
      expect(failure.message).toContain('עודכנה בינתיים על ידי משתמש אחר');
      expect(failure.message).toContain('אפשר לנסות שוב');
    });

    it('carries the current status, version and update time for refreshing the row', () => {
      const failure = toStatusUpdateFailure(problem(409, body));

      expect(failure).toMatchObject({ current: { status: 'InProgress', version: 'AAAAAAAAB9w=', updatedAt: '2026-10-23T09:29:58Z' } });
    });

    it('still reports a conflict when the body has no usable current state', () => {
      expect(toStatusUpdateFailure(problem(409, { currentStatus: 'Bogus' }))).toMatchObject({ kind: 'conflict', current: null });
      expect(toStatusUpdateFailure(problem(409, null))).toMatchObject({ kind: 'conflict', current: null });
    });
  });

  describe('422 – the change is not allowed', () => {
    const body = { currentStatus: 'New', requestedStatus: 'Completed', allowedStatuses: ['InProgress', 'Waiting'], currentVersion: 'v2' };

    it('names the allowed statuses in Hebrew', () => {
      const failure = toStatusUpdateFailure(problem(422, body));

      expect(failure.kind).toBe('invalid-transition');
      expect(failure.message).toContain('מעברים מותרים: בטיפול, ממתינה');
      expect(failure).toMatchObject({ allowedStatuses: ['InProgress', 'Waiting'] });
    });

    it('carries the current status and version (no update time: the 422 has none)', () => {
      expect(toStatusUpdateFailure(problem(422, body))).toMatchObject({ current: { status: 'New', version: 'v2' } });
      expect(toStatusUpdateFailure(problem(422, body))).not.toHaveProperty('current.updatedAt');
    });

    it('says the status is final when nothing is allowed (completed request)', () => {
      const failure = toStatusUpdateFailure(problem(422, { ...body, currentStatus: 'Completed', allowedStatuses: [] }));

      expect(failure.message).toContain('הסטטוס שלה סופי');
    });

    it('ignores statuses it does not know', () => {
      const failure = toStatusUpdateFailure(problem(422, { ...body, allowedStatuses: ['InProgress', 'Mystery'] }));

      expect(failure).toMatchObject({ allowedStatuses: ['InProgress'] });
    });
  });

  it('404 – the request is gone: a message that says the list is reloaded', () => {
    const failure = toStatusUpdateFailure(problem(404));

    expect(failure.kind).toBe('not-found');
    expect(failure.message).toContain('לא נמצאה');
    expect(failure.message).toContain('נטענת מחדש');
  });

  it('any other failure uses the usual Hebrew message for its status code', () => {
    expect(toStatusUpdateFailure(problem(503))).toMatchObject({ kind: 'error', message: expect.stringContaining('אין חיבור') });
    expect(toStatusUpdateFailure(problem(400))).toMatchObject({ kind: 'error' });
    expect(toStatusUpdateFailure(new Error('boom'))).toMatchObject({ kind: 'error' });
  });
});

describe('refreshesSummary', () => {
  it('is true after a change and after a 409, because the server dropped its cache', () => {
    expect(refreshesSummary({ kind: 'updated', request: fakeRequest(1) })).toBe(true);
    expect(refreshesSummary({ kind: 'conflict', message: '', current: null })).toBe(true);
  });

  it('is false when nothing changed on the server', () => {
    expect(refreshesSummary({ kind: 'invalid-transition', message: '', current: null, allowedStatuses: [] })).toBe(false);
    expect(refreshesSummary({ kind: 'not-found', message: '' })).toBe(false);
    expect(refreshesSummary({ kind: 'error', message: '' })).toBe(false);
  });
});

describe('withCurrentState', () => {
  it('takes status, version and update time from the server', () => {
    const row = withCurrentState(fakeRequest(1), { status: 'Waiting', version: 'new', updatedAt: '2026-10-24T08:00:00Z' });

    expect(row).toMatchObject({ id: 1, status: 'Waiting', version: 'new', updatedAt: '2026-10-24T08:00:00Z' });
  });

  it('keeps the update time the row has when the server did not send one', () => {
    const original = fakeRequest(1);

    expect(withCurrentState(original, { status: 'Waiting', version: 'new' }).updatedAt).toBe(original.updatedAt);
  });
});
