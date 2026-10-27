import { HttpErrorResponse } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';

import { RequestsApiService } from '../../core/api/requests-api.service';
import { createFakeSummaryApi, fakeSummary } from './summary.test-helpers';
import { SummaryStore } from './summary.store';

describe('SummaryStore', () => {
  function setUp() {
    const fake = createFakeSummaryApi();
    TestBed.configureTestingModule({
      providers: [SummaryStore, { provide: RequestsApiService, useValue: fake.api }],
    });
    return { store: TestBed.inject(SummaryStore), calls: fake.summaryCalls };
  }

  it('loads the summary when it is created', () => {
    const { store, calls } = setUp();

    expect(calls).toHaveLength(1);
    expect(store.loading()).toBe(true);
    expect(store.summary()).toBeNull();

    calls[0].respond();
    expect(store.loading()).toBe(false);
    expect(store.summary()).toEqual(fakeSummary());
    expect(store.error()).toBeNull();
  });

  it('reports a failed load in Hebrew, and does not keep old numbers next to the message', () => {
    const { store, calls } = setUp();
    calls[0].respond();

    store.refresh();
    calls[1].fail(new HttpErrorResponse({ status: 503 }));

    expect(store.error()).toContain('חיבור');
    expect(store.summary()).toBeNull();
    expect(store.loading()).toBe(false);
  });

  it('keeps working after a failed load: refresh tries again and clears the error', () => {
    const { store, calls } = setUp();
    calls[0].fail(new HttpErrorResponse({ status: 500 }));
    expect(store.error()).not.toBeNull();

    store.refresh();
    expect(store.error()).toBeNull();
    expect(store.loading()).toBe(true);
    calls[1].respond();

    expect(store.summary()).toEqual(fakeSummary());
  });

  it('keeps the old numbers on screen while a refresh runs', () => {
    const { store, calls } = setUp();
    calls[0].respond();

    store.refresh();

    expect(store.loading()).toBe(true);
    expect(store.summary()).toEqual(fakeSummary());
  });

  it('cancels the request that is still running when it is refreshed again (switchMap)', () => {
    const { store, calls } = setUp();

    store.refresh();

    expect(calls).toHaveLength(2);
    expect(calls[0].cancelled).toBe(true);
    expect(calls[1].cancelled).toBe(false);
  });

  it('shows the answer of the newest request even if an older one is answered later', () => {
    const { store, calls } = setUp();
    store.refresh();

    calls[0].respond({ ...fakeSummary(), total: 1 });
    expect(store.summary()).toBeNull();

    calls[1].respond({ ...fakeSummary(), total: 2 });
    expect(store.summary()?.total).toBe(2);
  });
});
