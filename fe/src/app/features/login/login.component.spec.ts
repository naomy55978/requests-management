import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, Router, provideRouter } from '@angular/router';

import { fakeSession } from '../../core/auth/auth.test-helpers';
import { LoginComponent } from './login.component';

describe('LoginComponent', () => {
  let fixture: ComponentFixture<LoginComponent>;
  let backend: HttpTestingController;
  let navigateByUrl: ReturnType<typeof vi.spyOn>;
  let element: HTMLElement;

  async function setUp(returnUrl: string | null): Promise<void> {
    sessionStorage.clear();
    await TestBed.configureTestingModule({
      imports: [LoginComponent],
      providers: [
        provideRouter([]),
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: ActivatedRoute, useValue: { snapshot: { queryParamMap: { get: () => returnUrl } } } },
      ],
    }).compileComponents();

    navigateByUrl = vi.spyOn(TestBed.inject(Router), 'navigateByUrl').mockResolvedValue(true);
    backend = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(LoginComponent);
    element = fixture.nativeElement as HTMLElement;
    await fixture.whenStable();
  }

  async function submit(userName: string, password: string): Promise<void> {
    const inputs = element.querySelectorAll('input');
    for (const [input, value] of [
      [inputs[0], userName],
      [inputs[1], password],
    ] as const) {
      input.value = value;
      input.dispatchEvent(new Event('input'));
    }
    element.querySelector('form')?.dispatchEvent(new Event('submit'));
    await fixture.whenStable();
  }

  afterEach(() => backend.verify());

  it('does not send the form while a field is empty, and says so', async () => {
    await setUp(null);

    await submit('', '');

    backend.expectNone('/api/auth/login');
    expect(element.textContent).toContain('יש להזין שם משתמש');
  });

  it('returns to the screen the user came from after a successful login', async () => {
    await setUp('/requests?page=3');

    await submit(' dana.cohen ', 'Demo123!');
    const request = backend.expectOne('/api/auth/login');
    expect(request.request.body).toEqual({ userName: 'dana.cohen', password: 'Demo123!' });
    request.flush(fakeSession());

    expect(navigateByUrl).toHaveBeenCalledWith('/requests?page=3');
  });

  it('ignores a return URL that leaves the application', async () => {
    await setUp('//evil.com');

    await submit('dana.cohen', 'Demo123!');
    backend.expectOne('/api/auth/login').flush(fakeSession());

    expect(navigateByUrl).toHaveBeenCalledWith('/requests');
  });

  it('shows a friendly message for wrong credentials and stays on the screen', async () => {
    await setUp(null);

    await submit('dana.cohen', 'wrong');
    backend.expectOne('/api/auth/login').flush(null, { status: 401, statusText: 'Unauthorized' });
    await fixture.whenStable();

    expect(element.querySelector('.login-error')?.textContent).toContain('שם המשתמש או הסיסמה שגויים');
    expect(navigateByUrl).not.toHaveBeenCalled();
  });

  it('never shows credentials on the login screen', async () => {
    await setUp(null);

    expect(element.querySelector('.demo-hint')).toBeNull();
    expect(element.textContent).not.toContain('Demo123!');
    expect(element.textContent).not.toContain('dana.cohen');
  });

  it('turns off spellcheck and sets the autofill hints on the inputs', async () => {
    await setUp(null);

    const user = element.querySelector('input[formControlName="userName"]');
    const password = element.querySelector('input[formControlName="password"]');
    expect(user?.getAttribute('spellcheck')).toBe('false');
    expect(user?.getAttribute('autocomplete')).toBe('username');
    expect(password?.getAttribute('autocomplete')).toBe('current-password');
  });
});
