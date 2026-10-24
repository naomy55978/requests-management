import { Component, computed, input } from '@angular/core';

import { RequestStatus } from '../../core/api/api.models';
import { STATUS_LABELS } from '../../core/i18n/labels';

/** A request status as a colored chip. The color is only a hint: the Hebrew text always says the status. */
@Component({
  selector: 'app-status-chip',
  templateUrl: './status-chip.component.html',
  styleUrl: './status-chip.component.scss',
})
export class StatusChipComponent {
  readonly status = input.required<RequestStatus>();

  protected readonly label = computed(() => STATUS_LABELS[this.status()]);
}
