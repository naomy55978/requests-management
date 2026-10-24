import { Component, computed, input, output, signal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSelectModule } from '@angular/material/select';

import { RequestStatus } from '../../../core/api/api.models';
import { STATUS_LABELS } from '../../../core/i18n/labels';

/**
 * The bar above the table while rows are ticked: how many, the status to move them to, and the buttons.
 * It shows what it is given and reports the choice; the Bulk call itself is sent by the page through the store.
 */
@Component({
  selector: 'app-bulk-bar',
  imports: [MatButtonModule, MatFormFieldModule, MatProgressSpinnerModule, MatSelectModule],
  templateUrl: './bulk-bar.component.html',
  styleUrl: './bulk-bar.component.scss',
})
export class BulkBarComponent {
  readonly count = input.required<number>();
  /** The statuses on offer (the ones at least one selected row can move to). */
  readonly targets = input.required<readonly RequestStatus[]>();
  /** True while the call is on its way. */
  readonly busy = input(false);

  /** The user wants the selected rows moved to this status. */
  readonly apply = output<RequestStatus>();
  readonly clear = output<void>();

  protected readonly statusLabels = STATUS_LABELS;
  private readonly chosen = signal<RequestStatus | null>(null);

  /** The chosen status, as long as it is still on offer (the selection can change under it). */
  protected readonly target = computed(() => {
    const chosen = this.chosen();
    return chosen && this.targets().includes(chosen) ? chosen : null;
  });

  protected choose(status: RequestStatus): void {
    this.chosen.set(status);
  }

  protected submit(): void {
    const target = this.target();
    if (target && !this.busy()) {
      this.apply.emit(target);
    }
  }
}
