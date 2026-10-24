import { registerLocaleData } from '@angular/common';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import localeHe from '@angular/common/locales/he';
import { ApplicationConfig, LOCALE_ID, provideBrowserGlobalErrorListeners } from '@angular/core';
import { MAT_DATE_LOCALE, provideNativeDateAdapter } from '@angular/material/core';
import { MatPaginatorIntl } from '@angular/material/paginator';
import { provideRouter } from '@angular/router';

import { routes } from './app.routes';
import { authInterceptor } from './core/auth/auth.interceptor';
import { HebrewPaginatorIntl } from './core/i18n/hebrew-paginator-intl';

// Hebrew formats for the date and number pipes
registerLocaleData(localeHe);

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideRouter(routes),
    provideHttpClient(withInterceptors([authInterceptor])),
    { provide: LOCALE_ID, useValue: 'he' },
    // Date pickers: Hebrew month and day names, week starts on Sunday
    { provide: MAT_DATE_LOCALE, useValue: 'he-IL' },
    provideNativeDateAdapter(),
    { provide: MatPaginatorIntl, useClass: HebrewPaginatorIntl },
  ],
};
