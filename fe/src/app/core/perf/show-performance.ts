import { InjectionToken } from '@angular/core';

import { environment } from '../../../environments/environment';

/**
 * Whether the optional performance UI is on: the "ביצועים" panel, the time badges and the timing interceptor (D-23).
 * Off by default, also in development, so the app shows only the required screens. Opt in with
 * `showPerformance: true` in the environment file; tests provide the token directly.
 */
export const SHOW_PERFORMANCE = new InjectionToken<boolean>('SHOW_PERFORMANCE', {
  providedIn: 'root',
  factory: () => environment.showPerformance,
});
