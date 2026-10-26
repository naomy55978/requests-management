import { Component, inject } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialogModule } from '@angular/material/dialog';

import { describeSelectedCount } from '../../../core/i18n/labels';

/** One request (id and title), or several (count) when the change comes from Bulk. */
export interface ConfirmCompleteData {
  id?: number;
  title?: string;
  count?: number;
}

/**
 * Asks the user to confirm moving one request, or the selected requests, to "completed". Completed is final (D-05): there is no way back,
 * so this is the only status change that is confirmed. Closes with `true` when confirmed; a cancel closes it without `true`.
 */
@Component({
  selector: 'app-confirm-complete-dialog',
  imports: [MatButtonModule, MatDialogModule],
  templateUrl: './confirm-complete-dialog.component.html',
  styleUrl: './confirm-complete-dialog.component.scss',
})
export class ConfirmCompleteDialogComponent {
  protected readonly data = inject<ConfirmCompleteData>(MAT_DIALOG_DATA);
  protected readonly bulk = this.data.count !== undefined;
  /** Hebrew has a singular form: one selected request is "the request", not "the requests". */
  protected readonly plural = this.bulk && this.data.count !== 1;
  protected readonly selectedText = describeSelectedCount(this.data.count ?? 0);
}
