import { ComponentFixture, TestBed } from '@angular/core/testing';

import { RequestDto } from '../../../core/api/api.models';
import { fakeRequest } from '../requests-list.store.test-helpers';
import { RequestsTableComponent, SortChange } from './requests-table.component';

describe('RequestsTableComponent', () => {
  let fixture: ComponentFixture<RequestsTableComponent>;
  let element: HTMLElement;

  async function render(items: RequestDto[]): Promise<void> {
    await TestBed.configureTestingModule({ imports: [RequestsTableComponent] }).compileComponents();
    fixture = TestBed.createComponent(RequestsTableComponent);
    fixture.componentRef.setInput('items', items);
    fixture.componentRef.setInput('sortBy', 'createdAt');
    fixture.componentRef.setInput('sortDir', 'desc');
    element = fixture.nativeElement as HTMLElement;
    await fixture.whenStable();
  }

  it('shows one row per item, in the order given (the server sorts, not the table)', async () => {
    await render([fakeRequest(3), fakeRequest(1), fakeRequest(2)]);

    const ids = [...element.querySelectorAll('tr.mat-mdc-row .cell-id')].map((cell) => cell.textContent?.trim());
    expect(ids).toEqual(['3', '1', '2']);
  });

  it('shows Hebrew status and priority labels', async () => {
    await render([{ ...fakeRequest(1), status: 'InProgress', priority: 'High', assignedTo: 'dana.cohen' }]);

    const row = element.querySelector('tr.mat-mdc-row')?.textContent ?? '';
    expect(row).toContain('בטיפול');
    expect(row).toContain('גבוהה');
    expect(row).toContain('dana.cohen');
  });

  it('says "not assigned" for a request without a handler', async () => {
    await render([fakeRequest(1)]);

    expect(element.querySelector('.unassigned')?.textContent).toContain('לא משויכת');
  });

  it('keeps the header when there are no rows', async () => {
    await render([]);

    expect(element.querySelectorAll('tr.mat-mdc-header-row')).toHaveLength(1);
    expect(element.querySelectorAll('tr.mat-mdc-row')).toHaveLength(0);
  });

  it('reports a click on a sortable header as the API sort field and direction', async () => {
    await render([fakeRequest(1)]);
    const changes: SortChange[] = [];
    fixture.componentInstance.sortChange.subscribe((change) => changes.push(change));

    const titleHeader = [...element.querySelectorAll<HTMLElement>('th')].find((th) => th.textContent?.includes('כותרת'));
    titleHeader?.click();
    await fixture.whenStable();

    expect(changes).toEqual([{ sortBy: 'title', sortDir: 'asc' }]);
  });

  it('dims the rows while busy, without removing them', async () => {
    await render([fakeRequest(1)]);
    fixture.componentRef.setInput('busy', true);
    await fixture.whenStable();

    expect(element.querySelector('.table-scroll')?.classList.contains('busy')).toBe(true);
    expect(element.querySelectorAll('tr.mat-mdc-row')).toHaveLength(1);
  });
});
