import { Routes } from '@angular/router';

import { authGuard } from './core/auth/auth.guard';

export const routes: Routes = [
  {
    path: 'login',
    title: 'התחברות',
    loadComponent: () => import('./features/login/login.component').then((m) => m.LoginComponent),
  },
  {
    path: 'requests',
    title: 'פניות',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./features/requests/requests-page/requests-page.component').then((m) => m.RequestsPageComponent),
  },
  { path: '', pathMatch: 'full', redirectTo: 'requests' },
  { path: '**', redirectTo: 'requests' },
];
