import { parseServerTiming } from './server-timing';

describe('parseServerTiming', () => {
  it('reads total, db time, query count and cache from the header the API sends', () => {
    expect(parseServerTiming('total;dur=12.4, db;dur=8.1;desc="2 queries", cache;desc="miss"')).toEqual({
      totalMs: 12.4,
      dbMs: 8.1,
      queryCount: 2,
      cache: 'miss',
    });
  });

  it('reads a cache hit', () => {
    expect(parseServerTiming('total;dur=1.2, db;dur=0;desc="0 queries", cache;desc="hit"')).toMatchObject({
      cache: 'hit',
      dbMs: 0,
      queryCount: 0,
    });
  });

  it('reads "1 query" (singular) as one query', () => {
    expect(parseServerTiming('total;dur=5, db;dur=3;desc="1 query"')).toMatchObject({ queryCount: 1 });
  });

  it('leaves out what the header does not have (no cache outside the summary)', () => {
    expect(parseServerTiming('total;dur=7.5, db;dur=2;desc="3 queries"')).toEqual({
      totalMs: 7.5,
      dbMs: 2,
      queryCount: 3,
      cache: null,
    });
  });

  it('reads a header with only a total (e.g. an error response without database work)', () => {
    expect(parseServerTiming('total;dur=0.8')).toEqual({ totalMs: 0.8, dbMs: null, queryCount: null, cache: null });
  });

  it('accepts a duration without a decimal part, extra spaces, and any letter case', () => {
    expect(parseServerTiming('  TOTAL ; dur=12 ,DB;DUR=4;DESC="5 queries"')).toMatchObject({
      totalMs: 12,
      dbMs: 4,
      queryCount: 5,
    });
  });

  it('is not confused by a comma or semicolon inside a quoted description', () => {
    expect(parseServerTiming('db;dur=4;desc="2 queries, 1; cached", total;dur=9')).toMatchObject({
      dbMs: 4,
      queryCount: 2,
      totalMs: 9,
    });
  });

  it('ignores metrics it does not know, and keeps the ones it does', () => {
    expect(parseServerTiming('app;dur=3, total;dur=10, edge;desc="x"')).toMatchObject({ totalMs: 10 });
  });

  it.each([
    ['no header', null],
    ['undefined', undefined],
    ['an empty header', ''],
    ['text that is not a header', 'hello world'],
    ['only unknown metrics', 'app;dur=3, edge;dur=1'],
    ['a duration that is not a number', 'total;dur=abc'],
    ['a negative duration', 'total;dur=-5'],
    ['a duration without a value', 'total;dur='],
    ['an unknown cache outcome', 'cache;desc="stale"'],
  ])('gives null for %s', (_name, header) => {
    expect(parseServerTiming(header)).toBeNull();
  });

  it('does not throw on odd input (an unclosed quote, an empty metric)', () => {
    expect(() => parseServerTiming('total;dur=5, , db;desc="3 queries')).not.toThrow();
    expect(parseServerTiming('total;dur=5, , db;desc="3 queries')).toMatchObject({ totalMs: 5 });
  });
});
