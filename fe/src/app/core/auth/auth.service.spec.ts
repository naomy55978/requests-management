import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';

import { AuthService } from './auth.service';
import { fakeSession } from './auth.test-helpers';

const STORAGE_KEY = 'rm.session';

function createService(): AuthService {
  TestBed.configureTestingModule({
    providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting()],
  });
  return TestBed.inject(AuthService);
}

describe('AuthService', () => {
  beforeEach(() => sessionStorage.clear());

  it('starts logged out when nothing is stored', () => {
    const auth = createService();

    expect(auth.isAuthenticated()).toBe(false);
    expect(auth.token).toBeNull();
  });

  it('keeps the session after login, in sessionStorage', () => {
    const auth = createService();
    const http = TestBed.inject(HttpTestingController);

    auth.login({ userName: 'dana.cohen', password: 'x' }).subscribe();
    const request = http.expectOne('/api/auth/login');
    expect(request.request.method).toBe('POST');
    request.flush(fakeSession());

    expect(auth.token).toBe('test-token');
    expect(auth.displayName()).toBe('Dana Cohen');
    expect(sessionStorage.getItem(STORAGE_KEY)).toContain('test-token');
  });

  it('restores a valid stored session (page refresh)', () => {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(fakeSession()));

    expect(createService().token).toBe('test-token');
  });

  it('ignores a stored session that has expired', () => {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(fakeSession(-1000)));

    expect(createService().isAuthenticated()).toBe(false);
  });

  it('ignores a stored value that is not a session', () => {
    sessionStorage.setItem(STORAGE_KEY, '{"accessToken": 5}');

    expect(createService().isAuthenticated()).toBe(false);
  });

  it('treats a token as missing once its expiry time has passed', () => {
    vi.useFakeTimers();
    try {
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify(fakeSession(60_000)));
      const auth = createService();
      expect(auth.isAuthenticated()).toBe(true);

      vi.advanceTimersByTime(61_000);

      expect(auth.isAuthenticated()).toBe(false);
      expect(auth.token).toBeNull();
    } finally {
      vi.useRealTimers();
    }
  });

  it('drops an expired session everywhere: no user name for the toolbar, nothing left in storage', () => {
    vi.useFakeTimers();
    try {
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify(fakeSession(60_000)));
      const auth = createService();
      expect(auth.displayName()).toBe('Dana Cohen');

      vi.advanceTimersByTime(61_000);
      auth.isAuthenticated();

      expect(auth.displayName()).toBeNull();
      expect(sessionStorage.getItem(STORAGE_KEY)).toBeNull();
    } finally {
      vi.useRealTimers();
    }
  });

  it('logout forgets the session and goes to the login screen', () => {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(fakeSession()));
    const auth = createService();
    const navigate = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);

    auth.logout();

    expect(auth.isAuthenticated()).toBe(false);
    expect(sessionStorage.getItem(STORAGE_KEY)).toBeNull();
    expect(navigate).toHaveBeenCalledWith(['/login']);
  });
});
