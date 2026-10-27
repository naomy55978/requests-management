import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MAT_DATE_LOCALE, provideNativeDateAdapter } from '@angular/material/core';

import { provideAppIcons } from '../../../core/icons/app-icons';
import { EMPTY_FILTERS, RequestFilters } from '../request-filters';
import { RequestsFiltersComponent } from './requests-filters.component';

describe('RequestsFiltersComponent', () => {
  let fixture: ComponentFixture<RequestsFiltersComponent>;
  let element: HTMLElement;
  let emitted: RequestFilters[];

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [RequestsFiltersComponent],
      providers: [provideNativeDateAdapter(), { provide: MAT_DATE_LOCALE, useValue: 'he-IL' }, provideAppIcons()],
    }).compileComponents();

    fixture = TestBed.createComponent(RequestsFiltersComponent);
    element = fixture.nativeElement as HTMLElement;
    emitted = [];
    fixture.componentInstance.filtersChange.subscribe((filters) => emitted.push(filters));
    await fixture.whenStable();
  });

  function input(name: string): HTMLInputElement {
    return element.querySelector<HTMLInputElement>(`input[formcontrolname="${name}"]`) as HTMLInputElement;
  }

  async function type(name: string, value: string): Promise<void> {
    const field = input(name);
    field.value = value;
    field.dispatchEvent(new Event('input'));
    await fixture.whenStable();
  }

  // The form is protected; tests drive it directly for the controls that are awkward to operate through the DOM
  function form() {
    return (fixture.componentInstance as unknown as { form: RequestsFiltersComponent['form'] }).form;
  }

  it('reports the whole form after every change', async () => {
    await type('search', 'logo');
    await type('organization', 'Acme');

    expect(emitted.at(-1)).toEqual({ ...EMPTY_FILTERS, search: 'logo', organization: 'Acme' });
  });

  it('limits the typed length like the API does', () => {
    expect(input('search').maxLength).toBe(100);
    expect(input('organization').maxLength).toBe(150);
    expect(input('assignedTo').maxLength).toBe(100);
  });

  it('hints that one character is not enough to search, and only then', async () => {
    await type('search', 'a');
    expect(element.querySelector('mat-hint')?.textContent).toContain('יש להקליד לפחות 2 תווים');

    await type('search', 'ab');
    expect(element.textContent).not.toContain('יש להקליד לפחות 2 תווים');
  });

  it('reports picked statuses and priorities', async () => {
    form().controls.status.setValue(['New', 'Waiting']);
    form().controls.priority.setValue(['High']);
    await fixture.whenStable();

    expect(emitted.at(-1)).toMatchObject({ status: ['New', 'Waiting'], priority: ['High'] });
  });

  it('reports the picked dates as yyyy-MM-dd', async () => {
    form().controls.range.setValue({ start: new Date(2026, 0, 5), end: new Date(2026, 1, 1) });
    await fixture.whenStable();

    expect(emitted.at(-1)).toMatchObject({ createdFrom: '2026-01-05', createdTo: '2026-02-01' });
  });

  it('reports once, with the final values, when one action changes several controls', async () => {
    form().controls.status.setValue(['New']);
    form().controls.priority.setValue(['High']);
    form().controls.range.setValue({ start: new Date(2026, 0, 5), end: new Date(2026, 1, 1) });
    await fixture.whenStable();

    expect(emitted).toHaveLength(1);
    expect(emitted[0]).toMatchObject({ status: ['New'], priority: ['High'], createdFrom: '2026-01-05' });
  });

  it('takes dates from the calendar only (the inputs are read-only)', () => {
    expect(input('start').readOnly).toBe(true);
    expect(input('end').readOnly).toBe(true);
  });

  it('shows an error and keeps reporting when the range is reversed (the store ignores it)', async () => {
    form().controls.range.setValue({ start: new Date(2026, 1, 1), end: new Date(2026, 0, 5) });
    form().controls.range.controls.start.markAsTouched();
    await fixture.whenStable();

    expect(element.querySelector('mat-error')?.textContent).toContain('תאריך ההתחלה מאוחר מתאריך הסיום');
  });

  it('disables the handler text while "without a handler" is checked', async () => {
    form().controls.unassigned.setValue(true);
    await fixture.whenStable();
    expect(input('assignedTo').disabled).toBe(true);
    expect(emitted.at(-1)?.unassigned).toBe(true);

    form().controls.unassigned.setValue(false);
    await fixture.whenStable();
    expect(input('assignedTo').disabled).toBe(false);
  });

  const clearButton = () =>
    [...element.querySelectorAll<HTMLButtonElement>('button')].find((b) => b.textContent?.includes('נקה סינון'))!;

  it('clear reports once, with everything empty (no half-cleared values in between)', async () => {
    await type('search', 'logo');
    form().controls.status.setValue(['New']);
    form().controls.range.setValue({ start: new Date(2026, 0, 5), end: new Date(2026, 1, 1) });
    await fixture.whenStable();
    emitted.length = 0;

    clearButton().click();
    await fixture.whenStable();

    expect(emitted).toEqual([EMPTY_FILTERS]);
  });

  it('clear resets everything, and the button is enabled only when something is entered', async () => {
    expect(clearButton().disabled).toBe(true);

    await type('search', 'logo');
    form().controls.status.setValue(['New']);
    await fixture.whenStable();
    expect(clearButton().disabled).toBe(false);

    clearButton().click();
    await fixture.whenStable();

    expect(emitted.at(-1)).toEqual(EMPTY_FILTERS);
    expect(input('search').value).toBe('');
    expect(clearButton().disabled).toBe(true);
  });

  describe('"x" button of the text fields', () => {
    const fields = ['search', 'organization', 'assignedTo'] as const;

    function clearButton(name: string): HTMLButtonElement | null {
      return input(name).closest('mat-form-field')?.querySelector<HTMLButtonElement>('button[aria-label="נקה"]') ?? null;
    }

    it('is shown only while the field has a value', async () => {
      for (const name of fields) {
        expect(clearButton(name)).toBeNull();
        await type(name, 'abc');
        expect(clearButton(name)).not.toBeNull();
        await type(name, '');
        expect(clearButton(name)).toBeNull();
      }
    });

    it('empties the field, reports it for an immediate load and returns the focus to the field', async () => {
      document.body.appendChild(element);
      for (const name of fields) {
        await type(name, 'abc');
        const applyNow: RequestFilters[] = [];
        const subscription = fixture.componentInstance.filtersApplyNow.subscribe((filters) => applyNow.push(filters));

        clearButton(name)?.click();
        await fixture.whenStable();
        subscription.unsubscribe();

        expect(input(name).value).toBe('');
        expect(applyNow).toEqual([EMPTY_FILTERS]);
        expect(document.activeElement).toBe(input(name));
      }
      element.remove();
    });

    it('keeps the other fields as they are', async () => {
      await type('search', 'logo');
      await type('organization', 'Acme');
      const applyNow: RequestFilters[] = [];
      fixture.componentInstance.filtersApplyNow.subscribe((filters) => applyNow.push(filters));

      clearButton('search')?.click();
      await fixture.whenStable();

      expect(applyNow).toEqual([{ ...EMPTY_FILTERS, organization: 'Acme' }]);
    });

    it('is not offered for the handler while "without a handler" is checked', async () => {
      await type('assignedTo', 'dana');
      form().controls.unassigned.setValue(true);
      await fixture.whenStable();

      expect(clearButton('assignedTo')).toBeNull();
    });
  });
});
