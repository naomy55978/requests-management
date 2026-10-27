import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';

import { StatusHistoryEntry } from '../../../core/api/api.models';
import { provideAppIcons } from '../../../core/icons/app-icons';
import { RequestHistoryDialogComponent } from './request-history-dialog.component';

describe('RequestHistoryDialogComponent', () => {
  let backend: HttpTestingController;

  // The server sends UTC; the dialog must show local time. Fix the zone, or a UTC build machine
  // (where local time = UTC) would pass even if the dialog showed the raw UTC time.
  beforeAll(() => vi.stubEnv('TZ', 'Asia/Jerusalem'));
  afterAll(() => vi.unstubAllEnvs());

  async function open(): Promise<HTMLElement> {
    TestBed.configureTestingModule({
      imports: [MatDialogModule],
      providers: [provideHttpClient(), provideHttpClientTesting(), provideAppIcons()],
    });
    backend = TestBed.inject(HttpTestingController);
    TestBed.inject(MatDialog).open(RequestHistoryDialogComponent, { data: { id: 42, title: 'טעות בתלוש שכר' } });
    await new Promise((resolve) => setTimeout(resolve));
    return document.querySelector('mat-dialog-container') as HTMLElement;
  }

  const settle = () => new Promise((resolve) => setTimeout(resolve, 20));

  afterEach(() => {
    TestBed.inject(MatDialog).closeAll();
    document.querySelectorAll('.cdk-overlay-container').forEach((c) => (c.innerHTML = ''));
  });

  const entries: StatusHistoryEntry[] = [
    { previousStatus: 'New', newStatus: 'InProgress', changedAt: '2026-01-15T10:05:00Z', changedBy: 'dana.cohen' },
    { previousStatus: 'InProgress', newStatus: 'Completed', changedAt: '2026-07-01T21:30:00Z', changedBy: 'avi.levi' },
  ];

  it('asks for the history of the request, names it, and shows a spinner while it loads', async () => {
    const dialog = await open();

    backend.expectOne('/api/requests/42/history');
    expect(dialog.textContent).toContain('#42');
    expect(dialog.querySelector('bdi')?.textContent).toBe('טעות בתלוש שכר');
    expect(dialog.querySelector('mat-spinner')).not.toBeNull();
  });

  it('shows previous → new status, who and when, oldest first', async () => {
    const dialog = await open();
    backend.expectOne('/api/requests/42/history').flush(entries);
    await settle();

    const lines = Array.from(dialog.querySelectorAll('.entry'));
    expect(lines).toHaveLength(2);
    expect(lines[0].querySelector('.change')?.textContent?.replace(/\s+/g, ' ')).toContain('חדשה');
    expect(lines[0].querySelector('.change')?.textContent).toContain('בטיפול');
    expect(lines[0].querySelector('.by bdi')?.textContent).toBe('dana.cohen');
    expect(lines[1].querySelector('.change')?.textContent).toContain('הושלמה');
    expect(lines[1].querySelector('.by bdi')?.textContent).toBe('avi.levi');
  });

  it('shows the time in local time, not the UTC time the server sends', async () => {
    const dialog = await open();
    backend.expectOne('/api/requests/42/history').flush(entries);
    await settle();

    const times = Array.from(dialog.querySelectorAll('time')).map((t) => t.textContent?.trim());

    // Winter: UTC+2. Summer: UTC+3 - and 21:30 UTC is already after midnight, so the DAY changes too
    expect(times).toEqual(['15/01/2026 12:05', '02/07/2026 00:30']);
    expect(dialog.querySelector('time')?.getAttribute('datetime')).toBe('2026-01-15T10:05:00Z');
  });

  it('says that the request was never changed when the history is empty', async () => {
    const dialog = await open();
    backend.expectOne('/api/requests/42/history').flush([]);
    await settle();

    expect(dialog.textContent).toContain('לא בוצעו שינויי סטטוס בפנייה זו');
    expect(dialog.querySelector('.timeline')).toBeNull();
    expect(dialog.querySelector('mat-spinner')).toBeNull();
  });

  it('404: says in Hebrew that the request was not found', async () => {
    const dialog = await open();
    backend.expectOne('/api/requests/42/history').flush(null, { status: 404, statusText: 'Not Found' });
    await settle();

    expect(dialog.querySelector('[role="alert"]')?.textContent).toContain('לא נמצא');
  });

  it('a failed load can be tried again', async () => {
    const dialog = await open();
    backend.expectOne('/api/requests/42/history').flush(null, { status: 503, statusText: 'Unavailable' });
    await settle();
    expect(dialog.textContent).toContain('אין חיבור לשרת');

    Array.from(dialog.querySelectorAll<HTMLButtonElement>('app-state-message button'))
      .find((b) => b.textContent?.includes('נסה שוב'))
      ?.click();
    await settle();
    backend.expectOne('/api/requests/42/history').flush(entries);
    await settle();

    expect(dialog.querySelectorAll('.entry')).toHaveLength(2);
  });

  it('cancels the request when the dialog is closed before the answer', async () => {
    await open();
    const request = backend.expectOne('/api/requests/42/history');

    TestBed.inject(MatDialog).closeAll();
    await new Promise((resolve) => setTimeout(resolve, 300));

    expect(request.cancelled).toBe(true);
  });
});
