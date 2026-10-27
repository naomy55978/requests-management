import { HttpClient } from '@angular/common/http';
import { Injectable, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { Observable, tap } from 'rxjs';

import { environment } from '../../../environments/environment';
import { LoginRequest, LoginResponse } from '../api/api.models';

const STORAGE_KEY = 'rm.session';
const LOGOUT_CHANNEL = 'rm.auth';
const LOGOUT_MESSAGE = 'logout';

/**
 * Holds the login session (the JWT and who it belongs to). The session lives in sessionStorage (D-26):
 * it survives a refresh, ends with the tab, and two tabs can be logged in as two different users.
 */
@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly http = inject(HttpClient);
  private readonly router = inject(Router);

  private readonly session = signal<LoginResponse | null>(readStoredSession());

  /** Tells the app's other tabs about a logout (null where BroadcastChannel is not available). */
  private readonly channel = openLogoutChannel();

  constructor() {
    if (this.channel) {
      this.channel.onmessage = (event: MessageEvent<unknown>) => this.onLogoutMessage(event.data);
    }
  }

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

  /** Sends the credentials and, on success, keeps the returned session in memory and in sessionStorage. */
  login(credentials: LoginRequest): Observable<LoginResponse> {
    return this.http
      .post<LoginResponse>(`${environment.apiBaseUrl}/auth/login`, credentials)
      .pipe(tap((response) => this.store(response)));
  }

  /** Ends the session, goes to the login screen and logs the same user out of the other open tabs. */
  logout(): void {
    const userName = this.session()?.userName;
    this.endSession();
    if (userName) {
      this.channel?.postMessage({ type: LOGOUT_MESSAGE, userName });
    }
  }

  private endSession(): void {
    this.clear();
    void this.router.navigate(['/login']);
  }

  /**
   * Another tab logged out. Only the same user is logged out here: tabs may hold different users (D-26),
   * and one user's logout must not end another user's session. Does not broadcast again, so no echo loop.
   */
  private onLogoutMessage(data: unknown): void {
    const message = data as { type?: unknown; userName?: unknown } | null;
    const current = this.session();
    if (message?.type === LOGOUT_MESSAGE && current && message.userName === current.userName) {
      this.endSession();
    }
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
   * The one place that decides whether the session is valid: an expired session is dropped here, so the toolbar,
   * the guard and the interceptor agree. Runs when something asks; not from a computed (time is not a signal).
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

/** Opens the cross-tab channel, or returns null when the browser has no BroadcastChannel (then logout stays per tab). */
function openLogoutChannel(): BroadcastChannel | null {
  try {
    return typeof BroadcastChannel === 'undefined' ? null : new BroadcastChannel(LOGOUT_CHANNEL);
  } catch {
    return null;
  }
}

/** True when the session's expiry time has passed or cannot be read, so a damaged session never counts as valid. */
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

/** Saves the session to sessionStorage (or removes it for null), ignoring a storage that is unavailable. */
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

/** Checks that a stored value has the shape of a login response, so hand-edited storage cannot pass as a session. */
function isLoginResponse(value: unknown): value is LoginResponse {
  const candidate = value as Partial<LoginResponse> | null;
  return (
    typeof candidate?.accessToken === 'string' &&
    typeof candidate.expiresAt === 'string' &&
    typeof candidate.userName === 'string' &&
    typeof candidate.displayName === 'string'
  );
}
