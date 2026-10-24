import { Component, inject } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialogModule } from '@angular/material/dialog';

export interface ConfirmCompleteData {
  id: number;
  title: string;
}

/**
 * Asks the user to confirm moving a request to "completed". Completed is final (D-05): there is no way back,
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
}
