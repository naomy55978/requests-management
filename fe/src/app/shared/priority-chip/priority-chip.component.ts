import { Component, computed, input } from '@angular/core';

import { RequestPriority } from '../../core/api/api.models';
import { PRIORITY_LABELS } from '../../core/i18n/labels';

/** A request priority as a colored chip. The color is only a hint: the Hebrew text always says the priority. */
@Component({
  selector: 'app-priority-chip',
  templateUrl: './priority-chip.component.html',
  styleUrl: './priority-chip.component.scss',
})
export class PriorityChipComponent {
  readonly priority = input.required<RequestPriority>();

  protected readonly label = computed(() => PRIORITY_LABELS[this.priority()]);
}
