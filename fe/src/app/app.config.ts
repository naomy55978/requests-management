import { registerLocaleData } from '@angular/common';
import { provideHttpClient } from '@angular/common/http';
import localeHe from '@angular/common/locales/he';
import { ApplicationConfig, LOCALE_ID, provideBrowserGlobalErrorListeners } from '@angular/core';
import { MAT_DATE_LOCALE, provideNativeDateAdapter } from '@angular/material/core';
import { provideRouter } from '@angular/router';

import { routes } from './app.routes';

// Hebrew formats for the date and number pipes
registerLocaleData(localeHe);

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideRouter(routes),
    provideHttpClient(),
    { provide: LOCALE_ID, useValue: 'he' },
    // Date pickers: Hebrew month and day names, week starts on Sunday
    { provide: MAT_DATE_LOCALE, useValue: 'he-IL' },
    provideNativeDateAdapter(),
  ],
};
