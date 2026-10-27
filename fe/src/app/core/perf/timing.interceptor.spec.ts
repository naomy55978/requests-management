import { HttpClient, provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';

import { PerformanceLogService } from './performance-log.service';
import { SHOW_PERFORMANCE } from './show-performance';
import { timingInterceptor } from './timing.interceptor';

describe('timingInterceptor', () => {
  let http: HttpClient;
  let backend: HttpTestingController;
  let log: PerformanceLogService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptors([timingInterceptor])),
        provideHttpClientTesting(),
        { provide: SHOW_PERFORMANCE, useValue: true },
      ],
    });
    http = TestBed.inject(HttpClient);
    backend = TestBed.inject(HttpTestingController);
    log = TestBed.inject(PerformanceLogService);
  });

  afterEach(() => backend.verify());

  const header = 'total;dur=12.4, db;dur=8.1;desc="2 queries", cache;desc="miss"';

  it('notes the kind, the status, the browser time and the Server-Timing header of an answer', () => {
    http.get('/api/requests/summary').subscribe();
    backend.expectOne('/api/requests/summary').flush({}, { headers: { 'Server-Timing': header } });

    const [entry] = log.entries();
    expect(entry).toMatchObject({
      kind: 'summary',
      method: 'GET',
      status: 200,
      timing: { totalMs: 12.4, dbMs: 8.1, queryCount: 2, cache: 'miss' },
    });
    expect(entry.clientMs).toBeGreaterThanOrEqual(0);
  });

  it('notes an answer without the header with the browser time only', () => {
    http.get('/api/requests').subscribe();
    backend.expectOne('/api/requests').flush({});

    expect(log.entries()[0]).toMatchObject({ kind: 'list', timing: null });
  });

  it('notes an error answer too, with its header, and the error still reaches the caller', () => {
    const errors: number[] = [];
    http.patch('/api/requests/7/status', {}).subscribe({ error: (e) => errors.push(e.status) });
    backend
      .expectOne('/api/requests/7/status')
      .flush({}, { status: 409, statusText: 'Conflict', headers: { 'Server-Timing': 'total;dur=3.5' } });

    expect(errors).toEqual([409]);
    expect(log.entries()[0]).toMatchObject({ kind: 'status', status: 409, timing: { totalMs: 3.5 } });
  });

  it('does not note a call that was cancelled', () => {
    const subscription = http.get('/api/requests').subscribe();
    const request = backend.expectOne('/api/requests');

    subscription.unsubscribe();

    expect(request.cancelled).toBe(true);
    expect(log.entries()).toEqual([]);
  });

  it('ignores calls that are not to the API', () => {
    http.get('/assets/logo.svg').subscribe();
    backend.expectOne('/assets/logo.svg').flush('');

    expect(log.entries()).toEqual([]);
  });

  it('notes every call, newest first', () => {
    http.get('/api/requests').subscribe();
    backend.expectOne('/api/requests').flush({});
    http.get('/api/requests/summary').subscribe();
    backend.expectOne('/api/requests/summary').flush({});

    expect(log.entries().map((e) => e.kind)).toEqual(['summary', 'list']);
  });
});

describe('timingInterceptor with the performance UI off (the default)', () => {
  it('passes the call through and notes nothing', () => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(withInterceptors([timingInterceptor])), provideHttpClientTesting()],
    });
    const http = TestBed.inject(HttpClient);
    const backend = TestBed.inject(HttpTestingController);
    const answers: unknown[] = [];

    http.get('/api/requests/summary').subscribe((body) => answers.push(body));
    backend.expectOne('/api/requests/summary').flush({ ok: true }, { headers: { 'Server-Timing': 'total;dur=1' } });

    expect(answers).toEqual([{ ok: true }]);
    expect(TestBed.inject(PerformanceLogService).entries()).toEqual([]);
    backend.verify();
  });
});
