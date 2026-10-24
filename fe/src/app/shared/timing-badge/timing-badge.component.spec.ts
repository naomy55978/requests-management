import { ComponentFixture, TestBed } from '@angular/core/testing';

import { PerformanceEntry } from '../../core/perf/performance-log.service';
import { TimingBadgeComponent } from './timing-badge.component';

function entry(overrides: Partial<PerformanceEntry> = {}): PerformanceEntry {
  return {
    id: 1,
    at: new Date(),
    kind: 'list',
    method: 'GET',
    status: 200,
    clientMs: 18.2,
    timing: { totalMs: 12.4, dbMs: 8.1, queryCount: 2, cache: null },
    ...overrides,
  };
}

describe('TimingBadgeComponent', () => {
  let fixture: ComponentFixture<TimingBadgeComponent>;
  let element: HTMLElement;

  async function show(inputs: { entry: PerformanceEntry | null; label?: string }): Promise<void> {
    await TestBed.configureTestingModule({ imports: [TimingBadgeComponent] }).compileComponents();
    fixture = TestBed.createComponent(TimingBadgeComponent);
    fixture.componentRef.setInput('entry', inputs.entry);
    fixture.componentRef.setInput('label', inputs.label ?? '');
    element = fixture.nativeElement as HTMLElement;
    await fixture.whenStable();
  }

  it('shows nothing until there is a measurement', async () => {
    await show({ entry: null });

    expect(element.querySelector('.badge')).toBeNull();
    expect(element.textContent?.trim()).toBe('');
  });

  it('shows the server time, with the label', async () => {
    await show({ entry: entry(), label: 'רשימה' });

    expect(element.querySelector('.label')?.textContent).toBe('רשימה');
    expect(element.querySelector('.value')?.textContent).toBe('12 ms');
    expect(element.querySelector('.cache')).toBeNull();
  });

  it('shows HIT or MISS when the server reports the cache', async () => {
    await show({ entry: entry({ timing: { totalMs: 1.2, dbMs: 0, queryCount: 0, cache: 'hit' } }), label: 'סיכום' });
    expect(element.querySelector('.cache')?.textContent).toBe('HIT');

    fixture.componentRef.setInput('entry', entry({ timing: { totalMs: 90, dbMs: 80, queryCount: 3, cache: 'miss' } }));
    await fixture.whenStable();
    expect(element.querySelector('.cache')?.textContent).toBe('MISS');
  });

  it('falls back to the time the browser measured when the server sent no header', async () => {
    await show({ entry: entry({ timing: null, clientMs: 55.7 }) });

    expect(element.querySelector('.value')?.textContent).toBe('56 ms');
  });

  it('puts the details in the accessible description: server, database with queries, cache and browser', async () => {
    await show({
      entry: entry({ timing: { totalMs: 12.4, dbMs: 8.1, queryCount: 2, cache: 'miss' }, clientMs: 18.2 }),
      label: 'סיכום',
    });

    const description = element.querySelector('.badge')?.getAttribute('aria-label') ?? '';
    expect(description).toContain('סיכום: 12 ms');
    expect(description).toContain('שרת: 12 ms');
    expect(description).toContain('מסד נתונים: 8.1 ms (2 שאילתות)');
    expect(description).toContain('Cache: MISS');
    expect(description).toContain('דפדפן: 18 ms');
  });

  it('can be reached with the keyboard, so the details are not mouse-only', async () => {
    await show({ entry: entry() });

    expect(element.querySelector('.badge')?.getAttribute('tabindex')).toBe('0');
  });
});
