import { Component, DestroyRef, computed, inject, viewChild } from '@angular/core';
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
import { PerformanceLogService } from '../../../core/perf/performance-log.service';
import { SHOW_PERFORMANCE } from '../../../core/perf/show-performance';

import { StateMessageComponent } from '../../../shared/state-message/state-message.component';
import { TimingBadgeComponent } from '../../../shared/timing-badge/timing-badge.component';
import { BulkBarComponent } from '../bulk-bar/bulk-bar.component';
import { countOutcomes, toBulkResultRows } from '../bulk-result';
import { BulkResultDialogComponent, BulkResultDialogData } from '../bulk-result-dialog/bulk-result-dialog.component';
import { ConfirmCompleteData, ConfirmCompleteDialogComponent } from '../confirm-complete-dialog/confirm-complete-dialog.component';
import { RequestHistoryDialogComponent } from '../request-history-dialog/request-history-dialog.component';
import { RequestsFiltersComponent } from '../requests-filters/requests-filters.component';
import { RequestsListStore } from '../requests-list.store';
import { RequestsTableComponent, StatusChangeRequest } from '../requests-table/requests-table.component';
import { StatusChangeOutcome } from '../status-update-failure';

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
    TimingBadgeComponent,
  ],
  // A new store for every visit: rows and filters of a previous session never show up for the next user
  providers: [RequestsListStore],
  templateUrl: './requests-page.component.html',
  styleUrl: './requests-page.component.scss',
})
export class RequestsPageComponent {
  protected readonly store = inject(RequestsListStore);

  private readonly filters = viewChild.required(RequestsFiltersComponent);
  private readonly dialog = inject(MatDialog);
  private readonly snackBar = inject(MatSnackBar);
  private readonly destroyRef = inject(DestroyRef);
  private readonly performance = inject(PerformanceLogService);

  /** The time badge is part of the optional performance UI. */
  protected readonly showPerformance = inject(SHOW_PERFORMANCE);

  /** How long the last list load took (null until the first answer). */
  protected readonly listTiming = computed(() => this.performance.latest('list'));

  /**
   * Said to screen readers when a load has finished with rows, so a search or filter gives feedback without sight.
   * Empty while loading and in the error and empty states: those have their own announcement (role alert / status).
   */
  protected readonly resultAnnouncement = computed(() => {
    if (this.store.loading() || this.store.viewState() !== 'data') {
      return '';
    }
    const total = this.store.totalCount();
    return total === 1 ? 'נמצאה פנייה אחת' : `נמצאו ${total.toLocaleString('he-IL')} פניות`;
  });

  /** Page sizes offered to the user; 100 is the most the API accepts. */
  protected readonly pageSizeOptions = [10, 20, 50, 100];

  /** The user picked a status in a row's menu. */
  protected changeStatus({ row, status }: StatusChangeRequest): void {
    this.confirmThenSend(status, { id: row.id, title: row.title }, () => this.sendStatusChange(row, status));
  }

  /** The user chose a status for the ticked rows in the bulk bar. */
  protected applyBulk(status: RequestStatus): void {
    this.confirmThenSend(status, { count: this.store.selectedIds().size }, () => this.sendBulk(status));
  }

  /**
   * Completed is final (D-05), so only a move to it is confirmed first (one row or Bulk alike); the other
   * statuses are sent at once. A cancel sends nothing.
   */
  private confirmThenSend(status: RequestStatus, subject: ConfirmCompleteData, send: () => void): void {
    if (status !== 'Completed') {
      send();
      return;
    }

    this.dialog
      .open(ConfirmCompleteDialogComponent, { data: subject })
      .afterClosed()
      .pipe(
        filter((confirmed) => confirmed === true),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe(send);
  }

  /** Sends the Bulk call and shows the result of every item; the store reloads the list. */
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
      });
  }

  protected openHistory(row: RequestDto): void {
    this.dialog.open(RequestHistoryDialogComponent, { data: { id: row.id, title: row.title }, width: '560px', maxWidth: '95vw' });
  }

  /** Sends the change and tells the user what happened. */
  private sendStatusChange(row: RequestDto, status: RequestStatus): void {
    this.store
      .changeStatus(row, status)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((outcome) => {
        this.snackBar.open(this.describe(outcome), 'סגור', { duration: outcome.kind === 'updated' ? 4000 : 8000 });
      });
  }

  /** The Hebrew snackbar text for the outcome of a single status change. */
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
