import { Routes } from '@angular/router';

export const routes: Routes = [
  {
    path: 'login',
    title: 'התחברות',
    loadComponent: () => import('./features/login/login.component').then((m) => m.LoginComponent),
  },
  { path: '**', redirectTo: 'login' },
];
