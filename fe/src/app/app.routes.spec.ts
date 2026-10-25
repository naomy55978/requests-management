import { authGuard } from './core/auth/auth.guard';
import { routes } from './app.routes';

describe('routes', () => {
  const route = (path: string) => routes.find((r) => r.path === path);

  it.each(['dashboard', 'requests'])('puts %s behind the auth guard', (path) => {
    expect(route(path)?.canActivate).toEqual([authGuard]);
  });

  it('leaves the login screen open', () => {
    expect(route('login')?.canActivate).toBeUndefined();
  });

  it('opens the dashboard for the root and for unknown paths (D-43)', () => {
    expect(route('')?.redirectTo).toBe('dashboard');
    expect(route('**')?.redirectTo).toBe('dashboard');
  });
});
