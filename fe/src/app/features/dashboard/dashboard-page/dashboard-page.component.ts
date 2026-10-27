import { Component, computed, inject } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';

import { PerformanceLogService } from '../../../core/perf/performance-log.service';
import { SHOW_PERFORMANCE } from '../../../core/perf/show-performance';
import { TimingBadgeComponent } from '../../../shared/timing-badge/timing-badge.component';
import { SummaryCardsComponent } from '../summary-cards/summary-cards.component';
import { SummaryStore } from '../summary.store';

/**
 * The dashboard (D-43): the summary of all requests, the screen the app opens after login. The summary loads when
 * the screen opens; there is no automatic refresh, so the refresh button is how a user who stays gets new numbers (D-38).
 */
@Component({
  selector: 'app-dashboard-page',
  imports: [MatButtonModule, MatIconModule, SummaryCardsComponent, TimingBadgeComponent],
  // A new store for every visit, like the list store (D-27): numbers of a previous session never show up for the next user
  providers: [SummaryStore],
  templateUrl: './dashboard-page.component.html',
  styleUrl: './dashboard-page.component.scss',
})
export class DashboardPageComponent {
  protected readonly summaryStore = inject(SummaryStore);
  private readonly performance = inject(PerformanceLogService);

  /** The time badge is part of the optional performance UI. */
  protected readonly showPerformance = inject(SHOW_PERFORMANCE);

  /** How long the last summary load took, and whether the server answered from its cache (null until the first answer). */
  protected readonly summaryTiming = computed(() => this.performance.latest('summary'));
}
