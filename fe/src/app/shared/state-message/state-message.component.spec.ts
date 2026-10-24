import { ComponentFixture, TestBed } from '@angular/core/testing';

import { provideAppIcons } from '../../core/icons/app-icons';
import { StateMessageComponent } from './state-message.component';

describe('StateMessageComponent', () => {
  let fixture: ComponentFixture<StateMessageComponent>;
  let element: HTMLElement;

  async function render(inputs: Record<string, unknown>): Promise<void> {
    await TestBed.configureTestingModule({ imports: [StateMessageComponent], providers: [provideAppIcons()] }).compileComponents();
    fixture = TestBed.createComponent(StateMessageComponent);
    for (const [name, value] of Object.entries(inputs)) {
      fixture.componentRef.setInput(name, value);
    }
    element = fixture.nativeElement as HTMLElement;
    await fixture.whenStable();
  }

  it('shows an error as an alert with a retry button that reports the click', async () => {
    await render({ kind: 'error', message: 'אין חיבור לשרת', actionLabel: 'נסה שוב' });
    let clicks = 0;
    fixture.componentInstance.action.subscribe(() => clicks++);

    expect(element.querySelector('[role="alert"]')?.textContent).toContain('אין חיבור לשרת');
    element.querySelector('button')?.click();

    expect(clicks).toBe(1);
  });

  it('shows an empty result as a status message, with no button unless an action is given', async () => {
    await render({ kind: 'empty', message: 'אין פניות להצגה.' });

    expect(element.querySelector('[role="status"]')?.textContent).toContain('אין פניות להצגה.');
    expect(element.querySelector('button')).toBeNull();
  });
});
