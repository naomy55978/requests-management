import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { ActivatedRouteSnapshot, Router, RouterStateSnapshot, UrlTree, provideRouter } from '@angular/router';

import { authGuard } from './auth.guard';
import { AuthService } from './auth.service';
import { fakeSession } from './auth.test-helpers';

const STORAGE_KEY = 'rm.session';

describe('authGuard', () => {
  function run(url: string): boolean | UrlTree {
    TestBed.configureTestingModule({ providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting()] });
    return TestBed.runInInjectionContext(() =>
      authGuard({} as ActivatedRouteSnapshot, { url } as RouterStateSnapshot),
    ) as boolean | UrlTree;
  }

  beforeEach(() => sessionStorage.clear());

  it('lets a logged-in user in', () => {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(fakeSession()));

    expect(run('/requests')).toBe(true);
  });

  it('sends a logged-out user to the login screen, remembering where they wanted to go', () => {
    const result = run('/requests?page=3');

    expect(result).toBeInstanceOf(UrlTree);
    expect(TestBed.inject(Router).serializeUrl(result as UrlTree)).toBe('/login?returnUrl=%2Frequests%3Fpage%3D3');
  });

  it('treats an expired session as logged out, and drops it so the toolbar stops showing the user', () => {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(fakeSession(60_000)));
    vi.useFakeTimers();
    try {
      TestBed.configureTestingModule({ providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting()] });
      const auth = TestBed.inject(AuthService);
      expect(auth.displayName()).toBe('Dana Cohen');
      vi.advanceTimersByTime(61_000);

      const result = TestBed.runInInjectionContext(() =>
        authGuard({} as ActivatedRouteSnapshot, { url: '/dashboard' } as RouterStateSnapshot),
      );

      expect(result).toBeInstanceOf(UrlTree);
      expect(auth.displayName()).toBeNull();
    } finally {
      vi.useRealTimers();
    }
  });
});
