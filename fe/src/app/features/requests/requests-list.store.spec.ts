import { HttpErrorResponse } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';

import { UNASSIGNED } from '../../core/api/api.models';
import { RequestsApiService } from '../../core/api/requests-api.service';
import { EMPTY_FILTERS, RequestFilters } from './request-filters';
import { RequestsListStore, TEXT_DEBOUNCE_MS } from './requests-list.store';
import { createFakeApi, fakeRequest } from './requests-list.store.test-helpers';

describe('RequestsListStore', () => {
  function setUp() {
    const fake = createFakeApi();
    TestBed.configureTestingModule({
      providers: [RequestsListStore, { provide: RequestsApiService, useValue: fake.api }],
    });
    return { ...fake, store: TestBed.inject(RequestsListStore) };
  }

  it('loads the first page with the default sort when it is created', () => {
    const { store, calls } = setUp();

    expect(calls).toHaveLength(1);
    expect(calls[0].query).toMatchObject({ page: 1, pageSize: 20, sortBy: 'createdAt', sortDir: 'desc' });
    expect(store.loading()).toBe(true);

    calls[0].respond([fakeRequest(1), fakeRequest(2)], 100_000);

    expect(store.loading()).toBe(false);
    expect(store.items().map((r) => r.id)).toEqual([1, 2]);
    expect(store.totalCount()).toBe(100_000);
    expect(store.error()).toBeNull();
  });

  it('asks the server for the new page, with the page size', () => {
    const { store, calls } = setUp();
    calls[0].respond([fakeRequest(1)], 500);

    store.changePage(3, 50);

    expect(calls).toHaveLength(2);
    expect(calls[1].query).toMatchObject({ page: 3, pageSize: 50 });
  });

  it('asks the server for the new order, and starts again from page 1', () => {
    const { store, calls } = setUp();
    calls[0].respond([fakeRequest(1)], 500);
    store.changePage(4, 20);

    store.sortBy('title', 'asc');

    expect(calls).toHaveLength(3);
    expect(calls[2].query).toMatchObject({ sortBy: 'title', sortDir: 'asc', page: 1 });
  });

  it('sends no request when the page or sort did not change', () => {
    const { store, calls } = setUp();
    calls[0].respond([fakeRequest(1)], 500);

    store.changePage(1, 20);
    store.sortBy('createdAt', 'desc');

    expect(calls).toHaveLength(1);
  });

  it('cancels the previous request when a newer one starts (switchMap)', () => {
    const { store, calls } = setUp();
    calls[0].respond([fakeRequest(1)], 500);

    store.changePage(2, 20);
    store.changePage(3, 20);

    expect(calls[1].cancelled).toBe(true);
    expect(calls[2].cancelled).toBe(false);
  });

  it('shows the answer of the newest request even if an older one is answered later', () => {
    const { store, calls } = setUp();
    calls[0].respond([fakeRequest(1)], 500);
    store.changePage(2, 20);
    store.changePage(3, 20);

    // The cancelled call can no longer deliver: only the newest answer reaches the screen
    calls[1].respond([fakeRequest(21)], 500);
    calls[2].respond([fakeRequest(41)], 500);

    expect(store.items().map((r) => r.id)).toEqual([41]);
  });

  it('keeps the rows on screen while the next page loads', () => {
    const { store, calls } = setUp();
    calls[0].respond([fakeRequest(1)], 500);

    store.changePage(2, 20);

    expect(store.loading()).toBe(true);
    expect(store.items().map((r) => r.id)).toEqual([1]);
  });

  it('reports a failed load in Hebrew, and clears the rows that no longer match the query', () => {
    const { store, calls } = setUp();
    calls[0].respond([fakeRequest(1)], 500);
    store.changePage(2, 20);

    calls[1].fail(new HttpErrorResponse({ status: 0 }));

    expect(store.loading()).toBe(false);
    expect(store.error()).toContain('אין חיבור לשרת');
    expect(store.items()).toEqual([]);
    expect(store.totalCount()).toBe(0);
  });

  describe('filters and search', () => {
    beforeEach(() => vi.useFakeTimers());
    afterEach(() => vi.useRealTimers());

    function typed(store: RequestsListStore, patch: Partial<RequestFilters>): void {
      store.setFilters({ ...EMPTY_FILTERS, ...patch });
    }

    it('sends ONE request for fast typing, after the pause, with the final text', () => {
      const { store, calls } = setUp();
      calls[0].respond();

      for (const text of ['l', 'lo', 'log', 'logo']) {
        typed(store, { search: text });
        vi.advanceTimersByTime(100);
      }
      expect(calls).toHaveLength(1);

      vi.advanceTimersByTime(TEXT_DEBOUNCE_MS);

      expect(calls).toHaveLength(2);
      expect(calls[1].query.search).toBe('logo');
    });

    it('does not search for a single character, and trims the text', () => {
      const { store, calls } = setUp();
      calls[0].respond();

      typed(store, { search: 'a' });
      vi.advanceTimersByTime(TEXT_DEBOUNCE_MS);
      expect(calls).toHaveLength(1);

      typed(store, { search: '  ab  ' });
      vi.advanceTimersByTime(TEXT_DEBOUNCE_MS);
      expect(calls).toHaveLength(2);
      expect(calls[1].query.search).toBe('ab');
    });

    it('sends no new request when the text is the same after trimming (distinctUntilChanged)', () => {
      const { store, calls } = setUp();
      calls[0].respond();
      typed(store, { search: 'logo' });
      vi.advanceTimersByTime(TEXT_DEBOUNCE_MS);
      calls[1].respond();

      typed(store, { search: 'logo  ' });
      vi.advanceTimersByTime(TEXT_DEBOUNCE_MS);

      expect(calls).toHaveLength(2);
    });

    it('debounces the organization and handler fields too, as one group with the search', () => {
      const { store, calls } = setUp();
      calls[0].respond();

      typed(store, { organization: 'Ac' });
      vi.advanceTimersByTime(100);
      typed(store, { organization: 'Acme', assignedTo: 'dana' });
      vi.advanceTimersByTime(100);
      typed(store, { organization: 'Acme', assignedTo: 'dana', search: 'logo' });
      expect(calls).toHaveLength(1);

      vi.advanceTimersByTime(TEXT_DEBOUNCE_MS);

      expect(calls).toHaveLength(2);
      expect(calls[1].query).toMatchObject({ organization: 'Acme', assignedTo: 'dana', search: 'logo' });
    });

    it('cancels the previous request when the user searches again (switchMap)', () => {
      const { store, calls } = setUp();
      calls[0].respond();
      typed(store, { search: 'logo' });
      vi.advanceTimersByTime(TEXT_DEBOUNCE_MS);
      expect(calls[1].cancelled).toBe(false);

      typed(store, { search: 'logos' });
      vi.advanceTimersByTime(TEXT_DEBOUNCE_MS);

      expect(calls).toHaveLength(3);
      expect(calls[1].cancelled).toBe(true);
      expect(calls[2].cancelled).toBe(false);
    });

    it('applies picked filters at once, without waiting', () => {
      const { store, calls } = setUp();
      calls[0].respond();

      typed(store, { status: ['New', 'Waiting'], priority: ['High'] });

      expect(calls).toHaveLength(2);
      expect(calls[1].query).toMatchObject({ status: ['New', 'Waiting'], priority: ['High'] });
    });

    it('starts again from page 1 when a filter or the search changes', () => {
      const { store, calls } = setUp();
      calls[0].respond([], 1000);
      store.changePage(4, 20);
      calls[1].respond([], 1000);

      typed(store, { status: ['New'] });
      expect(calls[2].query).toMatchObject({ status: ['New'], page: 1 });
      calls[2].respond([], 100);
      store.changePage(3, 20);
      calls[3].respond([], 100);

      typed(store, { status: ['New'], search: 'logo' });
      vi.advanceTimersByTime(TEXT_DEBOUNCE_MS);
      expect(calls[4].query).toMatchObject({ search: 'logo', page: 1 });
    });

    it('sends "unassigned" for the checkbox and ignores the handler text while it is set', () => {
      const { store, calls } = setUp();
      calls[0].respond();

      typed(store, { assignedTo: 'dana', unassigned: true });
      vi.advanceTimersByTime(TEXT_DEBOUNCE_MS);

      expect(calls[1].query.assignedTo).toBe(UNASSIGNED);
    });

    it('sends the dates as given and never sends a reversed range', () => {
      const { store, calls } = setUp();
      calls[0].respond();

      typed(store, { createdFrom: '2026-02-01', createdTo: '2026-01-05' });
      expect(calls).toHaveLength(1);

      typed(store, { createdFrom: '2026-01-05', createdTo: '2026-02-01' });
      expect(calls).toHaveLength(2);
      expect(calls[1].query).toMatchObject({ createdFrom: '2026-01-05', createdTo: '2026-02-01' });
    });

    it('keeps the sort order when filters change', () => {
      const { store, calls } = setUp();
      calls[0].respond();
      store.sortBy('priority', 'desc');
      calls[1].respond();

      typed(store, { status: ['New'] });

      expect(calls[2].query).toMatchObject({ sortBy: 'priority', sortDir: 'desc', status: ['New'] });
    });

    it('"clear filters" sends one request at once, not one now and one after the typing pause', () => {
      const { store, calls } = setUp();
      calls[0].respond();
      typed(store, { status: ['New'], search: 'logo', organization: 'Acme' });
      vi.advanceTimersByTime(TEXT_DEBOUNCE_MS);
      expect(calls.length).toBeGreaterThanOrEqual(2);
      const before = calls.length;

      store.setFilters(EMPTY_FILTERS);
      expect(calls).toHaveLength(before + 1);
      vi.advanceTimersByTime(TEXT_DEBOUNCE_MS * 2);

      expect(calls).toHaveLength(before + 1);
      expect(calls[before].query).toMatchObject({ status: [], search: '', organization: '', page: 1 });
      expect(store.filtersActive()).toBe(false);
    });
  });

  it('keeps working after a failed load: reload repeats the same query', () => {
    const { store, calls } = setUp();
    calls[0].fail(new HttpErrorResponse({ status: 500 }));
    expect(store.error()).not.toBeNull();

    store.reload();

    expect(calls).toHaveLength(2);
    expect(calls[1].query).toEqual(calls[0].query);
    expect(store.error()).toBeNull();
    expect(store.loading()).toBe(true);

    calls[1].respond([fakeRequest(7)], 1);

    expect(store.items().map((r) => r.id)).toEqual([7]);
  });
});
