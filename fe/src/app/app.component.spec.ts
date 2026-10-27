import { provideHttpClient } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';

import { fakeSession } from './core/auth/auth.test-helpers';
import { SHOW_PERFORMANCE } from './core/perf/show-performance';
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

  it('has no performance button or panel by default: the performance UI is off', async () => {
    await TestBed.configureTestingModule({
      imports: [AppComponent],
      providers: [provideRouter([]), provideHttpClient()],
    }).compileComponents();
    sessionStorage.setItem('rm.session', JSON.stringify(fakeSession()));

    const fixture = TestBed.createComponent(AppComponent);
    await fixture.whenStable();

    const element = fixture.nativeElement as HTMLElement;
    expect(element.querySelector('.app-user')).not.toBeNull();
    expect(element.querySelector('button.app-performance')).toBeNull();
    expect(element.querySelector('app-performance-panel')).toBeNull();
  });

  describe('performance panel (performance UI on)', () => {
    async function render(loggedIn: boolean) {
      await TestBed.configureTestingModule({
        imports: [AppComponent],
        providers: [provideRouter([]), provideHttpClient(), { provide: SHOW_PERFORMANCE, useValue: true }],
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

    it('moves focus to the panel heading when it opens, so the user sees it wherever the page is scrolled', async () => {
      const { fixture, element } = await render(true);

      button(element)?.click();
      await fixture.whenStable();

      const heading = element.querySelector('app-performance-panel h2');
      expect(heading).not.toBeNull();
      expect(document.activeElement).toBe(heading);
    });

    it('points the button at the panel it controls', async () => {
      const { fixture, element } = await render(true);

      button(element)?.click();
      await fixture.whenStable();

      const controlled = button(element)?.getAttribute('aria-controls');
      expect(controlled).toBeTruthy();
      expect(element.querySelector(`#${controlled}`)).toBe(element.querySelector('app-performance-panel section'));
    });

    it('gives focus back to the button when the panel closes', async () => {
      const { fixture, element } = await render(true);

      button(element)?.click();
      await fixture.whenStable();
      button(element)?.click();
      await fixture.whenStable();

      expect(element.querySelector('app-performance-panel')).toBeNull();
      expect(document.activeElement).toBe(button(element));
    });

    it('has no button before the user is logged in', async () => {
      const { element } = await render(false);

      expect(button(element)).toBeNull();
    });
  });

  describe('navigation', () => {
    async function render(loggedIn: boolean, url = '/dashboard') {
      await TestBed.configureTestingModule({
        imports: [AppComponent],
        // Routes without a component: only the URL matters for the active link
        providers: [provideRouter([{ path: 'dashboard', children: [] }, { path: 'requests', children: [] }]), provideHttpClient()],
      }).compileComponents();
      if (loggedIn) {
        sessionStorage.setItem('rm.session', JSON.stringify(fakeSession()));
      }
      const fixture = TestBed.createComponent(AppComponent);
      await TestBed.inject(Router).navigateByUrl(url);
      await fixture.whenStable();
      return fixture.nativeElement as HTMLElement;
    }

    const links = (element: HTMLElement) => Array.from(element.querySelectorAll<HTMLAnchorElement>('nav.app-nav a'));

    it('offers "לוח בקרה" and "פניות" to a logged-in user', async () => {
      const element = await render(true);

      expect(links(element).map((a) => [a.textContent?.trim(), a.getAttribute('href')])).toEqual([
        ['לוח בקרה', '/dashboard'],
        ['פניות', '/requests'],
      ]);
    });

    it('has no navigation before the user is logged in', async () => {
      const element = await render(false, '/dashboard');

      expect(element.querySelector('nav.app-nav')).toBeNull();
    });

    it.each([
      ['/dashboard', 'לוח בקרה'],
      ['/requests', 'פניות'],
    ])('marks only the screen the user is on (%s)', async (url, label) => {
      const element = await render(true, url);

      const active = links(element).filter((a) => a.classList.contains('active'));
      expect(active.map((a) => a.textContent?.trim())).toEqual([label]);
      expect(active[0].getAttribute('aria-current')).toBe('page');
      expect(links(element).filter((a) => a.hasAttribute('aria-current'))).toHaveLength(1);
    });
  });
});
