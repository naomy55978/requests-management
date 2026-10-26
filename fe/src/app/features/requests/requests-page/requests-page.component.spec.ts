import { HttpErrorResponse } from '@angular/common/http';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MatDialog } from '@angular/material/dialog';
import { MAT_DATE_LOCALE, provideNativeDateAdapter } from '@angular/material/core';

import { RequestsApiService } from '../../../core/api/requests-api.service';
import { PerformanceLogService } from '../../../core/perf/performance-log.service';
import { provideAppIcons } from '../../../core/icons/app-icons';
import { createFakeApi, fakeRequest } from '../requests-list.store.test-helpers';
import { RequestsPageComponent } from './requests-page.component';

describe('RequestsPageComponent', () => {
  let fixture: ComponentFixture<RequestsPageComponent>;
  let element: HTMLElement;
  let calls: ReturnType<typeof createFakeApi>['calls'];
  let statusCalls: ReturnType<typeof createFakeApi>['statusCalls'];
  let bulkCalls: ReturnType<typeof createFakeApi>['bulkCalls'];

  beforeEach(async () => {
    const fake = createFakeApi();
    calls = fake.calls;
    statusCalls = fake.statusCalls;
    bulkCalls = fake.bulkCalls;
    await TestBed.configureTestingModule({
      imports: [RequestsPageComponent],
      providers: [
        { provide: RequestsApiService, useValue: fake.api },
        provideNativeDateAdapter(),
        { provide: MAT_DATE_LOCALE, useValue: 'he-IL' },
        provideAppIcons(),
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(RequestsPageComponent);
    element = fixture.nativeElement as HTMLElement;
    await fixture.whenStable();
  });

  const rows = () => element.querySelectorAll('tr.mat-mdc-row');
  const text = () => element.textContent ?? '';

  it('shows a loading indicator while the first page is on its way', () => {
    expect(element.querySelector('mat-spinner')).not.toBeNull();
    expect(rows()).toHaveLength(0);
  });

  it('shows the rows, and no state message, when the server answers with data', async () => {
    calls[0].respond([fakeRequest(1), fakeRequest(2)], 2);
    await fixture.whenStable();

    expect(rows()).toHaveLength(2);
    expect(element.querySelector('mat-spinner')).toBeNull();
    expect(element.querySelector('app-state-message')).toBeNull();
  });

  it('keeps the rows on screen, dimmed, while the next page loads (no spinner replaces them)', async () => {
    calls[0].respond([fakeRequest(1), fakeRequest(2)], 100);
    await fixture.whenStable();

    element.querySelector<HTMLButtonElement>('button.mat-mdc-paginator-navigation-next')?.click();
    await fixture.whenStable();

    expect(calls).toHaveLength(2);
    expect(rows()).toHaveLength(2);
    expect(element.querySelector('mat-spinner')).toBeNull();
    expect(element.querySelector('.table-scroll')?.classList.contains('busy')).toBe(true);
  });

  it('shows "no requests" when there are none and no filter is set', async () => {
    calls[0].respond([], 0);
    await fixture.whenStable();

    expect(text()).toContain('אין פניות להצגה.');
    // Nothing to clear, so the message offers no button
    expect(element.querySelector('app-state-message button')).toBeNull();
  });

  it('shows "nothing matches" with a clear button when a filter is behind the empty result', async () => {
    calls[0].respond([fakeRequest(1)], 1);
    await fixture.whenStable();
    const search = element.querySelector<HTMLInputElement>('input[formcontrolname="search"]')!;
    search.value = 'zzzz';
    search.dispatchEvent(new Event('input'));
    await new Promise((resolve) => setTimeout(resolve, 400)); // the typing pause
    calls[1].respond([], 0);
    await fixture.whenStable();

    expect(text()).toContain('לא נמצאו פניות שמתאימות לסינון ולחיפוש.');

    element.querySelector<HTMLButtonElement>('app-state-message button')?.click();
    await fixture.whenStable();

    expect(calls[2].query.search).toBe('');
    expect(search.value).toBe('');
  });

  it('shows the error with a retry button that loads the same query again', async () => {
    calls[0].fail(new HttpErrorResponse({ status: 0 }));
    await fixture.whenStable();

    expect(element.querySelector('[role="alert"]')?.textContent).toContain('אין חיבור לשרת');

    element.querySelector<HTMLButtonElement>('app-state-message button')?.click();
    await fixture.whenStable();
    expect(calls).toHaveLength(2);
    expect(element.querySelector('mat-spinner')).not.toBeNull();

    calls[1].respond([fakeRequest(5)], 1);
    await fixture.whenStable();

    expect(rows()).toHaveLength(1);
    expect(element.querySelector('[role="alert"]')).toBeNull();
  });

  it('keeps the table header (and its sort controls) in every state', async () => {
    calls[0].fail(new HttpErrorResponse({ status: 500 }));
    await fixture.whenStable();

    expect(element.querySelectorAll('th.mat-mdc-header-cell').length).toBeGreaterThan(0);
  });

  describe('announcement for screen readers', () => {
    const announcement = () => element.querySelector('p[role="status"].visually-hidden')?.textContent?.trim();

    it('says nothing while the first page loads', () => {
      expect(announcement()).toBe('');
    });

    it('says how many requests were found once a load finished with rows', async () => {
      calls[0].respond([fakeRequest(1), fakeRequest(2)], 1234);
      await fixture.whenStable();

      expect(announcement()).toBe('נמצאו 1,234 פניות');
    });

    it('uses the singular for one request', async () => {
      calls[0].respond([fakeRequest(1)], 1);
      await fixture.whenStable();

      expect(announcement()).toBe('נמצאה פנייה אחת');
    });

    it('is quiet again while the next load runs, and says the new count when it ends', async () => {
      calls[0].respond([fakeRequest(1)], 100);
      await fixture.whenStable();
      element.querySelector<HTMLButtonElement>('button.mat-mdc-paginator-navigation-next')?.click();
      await fixture.whenStable();
      expect(announcement()).toBe('');

      calls[1].respond([fakeRequest(21)], 80);
      await fixture.whenStable();

      expect(announcement()).toBe('נמצאו 80 פניות');
    });

    it('does not repeat what the empty and error states already announce', async () => {
      calls[0].respond([], 0);
      await fixture.whenStable();

      expect(announcement()).toBe('');
      expect(element.querySelector('app-state-message')).not.toBeNull();
    });
  });

  it('has no summary cards: they live on the dashboard (D-43)', () => {
    expect(element.querySelector('app-summary-cards')).toBeNull();
  });

  describe('changing the status from the row menu', () => {
    const tick = () => new Promise((resolve) => setTimeout(resolve, 300));
    const snack = () => document.querySelector('.mat-mdc-snack-bar-label')?.textContent ?? '';

    async function pick(label: string): Promise<void> {
      element.querySelector<HTMLButtonElement>('button[aria-label="פעולות לפנייה 1"]')?.click();
      await fixture.whenStable();
      const item = Array.from(document.querySelectorAll<HTMLButtonElement>('.mat-mdc-menu-item')).find((i) =>
        i.textContent?.includes(label),
      );
      item?.click();
      await fixture.whenStable();
    }

    beforeEach(async () => {
      calls[0].respond([{ ...fakeRequest(1), status: 'InProgress', version: 'v1' }], 1);
      await fixture.whenStable();
    });

    afterEach(() => {
      TestBed.inject(MatDialog).closeAll();
      document.querySelectorAll('.cdk-overlay-container').forEach((c) => (c.innerHTML = ''));
    });

    it('sends the change at once for a status that is not final, and updates the row in place', async () => {
      await pick('ממתינה');

      expect(statusCalls).toEqual([expect.objectContaining({ id: 1, newStatus: 'Waiting', version: 'v1' })]);
      statusCalls[0].respond({ ...fakeRequest(1), status: 'Waiting', version: 'v2' });
      await fixture.whenStable();

      expect(element.querySelector('tr.mat-mdc-row')?.textContent).toContain('ממתינה');
      expect(snack()).toContain('עודכנה');
    });

    it('asks for confirmation before moving to completed, and sends nothing if the user cancels', async () => {
      await pick('הושלמה');
      await tick();

      expect(document.querySelector('app-confirm-complete-dialog')).not.toBeNull();
      expect(statusCalls).toHaveLength(0);

      Array.from(document.querySelectorAll<HTMLButtonElement>('mat-dialog-actions button'))
        .find((b) => b.textContent?.includes('ביטול'))
        ?.click();
      await tick();

      expect(statusCalls).toHaveLength(0);
    });

    it('sends the change to completed once the user confirms', async () => {
      await pick('הושלמה');
      await tick();

      Array.from(document.querySelectorAll<HTMLButtonElement>('mat-dialog-actions button'))
        .find((b) => b.textContent?.includes('סמן כהושלמה'))
        ?.click();
      await tick();

      expect(statusCalls).toEqual([expect.objectContaining({ id: 1, newStatus: 'Completed' })]);
    });

    describe('when the server refuses the change', () => {
      it('shows the current state of the row after a 409', async () => {
        await pick('ממתינה');
        statusCalls[0].fail(
          new HttpErrorResponse({ status: 409, error: { currentStatus: 'Completed', currentVersion: 'v9', currentUpdatedAt: '2026-10-24T08:00:00Z' } }),
        );
        await fixture.whenStable();

        expect(snack()).toContain('עודכנה בינתיים על ידי משתמש אחר');
        // The row shows what the server says now, so the user sees why and can try again
        expect(element.querySelector('tr.mat-mdc-row')?.textContent).toContain('הושלמה');
      });

      it('explains a 422, where nothing changed', async () => {
        await pick('ממתינה');
        statusCalls[0].fail(
          new HttpErrorResponse({
            status: 422,
            error: { currentStatus: 'Completed', requestedStatus: 'Waiting', allowedStatuses: [], currentVersion: 'v9' },
          }),
        );
        await fixture.whenStable();

        expect(snack()).toContain('אינו מותר');
      });

      it('loads the list again after a 404', async () => {
        await pick('ממתינה');
        statusCalls[0].fail(new HttpErrorResponse({ status: 404 }));
        await fixture.whenStable();

        expect(calls).toHaveLength(2);
        expect(snack()).toContain('לא נמצאה');
      });
    });
  });

  describe('Bulk change of the ticked rows', () => {
    const tick = () => new Promise((resolve) => setTimeout(resolve, 300));
    const rowsData = [
      { ...fakeRequest(1), status: 'New' as const, version: 'v1', title: 'טעות בתלוש שכר' },
      { ...fakeRequest(2), status: 'InProgress' as const, version: 'v2', title: 'Error in salary slip' },
    ];

    const box = (id: number) =>
      element.querySelector<HTMLInputElement>(`input[aria-label="בחירת פנייה ${id}"]`) as HTMLInputElement;
    const bar = () => element.querySelector('app-bulk-bar');
    const barButton = (text: string) =>
      Array.from(element.querySelectorAll<HTMLButtonElement>('app-bulk-bar button')).find((b) =>
        b.textContent?.includes(text),
      ) as HTMLButtonElement;

    async function chooseTarget(label: string): Promise<void> {
      element.querySelector<HTMLElement>('app-bulk-bar mat-select')?.click();
      await fixture.whenStable();
      Array.from(document.querySelectorAll<HTMLElement>('mat-option'))
        .find((o) => o.textContent?.includes(label))
        ?.click();
      await fixture.whenStable();
    }

    async function tickBoth(): Promise<void> {
      box(1).click();
      box(2).click();
      await fixture.whenStable();
    }

    beforeEach(async () => {
      calls[0].respond(rowsData, 100); // more rows than one page, so there is a next page
      await fixture.whenStable();
    });

    afterEach(() => {
      TestBed.inject(MatDialog).closeAll();
      document.querySelectorAll('.cdk-overlay-container').forEach((c) => (c.innerHTML = ''));
    });

    const answer = {
      total: 2,
      succeeded: 1,
      failed: 1,
      results: [
        { id: 1, outcome: 'Updated' as const, request: { ...rowsData[0], status: 'Waiting' as const, version: 'v8' } },
        { id: 2, outcome: 'Conflict' as const, currentStatus: 'Completed' as const, currentVersion: 'v9' },
      ],
    };

    it('shows the bulk bar only while rows are ticked', async () => {
      expect(bar()).toBeNull();

      box(1).click();
      await fixture.whenStable();
      expect(bar()?.textContent).toContain('פנייה אחת נבחרה');

      box(1).click();
      await fixture.whenStable();
      expect(bar()).toBeNull();
    });

    it('sends the status with the id and version of every ticked row, and shows the result of every item', async () => {
      await tickBoth();
      await chooseTarget('ממתינה');
      barButton('עדכן').click();
      await fixture.whenStable();

      expect(bulkCalls).toHaveLength(1);
      expect(bulkCalls[0]).toMatchObject({
        newStatus: 'Waiting',
        items: [
          { id: 1, version: 'v1' },
          { id: 2, version: 'v2' },
        ],
      });

      bulkCalls[0].respond(answer);
      await tick();

      const dialog = document.querySelector('app-bulk-result-dialog');
      expect(dialog?.querySelector('.totals')?.textContent?.replace(/\s+/g, ' ')).toContain('עודכנו 1 מתוך 2');
      expect(dialog?.querySelectorAll('tbody tr')).toHaveLength(2);
      expect(dialog?.textContent).toContain('עודכנה בינתיים על ידי משתמש אחר');
    });

    it('then loads the list again', async () => {
      await tickBoth();
      await chooseTarget('ממתינה');
      barButton('עדכן').click();
      bulkCalls[0].respond(answer);
      await tick();

      expect(calls).toHaveLength(2);
    });

    it('empties the selection after the call (the list is loaded again)', async () => {
      await tickBoth();
      await chooseTarget('ממתינה');
      barButton('עדכן').click();
      bulkCalls[0].respond(answer);
      await tick();

      expect(bar()).toBeNull();
    });

    it('asks for confirmation before moving to completed, and sends nothing on cancel', async () => {
      await tickBoth();
      await chooseTarget('הושלמה');
      barButton('עדכן').click();
      await tick();

      expect(document.querySelector('app-confirm-complete-dialog')?.textContent).toContain('2 פניות');
      expect(bulkCalls).toHaveLength(0);

      Array.from(document.querySelectorAll<HTMLButtonElement>('mat-dialog-actions button'))
        .find((b) => b.textContent?.includes('ביטול'))
        ?.click();
      await tick();

      expect(bulkCalls).toHaveLength(0);
    });

    it('a failed call is reported, saves nothing and keeps the rows ticked', async () => {
      await tickBoth();
      await chooseTarget('ממתינה');
      barButton('עדכן').click();
      bulkCalls[0].fail(new HttpErrorResponse({ status: 503 }));
      await fixture.whenStable();

      expect(document.querySelector('.mat-mdc-snack-bar-label')?.textContent).toContain('אין חיבור');
      expect(document.querySelector('app-bulk-result-dialog')).toBeNull();
      expect(bar()).not.toBeNull();
      expect(calls).toHaveLength(1);
    });

    it('gives up the selection when the page changes', async () => {
      box(1).click();
      await fixture.whenStable();
      expect(bar()).not.toBeNull();

      element.querySelector<HTMLButtonElement>('button.mat-mdc-paginator-navigation-next')?.click();
      await fixture.whenStable();

      expect(bar()).toBeNull();
    });
  });

  it('opens the history of a request from its menu', async () => {
    calls[0].respond([{ ...fakeRequest(1), title: 'טעות בתלוש שכר' }], 1);
    await fixture.whenStable();

    element.querySelector<HTMLButtonElement>('button[aria-label="פעולות לפנייה 1"]')?.click();
    await fixture.whenStable();
    Array.from(document.querySelectorAll<HTMLButtonElement>('.mat-mdc-menu-item'))
      .find((item) => item.textContent?.includes('היסטוריה'))
      ?.click();
    await new Promise((resolve) => setTimeout(resolve, 300));

    const dialog = document.querySelector('app-request-history-dialog');
    expect(dialog?.textContent).toContain('#1');
    expect(dialog?.textContent).toContain('טעות בתלוש שכר');

    TestBed.inject(MatDialog).closeAll();
    document.querySelectorAll('.cdk-overlay-container').forEach((c) => (c.innerHTML = ''));
  });

  describe('time badges', () => {
    it('show nothing until a load has been measured', () => {
      expect(element.querySelector('app-timing-badge .badge')).toBeNull();
    });

    it('show the last list load, quietly, next to the title', async () => {
      const log = TestBed.inject(PerformanceLogService);
      log.record({
        at: new Date(),
        kind: 'list',
        method: 'GET',
        status: 200,
        clientMs: 20,
        timing: { totalMs: 42, dbMs: 30, queryCount: 2, cache: null },
      });
      await fixture.whenStable();

      // Label, time and cache are separate elements (the gap between them is CSS), so they are read one by one
      const badges = Array.from(element.querySelectorAll('.page-header app-timing-badge')).map((badge) =>
        ['.label', '.value', '.cache'].map((part) => badge.querySelector(part)?.textContent ?? null),
      );
      expect(badges).toEqual([
        ['רשימה', '42 ms', null],
      ]);
    });
  });
});
