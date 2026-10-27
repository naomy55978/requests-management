import { REQUEST_STATUSES, RequestStatus } from './api.models';
import { allowedNext } from './status-transitions';

describe('allowedNext', () => {
  // The rules of D-05, written out by hand (not derived from the code under test): 6 allowed, 10 not allowed.
  // New -> InProgress, Waiting · InProgress -> Waiting, Completed · Waiting -> InProgress, Completed ·
  // Completed is final · a change to the same status is not a change.
  const allowed: [RequestStatus, RequestStatus][] = [
    ['New', 'InProgress'],
    ['New', 'Waiting'],
    ['InProgress', 'Waiting'],
    ['InProgress', 'Completed'],
    ['Waiting', 'InProgress'],
    ['Waiting', 'Completed'],
  ];

  for (const from of REQUEST_STATUSES) {
    for (const to of REQUEST_STATUSES) {
      const expected = allowed.some(([f, t]) => f === from && t === to);
      it(`${from} -> ${to} is ${expected ? 'offered' : 'not offered'}`, () => {
        expect(allowedNext(from).includes(to)).toBe(expected);
      });
    }
  }

  it('offers nothing for a completed request (final)', () => {
    expect(allowedNext('Completed')).toEqual([]);
  });
});
