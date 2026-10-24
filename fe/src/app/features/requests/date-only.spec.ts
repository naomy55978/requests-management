import { isDateRangeValid, toDateOnly } from './date-only';

describe('toDateOnly', () => {
  it('formats the picked day with zero padding', () => {
    expect(toDateOnly(new Date(2026, 0, 5))).toBe('2026-01-05');
    expect(toDateOnly(new Date(2026, 11, 31))).toBe('2026-12-31');
  });

  it('keeps the picked day for a date at local midnight (no shift through UTC)', () => {
    // 1 March 00:00 local time: toISOString() would say 28 February wherever the local zone is ahead of UTC
    expect(toDateOnly(new Date(2026, 2, 1, 0, 0, 0))).toBe('2026-03-01');
  });

  it('returns null for no date or an invalid date', () => {
    expect(toDateOnly(null)).toBeNull();
    expect(toDateOnly(new Date('not a date'))).toBeNull();
  });
});

describe('isDateRangeValid', () => {
  it.each([
    ['both empty', null, null],
    ['only from', '2026-01-05', null],
    ['only to', null, '2026-01-05'],
    ['one day', '2026-01-05', '2026-01-05'],
    ['from before to', '2026-01-05', '2026-02-01'],
  ])('accepts %s', (_name, from, to) => {
    expect(isDateRangeValid(from, to)).toBe(true);
  });

  it('rejects "from" after "to"', () => {
    expect(isDateRangeValid('2026-02-01', '2026-01-05')).toBe(false);
  });
});
