import { HttpErrorResponse } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';

import { RequestsApiService } from '../../core/api/requests-api.service';
import { RequestsListStore } from './requests-list.store';
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
