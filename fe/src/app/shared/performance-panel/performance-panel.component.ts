import { DatePipe } from '@angular/common';
import { Component, ElementRef, afterNextRender, computed, inject, viewChild } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';

import { formatMs } from '../../core/perf/format-ms';
import { PerformanceEntry, PerformanceLogService, REQUEST_KIND_LABELS } from '../../core/perf/performance-log.service';

/** How many of the latest requests the chart draws. */
const CHART_BARS = 30;

/** One bar of the chart. Heights are percentages of the slowest bar. */
interface ChartBar {
  id: number;
  totalPercent: number;
  /** The database part, as a percentage of this bar's own height. */
  dbPercent: number;
  failed: boolean;
  title: string;
}

/** One line of the table, already formatted. A member the server did not report is an en dash. */
interface TableRow {
  id: number;
  at: Date;
  kind: string;
  status: number;
  failed: boolean;
  server: string;
  database: string;
  /** Number of database commands, when reported. */
  queries: number | null;
  cache: string;
  browser: string;
}

const MISSING = '–';

/**
 * The recent requests to the API with their times (D-23): a small bar chart and a table. It is opened from the
 * toolbar and closed by default, and only shows what the interceptor noted; it loads and changes nothing.
 */
@Component({
  selector: 'app-performance-panel',
  imports: [DatePipe, MatButtonModule],
  templateUrl: './performance-panel.component.html',
  styleUrl: './performance-panel.component.scss',
})
export class PerformancePanelComponent {
  private readonly log = inject(PerformanceLogService);
  private readonly heading = viewChild.required<ElementRef<HTMLElement>>('heading');

  constructor() {
    // The panel is opened by a button far from where it appears (and the page may be scrolled): moving focus here
    // brings it into view and tells a screen reader user that something opened.
    afterNextRender(() => this.heading().nativeElement.focus());
  }

  protected readonly entries = this.log.entries;

  protected readonly rows = computed<TableRow[]>(() =>
    this.entries().map((entry) => ({
      id: entry.id,
      at: entry.at,
      kind: REQUEST_KIND_LABELS[entry.kind],
      status: entry.status,
      failed: entry.status >= 400,
      server: entry.timing?.totalMs != null ? formatMs(entry.timing.totalMs) : MISSING,
      database: entry.timing?.dbMs != null ? formatMs(entry.timing.dbMs) : MISSING,
      queries: entry.timing?.queryCount ?? null,
      cache: entry.timing?.cache ? entry.timing.cache.toUpperCase() : MISSING,
      browser: formatMs(entry.clientMs),
    })),
  );

  protected readonly averageText = computed(() => {
    const average = this.average();
    return average === null ? null : formatMs(average);
  });

  /** The time to compare requests by: the server's total when it sent one, else the browser's. */
  private readonly timeOf = (entry: PerformanceEntry): number => entry.timing?.totalMs ?? entry.clientMs;

  protected readonly average = computed(() => {
    const entries = this.entries();
    return entries.length === 0 ? null : entries.reduce((sum, entry) => sum + this.timeOf(entry), 0) / entries.length;
  });

  /** The newest request first, which in an RTL page is the bar at the right edge. */
  protected readonly bars = computed<ChartBar[]>(() => {
    const latest = this.entries().slice(0, CHART_BARS);
    const slowest = Math.max(1, ...latest.map(this.timeOf));

    return latest.map((entry) => {
      const total = this.timeOf(entry);
      const db = Math.min(entry.timing?.dbMs ?? 0, total);
      return {
        id: entry.id,
        totalPercent: Math.max(2, (total / slowest) * 100),
        dbPercent: total > 0 ? (db / total) * 100 : 0,
        failed: entry.status >= 400,
        title: `${REQUEST_KIND_LABELS[entry.kind]}: ${formatMs(total)}${entry.timing?.dbMs != null ? `, מסד נתונים ${formatMs(entry.timing.dbMs)}` : ''}`,
      };
    });
  });

  protected clear(): void {
    this.log.clear();
  }
}
