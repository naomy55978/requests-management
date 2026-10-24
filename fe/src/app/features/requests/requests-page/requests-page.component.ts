import { Component, DestroyRef, inject, viewChild } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { MatCardModule } from '@angular/material/card';
import { MatDialog } from '@angular/material/dialog';
import { MatPaginatorModule } from '@angular/material/paginator';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSnackBar } from '@angular/material/snack-bar';
import { filter } from 'rxjs';

import { RequestStatus, RequestDto } from '../../../core/api/api.models';
import { STATUS_LABELS } from '../../../core/i18n/labels';

import { StateMessageComponent } from '../../../shared/state-message/state-message.component';
import { BulkBarComponent } from '../bulk-bar/bulk-bar.component';
import { bulkRefreshesSummary, countOutcomes, toBulkResultRows } from '../bulk-result';
import { BulkResultDialogComponent, BulkResultDialogData } from '../bulk-result-dialog/bulk-result-dialog.component';
import { ConfirmCompleteDialogComponent } from '../confirm-complete-dialog/confirm-complete-dialog.component';
import { RequestsFiltersComponent } from '../requests-filters/requests-filters.component';
import { RequestsListStore } from '../requests-list.store';
import { RequestsTableComponent, StatusChangeRequest } from '../requests-table/requests-table.component';
import { StatusChangeOutcome, refreshesSummary } from '../status-update-failure';
import { SummaryCardsComponent } from '../summary-cards/summary-cards.component';
import { SummaryStore } from '../summary.store';

/** The requests screen: puts the parts together and connects them to the store. */
@Component({
  selector: 'app-requests-page',
  imports: [
    BulkBarComponent,
    MatCardModule,
    MatPaginatorModule,
    MatProgressBarModule,
    MatProgressSpinnerModule,
    RequestsFiltersComponent,
    RequestsTableComponent,
    StateMessageComponent,
    SummaryCardsComponent,
  ],
  // A new store for every visit: rows and filters of a previous session never show up for the next user
  providers: [RequestsListStore, SummaryStore],
  templateUrl: './requests-page.component.html',
  styleUrl: './requests-page.component.scss',
})
export class RequestsPageComponent {
  protected readonly store = inject(RequestsListStore);
  protected readonly summaryStore = inject(SummaryStore);

  private readonly filters = viewChild.required(RequestsFiltersComponent);
  private readonly dialog = inject(MatDialog);
  private readonly snackBar = inject(MatSnackBar);
  private readonly destroyRef = inject(DestroyRef);

  /** Page sizes offered to the user; 100 is the most the API accepts. */
  protected readonly pageSizeOptions = [10, 20, 50, 100];

  /**
   * The user picked a status in a row's menu. Completed is final (D-05), so only that change is confirmed first;
   * the others are sent at once.
   */
  protected changeStatus({ row, status }: StatusChangeRequest): void {
    if (status !== 'Completed') {
      this.sendStatusChange(row, status);
      return;
    }

    this.dialog
      .open(ConfirmCompleteDialogComponent, { data: { id: row.id, title: row.title } })
      .afterClosed()
      .pipe(
        filter((confirmed) => confirmed === true),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe(() => this.sendStatusChange(row, status));
  }

  /**
   * The user chose a status for the ticked rows in the bulk bar. Like a single change, only "completed" is confirmed first.
   */
  protected applyBulk(status: RequestStatus): void {
    if (status !== 'Completed') {
      this.sendBulk(status);
      return;
    }

    this.dialog
      .open(ConfirmCompleteDialogComponent, { data: { count: this.store.selectedIds().size } })
      .afterClosed()
      .pipe(
        filter((confirmed) => confirmed === true),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe(() => this.sendBulk(status));
  }

  /** Sends the Bulk call and shows the result of every item; the store reloads the list, the summary is refreshed here. */
  private sendBulk(status: RequestStatus): void {
    this.store
      .bulkChangeStatus(status)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((outcome) => {
        if (outcome.kind === 'error') {
          // The call itself failed (e.g. 400, no connection): nothing was saved and the rows stay ticked
          this.snackBar.open(outcome.message, 'סגור', { duration: 8000 });
          return;
        }

        const { response, titles } = outcome;
        const data: BulkResultDialogData = {
          newStatus: status,
          total: response.total,
          succeeded: response.succeeded,
          failed: response.failed,
          counts: countOutcomes(response.results),
          rows: toBulkResultRows(response.results, titles),
        };
        this.dialog.open(BulkResultDialogComponent, { data, width: '720px', maxWidth: '95vw' });

        if (bulkRefreshesSummary(response)) {
          this.summaryStore.refresh();
        }
      });
  }

  /** Sends the change, tells the user what happened, and refreshes the summary when the server's data changed. */
  private sendStatusChange(row: RequestDto, status: RequestStatus): void {
    this.store
      .changeStatus(row, status)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((outcome) => {
        this.snackBar.open(this.describe(outcome), 'סגור', { duration: outcome.kind === 'updated' ? 4000 : 8000 });
        // The server dropped its summary cache (D-11, D-20), so the numbers on screen are old now
        if (refreshesSummary(outcome)) {
          this.summaryStore.refresh();
        }
      });
  }

  private describe(outcome: StatusChangeOutcome): string {
    return outcome.kind === 'updated'
      ? `פנייה ${outcome.request.id} עודכנה ל«${STATUS_LABELS[outcome.request.status]}».`
      : outcome.message;
  }

  /** "Clear filters" on an empty result: the form is the one that knows how to reset itself (and tells the store). */
  protected clearFilters(): void {
    this.filters().clear();
  }
}
