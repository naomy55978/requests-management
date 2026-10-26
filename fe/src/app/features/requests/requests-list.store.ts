import { Injectable, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import {
  EMPTY,
  Observable,
  Subject,
  catchError,
  debounceTime,
  defer,
  distinctUntilChanged,
  filter,
  finalize,
  map,
  merge,
  of,
  scan,
  startWith,
  switchMap,
  tap,
} from 'rxjs';

import {
  BULK_MAX_ITEMS,
  PagedResult,
  REQUEST_STATUSES,
  RequestDto,
  RequestListQuery,
  RequestSortField,
  RequestStatus,
  SortDirection,
} from '../../core/api/api.models';
import { describeHttpError } from '../../core/api/error-messages';
import { RequestsApiService } from '../../core/api/requests-api.service';
import { allowedNext } from '../../core/api/status-transitions';
import { BulkChangeOutcome } from './bulk-result';
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
import { StatusChangeOutcome, toStatusUpdateFailure, withCurrentState } from './status-update-failure';

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

  /** Requests whose status change is on its way. The UI disables their action, so a change cannot be sent twice. */
  readonly pendingIds = signal<ReadonlySet<number>>(new Set());

  /**
   * The requests ticked for a Bulk change. Only rows of the page on screen can be selected: the version of a row is
   * known only while it is on screen, and a selection the user cannot see would be easy to send by mistake (D-39).
   * The selection is emptied whenever a new query starts (page, sort, filter, reload).
   */
  readonly selectedIds = signal<ReadonlySet<number>>(new Set());
  /** True while a Bulk call is on its way. */
  readonly bulkPending = signal(false);

  /** The selected rows as they are on screen now (with their current versions). */
  readonly selectedItems = computed(() => {
    const ids = this.selectedIds();
    return this.items().filter((item) => ids.has(item.id));
  });

  /**
   * The statuses a Bulk change can offer: every status that at least one selected row can move to. A row that cannot
   * make the chosen move is not hidden by this: the server answers InvalidTransition for it and the user sees why.
   */
  readonly bulkTargets = computed<RequestStatus[]>(() => {
    const reachable = new Set(this.selectedItems().flatMap((item) => allowedNext(item.status)));
    return REQUEST_STATUSES.filter((status) => reachable.has(status));
  });

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
          this.selectedIds.set(new Set());
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

  /**
   * Moves one request to a new status (cold: nothing is sent until the caller subscribes). The answer is turned
   * into an outcome and never into an error, and the row on screen is updated in place:
   *  - 200: the row is replaced by the updated request (new version);
   *  - 409 / 422: the row takes the current status and version from the answer, so the user can try again
   *    right away. No extra GET: the only thing that can change in this system is the status (D-37). An answer
   *    without that state (not expected from this API) loads the list again instead;
   *  - 404: the request is gone, the list is loaded again.
   * A request that is already on its way is not sent again.
   */
  changeStatus(row: RequestDto, newStatus: RequestStatus): Observable<StatusChangeOutcome> {
    return defer(() => {
      if (this.pendingIds().has(row.id)) {
        return EMPTY;
      }
      this.setPending(row.id, true);

      // The version on screen now, which may be newer than the row the caller holds
      const version = (this.items().find((item) => item.id === row.id) ?? row).version;

      return this.api.changeStatus(row.id, newStatus, version).pipe(
        map((request): StatusChangeOutcome => ({ kind: 'updated', request })),
        catchError((error: unknown) => of<StatusChangeOutcome>(toStatusUpdateFailure(error))),
        tap((outcome) => this.applyOutcome(row.id, outcome)),
        finalize(() => this.setPending(row.id, false)),
      );
    });
  }

  toggleSelection(id: number): void {
    this.selectedIds.update((ids) => {
      const next = new Set(ids);
      if (!next.delete(id)) {
        next.add(id);
      }
      return next;
    });
  }

  /** Selects every row of the page, or none. */
  selectPage(selected: boolean): void {
    this.selectedIds.set(selected ? new Set(this.items().map((item) => item.id)) : new Set());
  }

  clearSelection(): void {
    this.selectedIds.set(new Set());
  }

  /**
   * Moves the selected rows to one status with a single Bulk call (cold: nothing is sent until the caller subscribes).
   * The answer has a result for every item; the list is loaded again afterwards (which also empties the selection),
   * so the rows show the new statuses and the fresh versions of the conflicts. If the call itself fails nothing was
   * saved: the selection stays, so the user can try again. A call that is already on its way is not sent again.
   */
  bulkChangeStatus(newStatus: RequestStatus): Observable<BulkChangeOutcome> {
    return defer(() => {
      // The page size is at most BULK_MAX_ITEMS, so the limit can only be reached by a bug; the slice makes sure
      const rows = this.selectedItems().slice(0, BULK_MAX_ITEMS);
      if (rows.length === 0 || this.bulkPending()) {
        return EMPTY;
      }
      this.bulkPending.set(true);
      const titles = new Map(rows.map((row) => [row.id, row.title]));

      return this.api
        .bulkChangeStatus(
          newStatus,
          rows.map((row) => ({ id: row.id, version: row.version })),
        )
        .pipe(
          map((response): BulkChangeOutcome => ({ kind: 'done', response, titles })),
          catchError((error: unknown) => of<BulkChangeOutcome>({ kind: 'error', message: describeHttpError(error) })),
          tap((outcome) => {
            if (outcome.kind === 'done') {
              this.reload();
            }
          }),
          finalize(() => this.bulkPending.set(false)),
        );
    });
  }

  /** Loads the current query again (retry after an error, refresh after an update). */
  reload(): void {
    this.changes$.next((query) => ({ ...query }));
  }

  private setPending(id: number, pending: boolean): void {
    this.pendingIds.update((ids) => {
      const next = new Set(ids);
      if (pending) {
        next.add(id);
      } else {
        next.delete(id);
      }
      return next;
    });
  }

  private applyOutcome(id: number, outcome: StatusChangeOutcome): void {
    switch (outcome.kind) {
      case 'updated':
        this.replaceItem(outcome.request);
        break;
      case 'conflict':
      case 'invalid-transition': {
        const current = outcome.current;
        if (current) {
          this.items.update((items) => items.map((item) => (item.id === id ? withCurrentState(item, current) : item)));
        } else {
          // The answer did not say how the request looks now, so the row cannot be refreshed from it. Loading the list
          // again is what the message "the data was refreshed" promises, and the user can retry with a fresh version.
          this.reload();
        }
        break;
      }
      case 'not-found':
        this.reload();
        break;
    }
  }

  private replaceItem(request: RequestDto): void {
    // The row stays where it is, even if it no longer matches the filters, until the list is loaded again
    this.items.update((items) => items.map((item) => (item.id === request.id ? request : item)));
  }
}
