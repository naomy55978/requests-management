import { Injectable, signal } from '@angular/core';

import { ServerTiming } from './server-timing';

/** What a request was for, to tell the badges and the panel what to show. */
export type RequestKind = 'list' | 'summary' | 'history' | 'status' | 'bulk' | 'login' | 'other';

export const REQUEST_KIND_LABELS: Record<RequestKind, string> = {
  list: 'רשימה',
  summary: 'סיכום',
  history: 'היסטוריה',
  status: 'עדכון סטטוס',
  bulk: 'עדכון מרוכז',
  login: 'התחברות',
  other: 'אחר',
};

/** One finished request to the API. */
export interface PerformanceEntry {
  /** Grows with every entry; identifies it in lists. */
  id: number;
  /** When the answer arrived. */
  at: Date;
  kind: RequestKind;
  method: string;
  /** HTTP status of the answer (also for errors). */
  status: number;
  /** Time the browser measured, from sending to the answer. */
  clientMs: number;
  /** The `Server-Timing` header, null when the server did not send one. */
  timing: ServerTiming | null;
}

/** How many requests are remembered. */
export const MAX_ENTRIES = 50;

/**
 * The most recent requests to the API and how long they took (D-23). Memory only: it is gone on reload and holds
 * nothing but times. Written by the timing interceptor, read by the time badges and the performance panel.
 */
@Injectable({ providedIn: 'root' })
export class PerformanceLogService {
  private nextId = 1;

  /** Newest first. */
  readonly entries = signal<readonly PerformanceEntry[]>([]);

  /** Adds a timing entry at the top of the log, keeping only the newest entries. */
  record(entry: Omit<PerformanceEntry, 'id'>): void {
    const withId: PerformanceEntry = { ...entry, id: this.nextId++ };
    this.entries.update((entries) => [withId, ...entries].slice(0, MAX_ENTRIES));
  }

  /** The newest request of this kind, or null if there was none yet. */
  latest(kind: RequestKind): PerformanceEntry | null {
    return this.entries().find((entry) => entry.kind === kind) ?? null;
  }

  clear(): void {
    this.entries.set([]);
  }
}

/** Tells what an API call is for, from its method and URL (the path after the API base, without query string). */
export function classifyRequest(method: string, url: string): RequestKind {
  const path = url.split('?')[0].replace(/\/+$/, '');
  const verb = method.toUpperCase();

  if (verb === 'GET' && /\/requests$/.test(path)) {
    return 'list';
  }
  if (verb === 'GET' && /\/requests\/summary$/.test(path)) {
    return 'summary';
  }
  if (verb === 'GET' && /\/requests\/\d+\/history$/.test(path)) {
    return 'history';
  }
  if (verb === 'PATCH' && /\/requests\/\d+\/status$/.test(path)) {
    return 'status';
  }
  if (verb === 'POST' && /\/requests\/bulk-status$/.test(path)) {
    return 'bulk';
  }
  if (verb === 'POST' && /\/auth\/login$/.test(path)) {
    return 'login';
  }
  return 'other';
}
