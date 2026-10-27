import { TestBed } from '@angular/core/testing';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';

import { ConfirmCompleteDialogComponent } from './confirm-complete-dialog.component';

describe('ConfirmCompleteDialogComponent', () => {
  function open() {
    TestBed.configureTestingModule({ imports: [MatDialogModule] });
    return TestBed.inject(MatDialog).open(ConfirmCompleteDialogComponent, { data: { id: 17, title: 'טעות בתלוש שכר' } });
  }

  const buttons = () => Array.from(document.querySelectorAll<HTMLButtonElement>('mat-dialog-actions button'));

  afterEach(() => TestBed.inject(MatDialog).closeAll());

  it('names the request and says that completed is final', async () => {
    open();
    await new Promise((resolve) => setTimeout(resolve));

    const text = document.querySelector('mat-dialog-container')?.textContent ?? '';
    expect(text).toContain('#17');
    expect(text).toContain('טעות בתלוש שכר');
    expect(text).toContain('סופי');
  });

  it('closes with true when the user confirms', async () => {
    const ref = open();
    const closed = vi.fn();
    ref.afterClosed().subscribe(closed);
    await new Promise((resolve) => setTimeout(resolve));

    buttons().find((b) => b.textContent?.includes('סמן כהושלמה'))?.click();
    await new Promise((resolve) => setTimeout(resolve, 300));

    expect(closed).toHaveBeenCalledWith(true);
  });

  it('closes without confirming when the user cancels', async () => {
    const ref = open();
    const closed = vi.fn();
    ref.afterClosed().subscribe(closed);
    await new Promise((resolve) => setTimeout(resolve));

    buttons().find((b) => b.textContent?.includes('ביטול'))?.click();
    await new Promise((resolve) => setTimeout(resolve, 300));

    // Whatever Material passes for a cancel (nothing or an empty string), it is not true
    expect(closed).toHaveBeenCalledTimes(1);
    expect(closed).not.toHaveBeenCalledWith(true);
  });

  it('marks "cancel" as the element to focus first, so a stray Enter cannot confirm the final change', async () => {
    open();
    await new Promise((resolve) => setTimeout(resolve));

    // Material focuses the element with cdkFocusInitial. The real focus is checked in a browser: the unit test
    // environment has no layout, so Material cannot find a focusable button there and falls back to the dialog itself.
    const initial = Array.from(document.querySelectorAll<HTMLButtonElement>('mat-dialog-actions button[cdkFocusInitial]'));
    expect(initial.map((b) => b.textContent?.trim())).toEqual(['ביטול']);
  });

  async function openBulk(count: number): Promise<string> {
    TestBed.configureTestingModule({ imports: [MatDialogModule] });
    TestBed.inject(MatDialog).open(ConfirmCompleteDialogComponent, { data: { count } });
    await new Promise((resolve) => setTimeout(resolve));
    return document.querySelector('mat-dialog-container')?.textContent ?? '';
  }

  it('for Bulk it says how many requests, instead of one title', async () => {
    const text = await openBulk(7);

    expect(text).toContain('7 פניות נבחרו ויועברו');
    expect(text).toContain('סופי');
    expect(text).not.toContain('#');
  });

  it('for Bulk with one request it speaks in the singular, like the bulk bar', async () => {
    const text = await openBulk(1);

    expect(text).toContain('פנייה אחת נבחרה ותועבר');
    expect(text).not.toContain('1 פניות');
    expect(text).toContain('סמן כהושלמה');
    expect(text).not.toContain('הפניות');
  });
});
