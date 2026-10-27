import { Routes } from '@angular/router';

import { authGuard } from './core/auth/auth.guard';

export const routes: Routes = [
  {
    path: 'login',
    title: 'התחברות',
    loadComponent: () => import('./features/login/login.component').then((m) => m.LoginComponent),
  },
  {
    path: 'dashboard',
    title: 'לוח בקרה',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./features/dashboard/dashboard-page/dashboard-page.component').then((m) => m.DashboardPageComponent),
  },
  {
    path: 'requests',
    title: 'פניות',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./features/requests/requests-page/requests-page.component').then((m) => m.RequestsPageComponent),
  },
  // The first screen after login is the dashboard (D-43); the guard sends a logged-out user to /login?returnUrl=…
  { path: '', pathMatch: 'full', redirectTo: 'dashboard' },
  { path: '**', redirectTo: 'dashboard' },
];
