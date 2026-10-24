import { TestBed } from '@angular/core/testing';

import { MAX_ENTRIES, PerformanceEntry, PerformanceLogService, classifyRequest } from './performance-log.service';

function entry(overrides: Partial<Omit<PerformanceEntry, 'id'>> = {}): Omit<PerformanceEntry, 'id'> {
  return { at: new Date(), kind: 'list', method: 'GET', status: 200, clientMs: 10, timing: null, ...overrides };
}

describe('PerformanceLogService', () => {
  let log: PerformanceLogService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    log = TestBed.inject(PerformanceLogService);
  });

  it('keeps the newest request first, each with its own id', () => {
    log.record(entry({ clientMs: 1 }));
    log.record(entry({ clientMs: 2 }));

    expect(log.entries().map((e) => e.clientMs)).toEqual([2, 1]);
    expect(new Set(log.entries().map((e) => e.id)).size).toBe(2);
  });

  it(`keeps only the last ${MAX_ENTRIES} requests`, () => {
    for (let i = 0; i < MAX_ENTRIES + 10; i++) {
      log.record(entry({ clientMs: i }));
    }

    expect(log.entries()).toHaveLength(MAX_ENTRIES);
    expect(log.entries()[0].clientMs).toBe(MAX_ENTRIES + 9);
    expect(log.entries().at(-1)?.clientMs).toBe(10);
  });

  it('finds the newest request of a kind, or null', () => {
    log.record(entry({ kind: 'list', clientMs: 1 }));
    log.record(entry({ kind: 'summary', clientMs: 2 }));
    log.record(entry({ kind: 'list', clientMs: 3 }));

    expect(log.latest('list')?.clientMs).toBe(3);
    expect(log.latest('summary')?.clientMs).toBe(2);
    expect(log.latest('bulk')).toBeNull();
  });

  it('can be cleared', () => {
    log.record(entry());
    log.clear();

    expect(log.entries()).toEqual([]);
  });
});

describe('classifyRequest', () => {
  it.each([
    ['GET', '/api/requests', 'list'],
    ['GET', '/api/requests?page=2&search=%D7%91', 'list'],
    ['GET', '/api/requests/summary', 'summary'],
    ['GET', '/api/requests/42/history', 'history'],
    ['PATCH', '/api/requests/42/status', 'status'],
    ['POST', '/api/requests/bulk-status', 'bulk'],
    ['POST', '/api/auth/login', 'login'],
    ['GET', '/api/requests/42', 'other'],
    ['DELETE', '/api/requests', 'other'],
    ['GET', '/api/something', 'other'],
  ])('%s %s is "%s"', (method, url, kind) => {
    expect(classifyRequest(method, url)).toBe(kind);
  });
});
