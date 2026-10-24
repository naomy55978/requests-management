import { DatePipe } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { Component, computed, inject } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialogModule } from '@angular/material/dialog';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';

import { describeHttpError } from '../../../core/api/error-messages';
import { RequestsApiService } from '../../../core/api/requests-api.service';
import { StateMessageComponent } from '../../../shared/state-message/state-message.component';
import { StatusChipComponent } from '../../../shared/status-chip/status-chip.component';

export interface RequestHistoryDialogData {
  id: number;
  title: string;
}

/**
 * The status history of one request: from which status to which, when (in the user's local time) and by whom.
 * Loads when it opens; closing the dialog cancels the request that is still running.
 */
@Component({
  selector: 'app-request-history-dialog',
  imports: [DatePipe, MatButtonModule, MatDialogModule, MatProgressSpinnerModule, StateMessageComponent, StatusChipComponent],
  templateUrl: './request-history-dialog.component.html',
  styleUrl: './request-history-dialog.component.scss',
})
export class RequestHistoryDialogComponent {
  protected readonly data = inject<RequestHistoryDialogData>(MAT_DIALOG_DATA);
  private readonly api = inject(RequestsApiService);

  protected readonly history = rxResource({ stream: () => this.api.history(this.data.id) });

  protected readonly entries = computed(() => this.history.value() ?? []);

  /** Hebrew message of the failed load (404 and the rest are described as everywhere in the app). */
  protected readonly errorMessage = computed(() => {
    const error = this.history.error();
    return error ? describeHttpError(originalError(error)) : null;
  });

  /** 'loading' = nothing to show yet; 'empty' = the request was never changed. */
  protected readonly view = computed<'loading' | 'error' | 'empty' | 'data'>(() => {
    if (this.history.error()) {
      return 'error';
    }
    if (!this.history.hasValue()) {
      return 'loading';
    }
    return this.entries().length > 0 ? 'data' : 'empty';
  });
}

/** A resource wraps an error that is not an Error (like HttpErrorResponse) and keeps the original in `cause`. */
function originalError(error: unknown): unknown {
  if (error instanceof HttpErrorResponse) {
    return error;
  }
  const cause = (error as { cause?: unknown } | null)?.cause;
  return cause instanceof HttpErrorResponse ? cause : error;
}
