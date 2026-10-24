import { Injectable, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Subject, catchError, map, of, startWith, switchMap, tap } from 'rxjs';

import { SummaryDto } from '../../core/api/api.models';
import { describeHttpError } from '../../core/api/error-messages';
import { RequestsApiService } from '../../core/api/requests-api.service';

type LoadOutcome = { summary: SummaryDto; error?: undefined } | { error: string; summary?: undefined };

/**
 * State of the summary cards. It has its own loading and error state and its own request, so a slow or failed
 * summary never blocks the list (and the other way round). `refresh()` loads it again: the page calls it after a
 * status change, because the server has dropped its cache then (D-11, D-20) and the numbers are different.
 *
 * Provided by the page component, like the list store (D-27).
 */
@Injectable()
export class SummaryStore {
  private readonly api = inject(RequestsApiService);
  private readonly refresh$ = new Subject<void>();

  readonly summary = signal<SummaryDto | null>(null);
  readonly loading = signal(false);
  /** Hebrew message of the last failed load; null when the last load succeeded. */
  readonly error = signal<string | null>(null);

  constructor() {
    this.refresh$
      .pipe(
        startWith(undefined),
        tap(() => {
          // The numbers on screen stay until the new ones arrive
          this.loading.set(true);
          this.error.set(null);
        }),
        // A newer refresh cancels the request that is still running
        switchMap(() =>
          this.api.summary().pipe(
            map((summary): LoadOutcome => ({ summary })),
            // Caught inside switchMap: a failed request must not end the stream for later refreshes
            catchError((error: unknown) => of<LoadOutcome>({ error: describeHttpError(error) })),
          ),
        ),
        takeUntilDestroyed(),
      )
      .subscribe((outcome) => {
        this.loading.set(false);
        if (outcome.summary) {
          this.summary.set(outcome.summary);
        } else {
          // Old numbers next to an error message would look current
          this.summary.set(null);
          this.error.set(outcome.error);
        }
      });
  }

  /** Loads the summary again (retry after an error, refresh after a status change). */
  refresh(): void {
    this.refresh$.next();
  }
}
