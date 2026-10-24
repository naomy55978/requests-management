import { Component, computed, input } from '@angular/core';
import { MatTooltipModule } from '@angular/material/tooltip';

import { formatMs } from '../../core/perf/format-ms';
import { PerformanceEntry } from '../../core/perf/performance-log.service';

/**
 * A small, quiet note of how long a load took ("42 ms"), with the cache outcome for the summary. The details
 * (server, database, queries, browser) are in the tooltip. Shows nothing until there is a measurement.
 */
@Component({
  selector: 'app-timing-badge',
  imports: [MatTooltipModule],
  templateUrl: './timing-badge.component.html',
  styleUrl: './timing-badge.component.scss',
})
export class TimingBadgeComponent {
  readonly entry = input<PerformanceEntry | null>(null);
  /** What was loaded ("רשימה", "סיכום"), shown before the time. */
  readonly label = input('');

  protected readonly view = computed(() => {
    const entry = this.entry();
    if (!entry) {
      return null;
    }

    const timing = entry.timing;
    // The server's own time when it sent one; otherwise what the browser measured
    const ms = timing?.totalMs ?? entry.clientMs;
    const parts: string[] = [];
    if (timing?.totalMs != null) {
      parts.push(`שרת: ${formatMs(timing.totalMs)}`);
    }
    if (timing?.dbMs != null) {
      const queries = timing.queryCount != null ? ` (${timing.queryCount} שאילתות)` : '';
      parts.push(`מסד נתונים: ${formatMs(timing.dbMs)}${queries}`);
    }
    if (timing?.cache) {
      parts.push(`Cache: ${timing.cache === 'hit' ? 'HIT' : 'MISS'}`);
    }
    parts.push(`דפדפן: ${formatMs(entry.clientMs)}`);

    return { text: formatMs(ms), cache: timing?.cache ?? null, tooltip: parts.join(' · ') };
  });
}
