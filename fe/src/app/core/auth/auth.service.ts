import { HttpClient } from '@angular/common/http';
import { Injectable, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { Observable, tap } from 'rxjs';

import { environment } from '../../../environments/environment';
import { LoginRequest, LoginResponse } from '../api/api.models';

const STORAGE_KEY = 'rm.session';

/**
 * Holds the login session (the JWT and who it belongs to). The session lives in sessionStorage (D-26):
 * it survives a refresh, ends with the tab, and two tabs can be logged in as two different users.
 */
@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly http = inject(HttpClient);
  private readonly router = inject(Router);

  private readonly session = signal<LoginResponse | null>(readStoredSession());

  /** Display name of the logged-in user, for the toolbar. Null once the session is gone (logout, expiry). */
  readonly displayName = computed(() => this.session()?.displayName ?? null);

  /** The token to send, or null when there is none or it has expired. */
  get token(): string | null {
    return this.validSession()?.accessToken ?? null;
  }

  /** True while there is a session that has not expired (what the route guard asks). */
  isAuthenticated(): boolean {
    return this.validSession() !== null;
  }

  login(credentials: LoginRequest): Observable<LoginResponse> {
    return this.http
      .post<LoginResponse>(`${environment.apiBaseUrl}/auth/login`, credentials)
      .pipe(tap((response) => this.store(response)));
  }

  /** Ends the session and goes to the login screen. */
  logout(): void {
    this.clear();
    void this.router.navigate(['/login']);
  }

  /**
   * The server rejected the token (missing, expired or forged): forget it and go to login,
   * remembering the screen the user was on so they can return to it afterwards.
   */
  sessionExpired(): void {
    this.clear();
    const currentUrl = this.router.url;
    if (currentUrl.startsWith('/login')) {
      return;
    }
    void this.router.navigate(['/login'], { queryParams: { returnUrl: currentUrl } });
  }

  /**
   * The ONE place that decides whether the session is still valid. A session whose time has passed is dropped here,
   * so everything that shows the user (the toolbar's name, navigation and logout button) goes away with it, and not
   * only the guard and the interceptor. Time passing is not a signal, so this runs when something asks (a navigation
   * or an API call); it must not be called from a computed.
   */
  private validSession(): LoginResponse | null {
    const current = this.session();
    if (current && isExpired(current)) {
      this.clear();
      return null;
    }
    return current;
  }

  private store(response: LoginResponse): void {
    this.session.set(response);
    writeStoredSession(response);
  }

  private clear(): void {
    this.session.set(null);
    writeStoredSession(null);
  }
}

function isExpired(session: LoginResponse): boolean {
  const expiresAt = Date.parse(session.expiresAt);
  return Number.isNaN(expiresAt) || expiresAt <= Date.now();
}

// Storage can be unavailable or hold garbage (private mode, edited by hand): the app then just starts logged out
function readStoredSession(): LoginResponse | null {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    const parsed: unknown = raw ? JSON.parse(raw) : null;
    return isLoginResponse(parsed) && !isExpired(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

function writeStoredSession(session: LoginResponse | null): void {
  try {
    if (session) {
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify(session));
    } else {
      sessionStorage.removeItem(STORAGE_KEY);
    }
  } catch {
    // Without storage the session lasts until the page is refreshed
  }
}

function isLoginResponse(value: unknown): value is LoginResponse {
  const candidate = value as Partial<LoginResponse> | null;
  return (
    typeof candidate?.accessToken === 'string' &&
    typeof candidate.expiresAt === 'string' &&
    typeof candidate.userName === 'string' &&
    typeof candidate.displayName === 'string'
  );
}
