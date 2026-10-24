import { Component, inject } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialogModule } from '@angular/material/dialog';

import { RequestStatus } from '../../../core/api/api.models';
import { STATUS_LABELS } from '../../../core/i18n/labels';
import { BulkResultRow } from '../bulk-result';

export interface BulkResultDialogData {
  newStatus: RequestStatus;
  total: number;
  succeeded: number;
  failed: number;
  /** How many items ended with each outcome (only the outcomes that happened). */
  counts: { outcome: string; label: string; count: number }[];
  rows: BulkResultRow[];
}

/** The result of a Bulk change, item by item (Partial Success: some may have worked and some not). */
@Component({
  selector: 'app-bulk-result-dialog',
  imports: [MatButtonModule, MatDialogModule],
  templateUrl: './bulk-result-dialog.component.html',
  styleUrl: './bulk-result-dialog.component.scss',
})
export class BulkResultDialogComponent {
  protected readonly data = inject<BulkResultDialogData>(MAT_DIALOG_DATA);
  protected readonly targetLabel = STATUS_LABELS[this.data.newStatus];
}
