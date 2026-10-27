import { Injectable, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Subject, catchError, map, of, startWith, switchMap, tap } from 'rxjs';

import { SummaryDto } from '../../core/api/api.models';
import { describeHttpError } from '../../core/api/error-messages';
import { RequestsApiService } from '../../core/api/requests-api.service';

type LoadOutcome = { summary: SummaryDto; error?: undefined } | { error: string; summary?: undefined };

/**
 * State of the summary cards. It has its own loading and error state and its own request, so a slow or failed
 * summary never blocks anything else. It loads when the dashboard opens, and `refresh()` loads it again (retry after
 * an error, or the refresh button): there is no automatic refresh, and a status change on the requests screen needs
 * none, because the next visit to the dashboard loads fresh numbers (the server dropped its cache then, D-11, D-20).
 *
 * Provided by the dashboard page component, like the list store (D-27).
 */
@Injectable()
export class SummaryStore {
  private readonly api = inject(RequestsApiService);
  private readonly refresh$ = new Subject<void>();

  readonly summary = signal<SummaryDto | null>(null);
  readonly loading = signal(false);
  /** Hebrew message of the last failed load; null when the last load succeeded. */
  readonly error = signal<string | null>(null);

  /** Loads the summary on start and on every refresh, keeping the summary, loading and error signals in step. */
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

  /** Loads the summary again (retry after an error, or the refresh button). */
  refresh(): void {
    this.refresh$.next();
  }
}
