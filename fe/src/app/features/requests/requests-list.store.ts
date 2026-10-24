import { Injectable, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import {
  Subject,
  catchError,
  debounceTime,
  distinctUntilChanged,
  filter,
  map,
  merge,
  of,
  scan,
  startWith,
  switchMap,
  tap,
} from 'rxjs';

import { PagedResult, RequestDto, RequestListQuery, RequestSortField, SortDirection } from '../../core/api/api.models';
import { describeHttpError } from '../../core/api/error-messages';
import { RequestsApiService } from '../../core/api/requests-api.service';
import { isDateRangeValid } from './date-only';
import {
  EMPTY_OPTION_FILTERS,
  EMPTY_TEXT_FILTERS,
  RequestFilters,
  hasActiveFilters,
  isEmptyFilters,
  normalizeTextFilters,
  pickOptionFilters,
  pickTextFilters,
  sameOptionFilters,
  sameTextFilters,
  withOptionFilters,
  withTextFilters,
} from './request-filters';

export const DEFAULT_PAGE_SIZE = 20;

/** Pause in typing after which the text filters (search, organization, handler) are sent to the server. */
export const TEXT_DEBOUNCE_MS = 300;

export const DEFAULT_QUERY: RequestListQuery = {
  page: 1,
  pageSize: DEFAULT_PAGE_SIZE,
  status: [],
  priority: [],
  organization: '',
  assignedTo: '',
  createdFrom: null,
  createdTo: null,
  search: '',
  sortBy: 'createdAt',
  sortDir: 'desc',
};

/** A change to the query. Returning the same object means "nothing changed" and sends no request. */
type QueryChange = (query: RequestListQuery) => RequestListQuery;

export type ListViewState = 'loading' | 'error' | 'empty' | 'data';

type LoadOutcome = { result: PagedResult<RequestDto>; error?: undefined } | { error: string; result?: undefined };

/**
 * State of the requests list. Everything the user can change (page, sort, filters, search, retry) goes through
 * ONE stream: changes are folded into the current query, and every new query is sent to the server with switchMap,
 * so the previous request is cancelled if it has not finished. Paging, sorting, filtering and search are done by
 * the server only; this class never touches the rows.
 *
 * Provided by the page component, so the state (and the rows) are dropped when the page is closed.
 */
@Injectable()
export class RequestsListStore {
  private readonly api = inject(RequestsApiService);
  private readonly changes$ = new Subject<QueryChange>();
  private readonly filters$ = new Subject<RequestFilters>();

  /** The query behind the rows on screen (and the one being loaded). */
  readonly query = signal<RequestListQuery>(DEFAULT_QUERY);
  readonly items = signal<RequestDto[]>([]);
  readonly totalCount = signal(0);
  readonly loading = signal(false);
  /** Hebrew message of the last failed load; null when the last load succeeded. */
  readonly error = signal<string | null>(null);

  /** True when a filter or search narrows the list (to offer "clear filters" on an empty result). */
  readonly filtersActive = computed(() => hasActiveFilters(this.query()));

  /**
   * What the list area shows. Rows already on screen stay visible while the next page loads ('data'; the
   * `loading` flag only dims them), so 'loading' means there is nothing to show yet.
   */
  readonly viewState = computed<ListViewState>(() => {
    if (this.error()) {
      return 'error';
    }
    if (this.items().length > 0) {
      return 'data';
    }
    return this.loading() ? 'loading' : 'empty';
  });

  constructor() {
    // Typed text: wait for a pause in typing, so fast typing sends one request and not one per keystroke
    const textChanges$ = this.filters$.pipe(
      map(pickTextFilters),
      debounceTime(TEXT_DEBOUNCE_MS),
      map(normalizeTextFilters),
      distinctUntilChanged(sameTextFilters),
      map((text): QueryChange => (query) => withTextFilters(query, text)),
    );

    // Picked values: nothing to wait for. A reversed date range is never sent (the API would answer 400).
    const optionChanges$ = this.filters$.pipe(
      filter((filters) => isDateRangeValid(filters.createdFrom, filters.createdTo)),
      map(pickOptionFilters),
      distinctUntilChanged(sameOptionFilters),
      map((options): QueryChange => (query) => withOptionFilters(query, options)),
    );

    merge(this.changes$, textChanges$, optionChanges$)
      .pipe(
        scan((query, change) => change(query), DEFAULT_QUERY),
        startWith(DEFAULT_QUERY),
        distinctUntilChanged(),
        tap((query) => {
          this.query.set(query);
          // The rows on screen stay until the new ones arrive; only the flags change
          this.loading.set(true);
          this.error.set(null);
        }),
        switchMap((query) =>
          this.api.list(query).pipe(
            map((result): LoadOutcome => ({ result })),
            // Caught inside switchMap: a failed request must not end the stream for later changes
            catchError((error: unknown) => of<LoadOutcome>({ error: describeHttpError(error) })),
          ),
        ),
        takeUntilDestroyed(),
      )
      .subscribe((outcome) => {
        this.loading.set(false);
        if (outcome.result) {
          this.items.set(outcome.result.items);
          this.totalCount.set(outcome.result.totalCount);
        } else {
          // Rows of the old query would not match the query the user asked for
          this.items.set([]);
          this.totalCount.set(0);
          this.error.set(outcome.error);
        }
      });
  }

  /**
   * The current values of the filter form. Call it on every change; the store decides what to send and when.
   * `immediate` is for an explicit action (the "x" button of a text field): the typed text is sent now and not
   * after the typing pause. The pause still runs, but then finds the query unchanged and sends nothing.
   */
  setFilters(filters: RequestFilters, options: { immediate?: boolean } = {}): void {
    // "Clear filters" has nothing to wait for: one request now, not one now and one after the typing pause.
    // It goes first: when the form value follows, the query is already empty and that value changes nothing.
    if (isEmptyFilters(filters)) {
      this.changes$.next((query) =>
        withOptionFilters(withTextFilters(query, EMPTY_TEXT_FILTERS), EMPTY_OPTION_FILTERS),
      );
    } else if (options.immediate) {
      const text = normalizeTextFilters(pickTextFilters(filters));
      this.changes$.next((query) => withTextFilters(query, text));
    }

    this.filters$.next(filters);
  }

  /** Sorting changes the order of all rows, so the list starts again from page 1. */
  sortBy(sortBy: RequestSortField, sortDir: SortDirection): void {
    this.changes$.next((query) =>
      query.sortBy === sortBy && query.sortDir === sortDir ? query : { ...query, sortBy, sortDir, page: 1 },
    );
  }

  changePage(page: number, pageSize: number): void {
    this.changes$.next((query) =>
      query.page === page && query.pageSize === pageSize ? query : { ...query, page, pageSize },
    );
  }

  /** Loads the current query again (retry after an error, refresh after an update). */
  reload(): void {
    this.changes$.next((query) => ({ ...query }));
  }
}
