import { HttpErrorResponse } from '@angular/common/http';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MatDialog } from '@angular/material/dialog';
import { MAT_DATE_LOCALE, provideNativeDateAdapter } from '@angular/material/core';

import { RequestsApiService } from '../../../core/api/requests-api.service';
import { provideAppIcons } from '../../../core/icons/app-icons';
import { createFakeApi, fakeRequest } from '../requests-list.store.test-helpers';
import { RequestsPageComponent } from './requests-page.component';

describe('RequestsPageComponent', () => {
  let fixture: ComponentFixture<RequestsPageComponent>;
  let element: HTMLElement;
  let calls: ReturnType<typeof createFakeApi>['calls'];
  let summaryCalls: ReturnType<typeof createFakeApi>['summaryCalls'];
  let statusCalls: ReturnType<typeof createFakeApi>['statusCalls'];

  beforeEach(async () => {
    const fake = createFakeApi();
    calls = fake.calls;
    summaryCalls = fake.summaryCalls;
    statusCalls = fake.statusCalls;
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

  describe('summary cards', () => {
    it('are loaded next to the list and have their own loading state', async () => {
      expect(summaryCalls).toHaveLength(1);
      expect(element.querySelectorAll('.placeholder')).toHaveLength(4);

      summaryCalls[0].respond();
      await fixture.whenStable();

      expect(element.textContent).toContain('1,234');
    });

    it('do not block the list: the rows show while the summary is still loading', async () => {
      calls[0].respond([fakeRequest(1)], 1);
      await fixture.whenStable();

      expect(rows()).toHaveLength(1);
      expect(element.querySelectorAll('.placeholder')).toHaveLength(4);
    });

    it('failing does not break the list, and "try again" loads only the summary', async () => {
      calls[0].respond([fakeRequest(1)], 1);
      summaryCalls[0].fail(new HttpErrorResponse({ status: 503 }));
      await fixture.whenStable();

      expect(rows()).toHaveLength(1);
      expect(element.querySelector('app-summary-cards [role="alert"]')).not.toBeNull();

      element.querySelector<HTMLButtonElement>('app-summary-cards button')?.click();
      await fixture.whenStable();

      expect(summaryCalls).toHaveLength(2);
      expect(calls).toHaveLength(1);
    });
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
      summaryCalls[0].respond();
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

    describe('refreshing the summary (the server drops its cache when data changes)', () => {
      it('after a change that went through', async () => {
        await pick('ממתינה');
        statusCalls[0].respond({ ...fakeRequest(1), status: 'Waiting', version: 'v2' });
        await fixture.whenStable();

        expect(summaryCalls).toHaveLength(2);
      });

      it('after a 409, because someone else changed the data', async () => {
        await pick('ממתינה');
        statusCalls[0].fail(
          new HttpErrorResponse({ status: 409, error: { currentStatus: 'Completed', currentVersion: 'v9', currentUpdatedAt: '2026-10-24T08:00:00Z' } }),
        );
        await fixture.whenStable();

        expect(summaryCalls).toHaveLength(2);
        expect(snack()).toContain('עודכנה בינתיים על ידי משתמש אחר');
        // The row shows what the server says now, so the user sees why and can try again
        expect(element.querySelector('tr.mat-mdc-row')?.textContent).toContain('הושלמה');
      });

      it('not after a 422, where nothing changed', async () => {
        await pick('ממתינה');
        statusCalls[0].fail(
          new HttpErrorResponse({
            status: 422,
            error: { currentStatus: 'Completed', requestedStatus: 'Waiting', allowedStatuses: [], currentVersion: 'v9' },
          }),
        );
        await fixture.whenStable();

        expect(summaryCalls).toHaveLength(1);
        expect(snack()).toContain('אינו מותר');
      });

      it('not after a 404, and the list is loaded again', async () => {
        await pick('ממתינה');
        statusCalls[0].fail(new HttpErrorResponse({ status: 404 }));
        await fixture.whenStable();

        expect(summaryCalls).toHaveLength(1);
        expect(calls).toHaveLength(2);
        expect(snack()).toContain('לא נמצאה');
      });
    });
  });
});
