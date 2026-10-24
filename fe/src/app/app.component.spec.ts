import { provideHttpClient } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import { fakeSession } from './core/auth/auth.test-helpers';
import { AppComponent } from './app.component';

describe('AppComponent', () => {
  beforeEach(() => sessionStorage.clear());

  it('renders the toolbar with the application title and no user when logged out', async () => {
    await TestBed.configureTestingModule({
      imports: [AppComponent],
      providers: [provideRouter([]), provideHttpClient()],
    }).compileComponents();

    const fixture = TestBed.createComponent(AppComponent);
    await fixture.whenStable();

    const element = fixture.nativeElement as HTMLElement;
    expect(element.querySelector('.app-title')?.textContent).toContain('ניהול פניות');
    expect(element.querySelector('.app-user')).toBeNull();
  });

  describe('performance panel', () => {
    async function render(loggedIn: boolean) {
      await TestBed.configureTestingModule({
        imports: [AppComponent],
        providers: [provideRouter([]), provideHttpClient()],
      }).compileComponents();
      if (loggedIn) {
        sessionStorage.setItem('rm.session', JSON.stringify(fakeSession()));
      }
      const fixture = TestBed.createComponent(AppComponent);
      await fixture.whenStable();
      return { fixture, element: fixture.nativeElement as HTMLElement };
    }

    const button = (element: HTMLElement) => element.querySelector<HTMLButtonElement>('button.app-performance');

    it('is closed by default, and the button says so', async () => {
      const { element } = await render(true);

      expect(element.querySelector('app-performance-panel')).toBeNull();
      expect(button(element)?.getAttribute('aria-expanded')).toBe('false');
    });

    it('opens with the button and closes with it again', async () => {
      const { fixture, element } = await render(true);

      button(element)?.click();
      await fixture.whenStable();
      expect(element.querySelector('app-performance-panel')).not.toBeNull();
      expect(button(element)?.getAttribute('aria-expanded')).toBe('true');

      button(element)?.click();
      await fixture.whenStable();
      expect(element.querySelector('app-performance-panel')).toBeNull();
    });

    it('has no button before the user is logged in', async () => {
      const { element } = await render(false);

      expect(button(element)).toBeNull();
    });
  });
});
