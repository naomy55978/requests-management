import { ComponentFixture, TestBed } from '@angular/core/testing';

import { RequestDto } from '../../../core/api/api.models';
import { provideAppIcons } from '../../../core/icons/app-icons';
import { fakeRequest } from '../requests-list.store.test-helpers';
import { RequestsTableComponent, SortChange, StatusChangeRequest } from './requests-table.component';

describe('RequestsTableComponent', () => {
  let fixture: ComponentFixture<RequestsTableComponent>;
  let element: HTMLElement;

  async function render(items: RequestDto[]): Promise<void> {
    await TestBed.configureTestingModule({
      imports: [RequestsTableComponent],
      providers: [provideAppIcons()],
    }).compileComponents();
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

  describe('status action menu', () => {
    const actionButton = (id: number) =>
      element.querySelector<HTMLButtonElement>(`button[aria-label="פעולות לפנייה ${id}"]`) as HTMLButtonElement;

    // The menu opens in an overlay on the page, not inside the table
    async function openMenu(id: number): Promise<HTMLButtonElement[]> {
      actionButton(id).click();
      await fixture.whenStable();
      return Array.from(document.querySelectorAll<HTMLButtonElement>('.mat-mdc-menu-panel .mat-mdc-menu-item'));
    }

    const itemTexts = (items: HTMLButtonElement[]) => items.map((item) => item.textContent?.trim());

    afterEach(() => document.querySelectorAll('.cdk-overlay-container').forEach((c) => (c.innerHTML = '')));

    it('offers only the statuses allowed from the current one', async () => {
      await render([
        { ...fakeRequest(1), status: 'New' },
        { ...fakeRequest(2), status: 'InProgress' },
        { ...fakeRequest(3), status: 'Waiting' },
      ]);

      expect(itemTexts(await openMenu(1))).toEqual(['העבר ל«בטיפול»', 'העבר ל«ממתינה»']);
      document.body.click();
      await fixture.whenStable();
    });

    it('offers "waiting" and "completed" for a request in progress', async () => {
      await render([{ ...fakeRequest(2), status: 'InProgress' }]);

      expect(itemTexts(await openMenu(2))).toEqual(['העבר ל«ממתינה»', 'העבר ל«הושלמה»']);
    });

    it('offers nothing for a completed request: one disabled line that says so', async () => {
      await render([{ ...fakeRequest(4), status: 'Completed' }]);

      const items = await openMenu(4);

      expect(items).toHaveLength(1);
      expect(items[0].disabled).toBe(true);
      expect(items[0].textContent).toContain('הושלמה');
    });

    it('reports the row and the status the user picked, and sends nothing itself', async () => {
      const row = { ...fakeRequest(1), status: 'New' as const };
      await render([row]);
      const picked: StatusChangeRequest[] = [];
      fixture.componentInstance.statusChange.subscribe((change) => picked.push(change));

      const items = await openMenu(1);
      items[1].click();

      expect(picked).toEqual([{ row, status: 'Waiting' }]);
    });

    it('disables the action of a row whose change is on its way, and shows a spinner there', async () => {
      await render([fakeRequest(1), fakeRequest(2)]);
      fixture.componentRef.setInput('pendingIds', new Set([1]));
      await fixture.whenStable();

      expect(actionButton(1).disabled).toBe(true);
      expect(actionButton(1).querySelector('mat-spinner')).not.toBeNull();
      expect(actionButton(2).disabled).toBe(false);
    });
  });
});
