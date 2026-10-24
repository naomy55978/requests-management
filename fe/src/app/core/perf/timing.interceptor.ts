import { HttpErrorResponse, HttpInterceptorFn, HttpResponse } from '@angular/common/http';
import { inject } from '@angular/core';
import { tap } from 'rxjs';

import { environment } from '../../../environments/environment';
import { PerformanceLogService, classifyRequest } from './performance-log.service';
import { parseServerTiming } from './server-timing';

const SERVER_TIMING = 'Server-Timing';

/**
 * Notes how long every API call took: the time the browser measured, and the `Server-Timing` header of the answer
 * (also on errors, the server sends it there too). The header is readable because the dev-server proxy makes the
 * API the same origin as the app (D-25); without the header only the browser time is kept.
 *
 * A call that is cancelled (the user typed again, the page closed) never answers and is not noted.
 * Nothing is changed or delayed: the interceptor only looks.
 */
export const timingInterceptor: HttpInterceptorFn = (request, next) => {
  if (!request.url.startsWith(environment.apiBaseUrl)) {
    return next(request);
  }

  const log = inject(PerformanceLogService);
  const started = performance.now();

  const note = (response: HttpResponse<unknown> | HttpErrorResponse): void =>
    log.record({
      at: new Date(),
      kind: classifyRequest(request.method, request.url),
      method: request.method,
      status: response.status,
      clientMs: performance.now() - started,
      timing: parseServerTiming(response.headers.get(SERVER_TIMING)),
    });

  return next(request).pipe(
    tap({
      next: (event) => {
        if (event instanceof HttpResponse) {
          note(event);
        }
      },
      error: (error: unknown) => {
        if (error instanceof HttpErrorResponse) {
          note(error);
        }
      },
    }),
  );
};
