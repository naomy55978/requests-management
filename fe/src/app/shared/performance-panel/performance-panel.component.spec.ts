import { ComponentFixture, TestBed } from '@angular/core/testing';

import { MAX_ENTRIES, PerformanceEntry, PerformanceLogService } from '../../core/perf/performance-log.service';
import { PerformancePanelComponent } from './performance-panel.component';

type NewEntry = Omit<PerformanceEntry, 'id'>;

function entry(overrides: Partial<NewEntry> = {}): NewEntry {
  return {
    at: new Date(2026, 9, 24, 14, 5, 9),
    kind: 'list',
    method: 'GET',
    status: 200,
    clientMs: 20,
    timing: { totalMs: 10, dbMs: 4, queryCount: 2, cache: null },
    ...overrides,
  };
}

describe('PerformancePanelComponent', () => {
  let fixture: ComponentFixture<PerformancePanelComponent>;
  let element: HTMLElement;
  let log: PerformanceLogService;

  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [PerformancePanelComponent] }).compileComponents();
    log = TestBed.inject(PerformanceLogService);
    fixture = TestBed.createComponent(PerformancePanelComponent);
    element = fixture.nativeElement as HTMLElement;
    await fixture.whenStable();
  });

  const rows = () => Array.from(element.querySelectorAll('tbody tr'));
  const cells = (row: Element) => Array.from(row.querySelectorAll('td')).map((td) => td.textContent?.replace(/\s+/g, ' ').trim());

  it('says there are no requests yet, with no chart or table', () => {
    expect(element.textContent).toContain('עדיין לא נרשמו בקשות');
    expect(element.querySelector('.chart')).toBeNull();
    expect(element.querySelector('table')).toBeNull();
    expect(element.querySelector<HTMLButtonElement>('header button')?.disabled).toBe(true);
  });

  it('lists the requests newest first with time, action, code, server, database (queries), cache and browser', async () => {
    log.record(entry({ kind: 'summary', timing: { totalMs: 90.4, dbMs: 80, queryCount: 3, cache: 'miss' }, clientMs: 95 }));
    log.record(entry({ kind: 'list', timing: { totalMs: 8.25, dbMs: 3, queryCount: 1, cache: null }, clientMs: 12 }));
    await fixture.whenStable();

    expect(rows()).toHaveLength(2);
    expect(cells(rows()[0])).toEqual(['14:05:09', 'רשימה', '200', '8.3 ms', '3.0 ms (1)', '–', '12 ms']);
    expect(cells(rows()[1])).toEqual(['14:05:09', 'סיכום', '200', '90 ms', '80 ms (3)', 'MISS', '95 ms']);
  });

  it('shows an en dash for what the server did not report, and still shows the browser time', async () => {
    log.record(entry({ timing: null, clientMs: 33 }));
    await fixture.whenStable();

    expect(cells(rows()[0])).toEqual(['14:05:09', 'רשימה', '200', '–', '–', '–', '33 ms']);
  });

  it('marks a failed request', async () => {
    log.record(entry({ kind: 'status', method: 'PATCH', status: 409 }));
    await fixture.whenStable();

    expect(rows()[0].classList.contains('failed')).toBe(true);
    expect(element.querySelector('.bar')?.classList.contains('failed')).toBe(true);
  });

  it('summarizes: how many requests and the average time', async () => {
    log.record(entry({ timing: { totalMs: 10, dbMs: 1, queryCount: 1, cache: null } }));
    log.record(entry({ timing: { totalMs: 30, dbMs: 1, queryCount: 1, cache: null } }));
    await fixture.whenStable();

    expect(element.querySelector('.panel-note')?.textContent).toContain('2 בקשות');
    expect(element.querySelector('.panel-note')?.textContent).toContain('ממוצע 20 ms');
  });

  describe('chart', () => {
    it('draws a bar for each request, the slowest at full height, with the database part inside it', async () => {
      log.record(entry({ timing: { totalMs: 50, dbMs: 25, queryCount: 1, cache: null } }));
      log.record(entry({ timing: { totalMs: 100, dbMs: 100, queryCount: 1, cache: null } }));
      await fixture.whenStable();

      const bars = Array.from(element.querySelectorAll<HTMLElement>('.bar'));
      // Newest first: the 100 ms request, then the 50 ms one
      expect(bars.map((b) => b.style.height)).toEqual(['100%', '50%']);
      expect(bars.map((b) => b.querySelector<HTMLElement>('.bar-db')?.style.height)).toEqual(['100%', '50%']);
    });

    it('gives every bar a title that says what it is', async () => {
      log.record(entry({ kind: 'summary', timing: { totalMs: 12, dbMs: 8, queryCount: 2, cache: null } }));
      await fixture.whenStable();

      expect(element.querySelector('.bar')?.getAttribute('title')).toBe('סיכום: 12 ms, מסד נתונים 8.0 ms');
    });

    it('draws at most 30 bars even though the table has up to 50 lines', async () => {
      for (let i = 0; i < MAX_ENTRIES; i++) {
        log.record(entry());
      }
      await fixture.whenStable();

      expect(element.querySelectorAll('.bar')).toHaveLength(30);
      expect(rows()).toHaveLength(MAX_ENTRIES);
    });

    it('uses the browser time for a request without a server time, and never overflows its bar', async () => {
      log.record(entry({ timing: null, clientMs: 40 }));
      log.record(entry({ timing: { totalMs: 10, dbMs: 999, queryCount: 1, cache: null } }));
      await fixture.whenStable();

      const bars = Array.from(element.querySelectorAll<HTMLElement>('.bar'));
      expect(bars[0].querySelector<HTMLElement>('.bar-db')?.style.height).toBe('100%');
      expect(bars[1].style.height).toBe('100%');
    });

    it('is hidden from screen readers: the table says the same', async () => {
      log.record(entry());
      await fixture.whenStable();

      expect(element.querySelector('.chart')?.getAttribute('aria-hidden')).toBe('true');
    });
  });

  it('empties the list with "נקה"', async () => {
    log.record(entry());
    await fixture.whenStable();

    element.querySelector<HTMLButtonElement>('header button')?.click();
    await fixture.whenStable();

    expect(log.entries()).toEqual([]);
    expect(element.textContent).toContain('עדיין לא נרשמו בקשות');
  });
});
