import { DecimalPipe } from '@angular/common';
import { Component, computed, input, output } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';

import { SummaryDto } from '../../../core/api/api.models';
import { PriorityChipComponent } from '../../../shared/priority-chip/priority-chip.component';
import { StatusChipComponent } from '../../../shared/status-chip/status-chip.component';

/**
 * The summary: total, counts by status and priority, and the organizations with the most open requests.
 * Shows what it is given and has its own loading and error state; the list below does not wait for it.
 */
@Component({
  selector: 'app-summary-cards',
  imports: [DecimalPipe, MatButtonModule, MatCardModule, StatusChipComponent, PriorityChipComponent],
  templateUrl: './summary-cards.component.html',
  styleUrl: './summary-cards.component.scss',
})
export class SummaryCardsComponent {
  readonly summary = input<SummaryDto | null>(null);
  readonly loading = input(false);
  /** Hebrew message when the summary could not be loaded. */
  readonly error = input<string | null>(null);

  readonly retry = output<void>();

  /** 'loading' = nothing to show yet; while a refresh runs the old numbers stay ('data', dimmed by `loading`). */
  protected readonly view = computed<'error' | 'loading' | 'data'>(() => {
    if (this.error()) {
      return 'error';
    }
    return this.summary() ? 'data' : 'loading';
  });

  /** The widest count of the organizations list is the full bar, so the bars can be compared. */
  protected readonly topOrganizations = computed(() => {
    const organizations = this.summary()?.topOrganizations ?? [];
    const max = Math.max(1, ...organizations.map((o) => o.openRequests));
    return organizations.map((o) => ({ ...o, share: (o.openRequests / max) * 100 }));
  });
}
