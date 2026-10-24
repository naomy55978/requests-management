import { Injectable, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Subject, catchError, distinctUntilChanged, map, of, scan, startWith, switchMap, tap } from 'rxjs';

import { PagedResult, RequestDto, RequestListQuery, RequestSortField, SortDirection } from '../../core/api/api.models';
import { describeHttpError } from '../../core/api/error-messages';
import { RequestsApiService } from '../../core/api/requests-api.service';

export const DEFAULT_PAGE_SIZE = 20;

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

type LoadOutcome = { result: PagedResult<RequestDto>; error?: undefined } | { error: string; result?: undefined };

/**
 * State of the requests list. Everything the user can change (page, sort, filters, search, retry) goes through
 * ONE stream: changes are folded into the current query, and every new query is sent to the server with switchMap,
 * so the previous request is cancelled if it has not finished. Paging, sorting and filtering are done by the
 * server only; this class never touches the rows.
 *
 * Provided by the page component, so the state (and the rows) are dropped when the page is closed.
 */
@Injectable()
export class RequestsListStore {
  private readonly api = inject(RequestsApiService);
  private readonly changes$ = new Subject<QueryChange>();

  /** The query behind the rows on screen (and the one being loaded). */
  readonly query = signal<RequestListQuery>(DEFAULT_QUERY);
  readonly items = signal<RequestDto[]>([]);
  readonly totalCount = signal(0);
  readonly loading = signal(false);
  /** Hebrew message of the last failed load; null when the last load succeeded. */
  readonly error = signal<string | null>(null);

  constructor() {
    this.changes$
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
