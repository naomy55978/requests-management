import { HttpClient, provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';

import { AuthService } from './auth.service';
import { authInterceptor } from './auth.interceptor';
import { fakeSession } from './auth.test-helpers';

describe('authInterceptor', () => {
  let http: HttpClient;
  let backend: HttpTestingController;
  let auth: AuthService;
  let navigate: ReturnType<typeof vi.spyOn>;

  function setUp(loggedIn: boolean, currentUrl = '/requests?page=2'): void {
    sessionStorage.clear();
    if (loggedIn) {
      sessionStorage.setItem('rm.session', JSON.stringify(fakeSession()));
    }
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        provideHttpClient(withInterceptors([authInterceptor])),
        provideHttpClientTesting(),
      ],
    });
    http = TestBed.inject(HttpClient);
    backend = TestBed.inject(HttpTestingController);
    auth = TestBed.inject(AuthService);

    const router = TestBed.inject(Router);
    navigate = vi.spyOn(router, 'navigate').mockResolvedValue(true);
    vi.spyOn(router, 'url', 'get').mockReturnValue(currentUrl);
  }

  afterEach(() => backend.verify());

  it('adds the bearer token to API calls', () => {
    setUp(true);

    http.get('/api/requests').subscribe();

    expect(backend.expectOne('/api/requests').request.headers.get('Authorization')).toBe('Bearer test-token');
  });

  it('sends no Authorization header when there is no session', () => {
    setUp(false);

    http.get('/api/requests').subscribe({ error: () => undefined });

    expect(backend.expectOne('/api/requests').request.headers.has('Authorization')).toBe(false);
  });

  it('does not send the token to other addresses', () => {
    setUp(true);

    http.get('https://example.com/data').subscribe();

    expect(backend.expectOne('https://example.com/data').request.headers.has('Authorization')).toBe(false);
  });

  it('on 401 forgets the token and goes to login, remembering the current screen', () => {
    setUp(true, '/requests?page=2');
    const errors: unknown[] = [];

    http.get('/api/requests').subscribe({ error: (e: unknown) => errors.push(e) });
    backend.expectOne('/api/requests').flush({ title: 'Unauthorized' }, { status: 401, statusText: 'Unauthorized' });

    expect(auth.isAuthenticated()).toBe(false);
    expect(navigate).toHaveBeenCalledWith(['/login'], { queryParams: { returnUrl: '/requests?page=2' } });
    // The caller still gets the error, so it can end its own loading state
    expect(errors).toHaveLength(1);
  });

  it('does not navigate again when the user is already on the login screen', () => {
    setUp(false, '/login');

    http.get('/api/requests').subscribe({ error: () => undefined });
    backend.expectOne('/api/requests').flush(null, { status: 401, statusText: 'Unauthorized' });

    expect(navigate).not.toHaveBeenCalled();
  });

  it('treats a 401 from the login call as wrong credentials, not as an expired session', () => {
    setUp(false);

    auth.login({ userName: 'dana.cohen', password: 'wrong' }).subscribe({ error: () => undefined });
    backend.expectOne('/api/auth/login').flush(null, { status: 401, statusText: 'Unauthorized' });

    expect(navigate).not.toHaveBeenCalled();
  });

  it('leaves the session alone on other errors', () => {
    setUp(true);

    http.get('/api/requests').subscribe({ error: () => undefined });
    backend.expectOne('/api/requests').flush(null, { status: 500, statusText: 'Server Error' });

    expect(auth.isAuthenticated()).toBe(true);
    expect(navigate).not.toHaveBeenCalled();
  });
});
