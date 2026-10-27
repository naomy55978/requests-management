import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { catchError, throwError } from 'rxjs';

import { environment } from '../../../environments/environment';
import { AuthService } from './auth.service';

const LOGIN_URL = `${environment.apiBaseUrl}/auth/login`;

/**
 * Adds the JWT to every API call; a 401 from any call but login ends the session and sends the user to login (D-10).
 * The error is always rethrown, so the caller still ends its own loading state.
 */
export const authInterceptor: HttpInterceptorFn = (request, next) => {
  const auth = inject(AuthService);

  const isApiCall = request.url.startsWith(environment.apiBaseUrl);
  const token = auth.token;
  const authorized =
    isApiCall && token ? request.clone({ setHeaders: { Authorization: `Bearer ${token}` } }) : request;

  return next(authorized).pipe(
    catchError((error: unknown) => {
      if (error instanceof HttpErrorResponse && error.status === 401 && isApiCall && request.url !== LOGIN_URL) {
        auth.sessionExpired();
      }
      return throwError(() => error);
    }),
  );
};
