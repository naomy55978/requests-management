import { TestBed } from '@angular/core/testing';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';

import { BulkItemResult } from '../../../core/api/api.models';
import { countOutcomes, toBulkResultRows } from '../bulk-result';
import { fakeRequest } from '../requests-list.store.test-helpers';
import { BulkResultDialogComponent, BulkResultDialogData } from './bulk-result-dialog.component';

describe('BulkResultDialogComponent', () => {
  const results: BulkItemResult[] = [
    { id: 1, outcome: 'Updated', request: { ...fakeRequest(1), status: 'Waiting' } },
    { id: 2, outcome: 'Conflict', currentStatus: 'Completed', currentVersion: 'v9' },
    { id: 3, outcome: 'InvalidTransition', currentStatus: 'New', allowedStatuses: ['InProgress', 'Waiting'] },
    { id: 4, outcome: 'NotFound' },
  ];
  const titles = new Map([
    [1, 'טעות בתלוש שכר'],
    [2, 'Error in salary slip'],
    [3, 'ביטול כרטיס גישה'],
    [4, 'חידוש היתר חניה'],
  ]);

  const data: BulkResultDialogData = {
    newStatus: 'Waiting',
    total: 4,
    succeeded: 1,
    failed: 3,
    counts: countOutcomes(results),
    rows: toBulkResultRows(results, titles),
  };

  async function open(dialogData: BulkResultDialogData = data): Promise<HTMLElement> {
    TestBed.configureTestingModule({ imports: [MatDialogModule] });
    TestBed.inject(MatDialog).open(BulkResultDialogComponent, { data: dialogData });
    await new Promise((resolve) => setTimeout(resolve));
    return document.querySelector('mat-dialog-container') as HTMLElement;
  }

  afterEach(() => TestBed.inject(MatDialog).closeAll());

  it('shows how many were updated out of how many, and how many were not', async () => {
    const dialog = await open();
    const totals = dialog.querySelector('.totals')?.textContent?.replace(/\s+/g, ' ') ?? '';

    expect(totals).toContain('עודכנו 1 מתוך 4');
    expect(totals).toContain('לא עודכנו 3');
    expect(dialog.querySelector('h2')?.textContent).toContain('ממתינה');
  });

  it('shows the count of every outcome that happened', async () => {
    const dialog = await open();
    const counts = Array.from(dialog.querySelectorAll('.count')).map((c) => c.textContent?.trim());

    expect(counts).toEqual(['עודכנו: 1', 'עודכנו בינתיים על ידי אחר: 1', 'מעבר אסור: 1', 'לא נמצאו: 1']);
  });

  it('shows one line per item, in order, with the title and the result in Hebrew', async () => {
    const dialog = await open();
    const lines = Array.from(dialog.querySelectorAll('tbody tr'));

    expect(lines.map((l) => l.querySelector('.cell-id')?.textContent)).toEqual(['1', '2', '3', '4']);
    expect(lines.map((l) => l.querySelector('.cell-title')?.textContent?.trim())).toEqual([
      'טעות בתלוש שכר',
      'Error in salary slip',
      'ביטול כרטיס גישה',
      'חידוש היתר חניה',
    ]);
    expect(lines[0].textContent).toContain('עודכנה ל«ממתינה»');
    expect(lines[1].textContent).toContain('עודכנה בינתיים על ידי משתמש אחר');
    expect(lines[2].textContent).toContain('מותר: בטיפול, ממתינה');
    expect(lines[3].textContent).toContain('לא נמצאה');
  });

  it('marks the items that were not updated', async () => {
    const dialog = await open();

    expect(Array.from(dialog.querySelectorAll('tbody tr')).map((l) => l.classList.contains('failed'))).toEqual([
      false,
      true,
      true,
      true,
    ]);
  });

  it('keeps each title in its own direction (bdi), for Hebrew and English alike', async () => {
    const dialog = await open();

    expect(dialog.querySelectorAll('.cell-title bdi.bidi-fit')).toHaveLength(4);
  });

  it('keeps the full title in a title attribute, for when the cell cuts it', async () => {
    const dialog = await open();

    dialog.querySelectorAll('.cell-title').forEach((cell) => {
      expect(cell.getAttribute('title')).toBe(cell.querySelector('bdi')?.textContent);
    });
  });

  it('does not talk about failures when everything worked', async () => {
    const dialog = await open({
      ...data,
      total: 1,
      succeeded: 1,
      failed: 0,
      counts: countOutcomes([results[0]]),
      rows: toBulkResultRows([results[0]], titles),
    });

    expect(dialog.querySelector('.totals')?.textContent).not.toContain('לא עודכנו');
  });
});
