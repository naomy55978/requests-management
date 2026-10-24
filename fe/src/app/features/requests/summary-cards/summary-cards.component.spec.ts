import { ComponentFixture, TestBed } from '@angular/core/testing';

import { SummaryDto } from '../../../core/api/api.models';
import { fakeSummary } from '../requests-list.store.test-helpers';
import { SummaryCardsComponent } from './summary-cards.component';

describe('SummaryCardsComponent', () => {
  let fixture: ComponentFixture<SummaryCardsComponent>;
  let element: HTMLElement;

  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [SummaryCardsComponent] }).compileComponents();
    fixture = TestBed.createComponent(SummaryCardsComponent);
    element = fixture.nativeElement as HTMLElement;
  });

  async function show(inputs: { summary?: SummaryDto | null; loading?: boolean; error?: string | null }) {
    fixture.componentRef.setInput('summary', inputs.summary ?? null);
    fixture.componentRef.setInput('loading', inputs.loading ?? false);
    fixture.componentRef.setInput('error', inputs.error ?? null);
    await fixture.whenStable();
  }

  it('shows placeholders (and no numbers) while the first load runs', async () => {
    await show({ loading: true });

    expect(element.querySelectorAll('.placeholder')).toHaveLength(4);
    expect(element.textContent).not.toContain('סה״כ');
  });

  it('shows the total, the counts by status and priority, and the top organizations', async () => {
    await show({ summary: fakeSummary() });
    const text = element.textContent ?? '';

    expect(text).toContain('סה״כ פניות');
    expect(text).toContain('1,234');
    // Status and priority labels in Hebrew, each with its count
    for (const label of ['חדשה', 'בטיפול', 'ממתינה', 'הושלמה', 'נמוכה', 'בינונית', 'גבוהה']) {
      expect(text).toContain(label);
    }
    expect(text).toContain('634');
    expect(element.querySelectorAll('.orgs li')).toHaveLength(2);
    expect(text).toContain('גליל לוגיסטיקה בע״מ');
    expect(text).toContain('Cedar Software Ltd');
  });

  it('draws the organization bars relative to the largest one', async () => {
    await show({ summary: fakeSummary() });

    const bars = Array.from(element.querySelectorAll<HTMLElement>('.org-bar > span')).map((b) => b.style.width);
    expect(bars).toEqual(['100%', '50%']);
  });

  it('keeps the numbers on screen, only dimmed, while a refresh runs', async () => {
    await show({ summary: fakeSummary(), loading: true });

    expect(element.textContent).toContain('1,234');
    expect(element.querySelector('.summary')?.classList.contains('refreshing')).toBe(true);
  });

  it('shows the error with a retry button, and the button asks for a retry', async () => {
    await show({ error: 'אין חיבור לשרת' });
    const retried = vi.fn();
    fixture.componentInstance.retry.subscribe(retried);

    expect(element.textContent).toContain('אין חיבור לשרת');
    element.querySelector<HTMLButtonElement>('button')?.click();

    expect(retried).toHaveBeenCalledTimes(1);
  });
});
