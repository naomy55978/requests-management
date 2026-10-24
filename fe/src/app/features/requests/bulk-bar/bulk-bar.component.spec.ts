import { ComponentFixture, TestBed } from '@angular/core/testing';

import { RequestStatus } from '../../../core/api/api.models';
import { BulkBarComponent } from './bulk-bar.component';

describe('BulkBarComponent', () => {
  let fixture: ComponentFixture<BulkBarComponent>;
  let element: HTMLElement;
  let applied: RequestStatus[];
  let cleared: number;

  async function render(count: number, targets: RequestStatus[], busy = false): Promise<void> {
    await TestBed.configureTestingModule({ imports: [BulkBarComponent] }).compileComponents();
    fixture = TestBed.createComponent(BulkBarComponent);
    fixture.componentRef.setInput('count', count);
    fixture.componentRef.setInput('targets', targets);
    fixture.componentRef.setInput('busy', busy);
    element = fixture.nativeElement as HTMLElement;
    applied = [];
    cleared = 0;
    fixture.componentInstance.apply.subscribe((status) => applied.push(status));
    fixture.componentInstance.clear.subscribe(() => cleared++);
    await fixture.whenStable();
  }

  const button = (text: string) =>
    Array.from(element.querySelectorAll<HTMLButtonElement>('button')).find((b) => b.textContent?.includes(text)) as HTMLButtonElement;

  async function choose(label: string): Promise<void> {
    element.querySelector<HTMLElement>('mat-select')?.click();
    await fixture.whenStable();
    Array.from(document.querySelectorAll<HTMLElement>('mat-option'))
      .find((o) => o.textContent?.includes(label))
      ?.click();
    await fixture.whenStable();
  }

  afterEach(() => document.querySelectorAll('.cdk-overlay-container').forEach((c) => (c.innerHTML = '')));

  it('says how many requests are selected', async () => {
    await render(3, ['InProgress']);
    expect(element.textContent).toContain('3 פניות נבחרו');

    fixture.componentRef.setInput('count', 1);
    await fixture.whenStable();
    expect(element.textContent).toContain('פנייה אחת נבחרה');
  });

  it('does not allow "update" until a status is chosen', async () => {
    await render(2, ['InProgress', 'Waiting']);

    expect(button('עדכן').disabled).toBe(true);
  });

  it('offers the statuses it is given and reports the chosen one on "update"', async () => {
    await render(2, ['InProgress', 'Waiting']);

    await choose('ממתינה');
    expect(button('עדכן').disabled).toBe(false);
    button('עדכן').click();

    expect(applied).toEqual(['Waiting']);
  });

  it('forgets the choice when the status is no longer on offer (the selection changed)', async () => {
    await render(2, ['InProgress', 'Waiting']);
    await choose('ממתינה');

    fixture.componentRef.setInput('targets', ['InProgress']);
    await fixture.whenStable();

    expect(button('עדכן').disabled).toBe(true);
  });

  it('says so, and offers nothing, when no selected request can move (all completed)', async () => {
    await render(1, []);

    expect(element.textContent).toContain('אין מעבר אפשרי');
    expect(button('עדכן').disabled).toBe(true);
  });

  it('asks to clear the selection', async () => {
    await render(2, ['InProgress']);

    button('בטל בחירה').click();

    expect(cleared).toBe(1);
  });

  it('blocks everything while the call is on its way (no second send)', async () => {
    await render(2, ['InProgress'], true);

    expect(button('עדכן').disabled).toBe(true);
    expect(button('בטל בחירה').disabled).toBe(true);
    expect(element.querySelector('mat-spinner')).not.toBeNull();
  });
});
