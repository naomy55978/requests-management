import { HttpErrorResponse } from '@angular/common/http';
import { ComponentFixture, TestBed } from '@angular/core/testing';

import { RequestsApiService } from '../../../core/api/requests-api.service';
import { provideAppIcons } from '../../../core/icons/app-icons';
import { PerformanceLogService } from '../../../core/perf/performance-log.service';
import { createFakeSummaryApi, fakeSummary } from '../summary.test-helpers';
import { DashboardPageComponent } from './dashboard-page.component';

describe('DashboardPageComponent', () => {
  let fixture: ComponentFixture<DashboardPageComponent>;
  let element: HTMLElement;
  let summaryCalls: ReturnType<typeof createFakeSummaryApi>['summaryCalls'];

  beforeEach(async () => {
    const fake = createFakeSummaryApi();
    summaryCalls = fake.summaryCalls;
    await TestBed.configureTestingModule({
      imports: [DashboardPageComponent],
      providers: [{ provide: RequestsApiService, useValue: fake.api }, provideAppIcons()],
    }).compileComponents();

    fixture = TestBed.createComponent(DashboardPageComponent);
    element = fixture.nativeElement as HTMLElement;
    await fixture.whenStable();
  });

  const refreshButton = () => element.querySelector<HTMLButtonElement>('button.refresh');

  it('has the title "לוח בקרה"', () => {
    expect(element.querySelector('h1')?.textContent).toContain('לוח בקרה');
  });

  it('loads the summary when it opens, with placeholders until the numbers arrive', async () => {
    expect(summaryCalls).toHaveLength(1);
    expect(element.querySelectorAll('.placeholder')).toHaveLength(4);

    summaryCalls[0].respond();
    await fixture.whenStable();

    expect(element.querySelectorAll('.placeholder')).toHaveLength(0);
    expect(element.textContent).toContain('1,234');
  });

  describe('the refresh button', () => {
    it('is labelled "רענן" for screen readers', () => {
      expect(refreshButton()?.getAttribute('aria-label')).toBe('רענן');
    });

    it('loads the summary again and shows the new numbers', async () => {
      summaryCalls[0].respond();
      await fixture.whenStable();

      refreshButton()?.click();
      await fixture.whenStable();
      expect(summaryCalls).toHaveLength(2);
      // The old numbers stay until the new ones arrive
      expect(element.textContent).toContain('1,234');

      summaryCalls[1].respond({ ...fakeSummary(), total: 4321 });
      await fixture.whenStable();
      expect(element.textContent).toContain('4,321');
    });
  });

  it('shows an error with "try again", which loads the summary again', async () => {
    summaryCalls[0].fail(new HttpErrorResponse({ status: 503 }));
    await fixture.whenStable();

    expect(element.querySelector('app-summary-cards [role="alert"]')).not.toBeNull();

    element.querySelector<HTMLButtonElement>('app-summary-cards [role="alert"] button')?.click();
    await fixture.whenStable();

    expect(summaryCalls).toHaveLength(2);
  });

  describe('time badge', () => {
    it('shows nothing until the summary load has been measured', () => {
      expect(element.querySelector('app-timing-badge .badge')).toBeNull();
    });

    it('shows how long the summary took and that the server answered from its cache', async () => {
      TestBed.inject(PerformanceLogService).record({
        at: new Date(),
        kind: 'summary',
        method: 'GET',
        status: 200,
        clientMs: 3,
        timing: { totalMs: 1.2, dbMs: 0, queryCount: 0, cache: 'hit' },
      });
      await fixture.whenStable();

      const badge = element.querySelector('app-timing-badge');
      expect(['.label', '.value', '.cache'].map((part) => badge?.querySelector(part)?.textContent)).toEqual([
        'סיכום',
        '1.2 ms',
        'HIT',
      ]);
    });
  });
});
