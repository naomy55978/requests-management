import { DEFAULT_URL, safeReturnUrl } from './safe-return-url';

describe('safeReturnUrl', () => {
  it.each(['/requests', '/requests?page=2&sortBy=title', '/requests/5#top'])('accepts the internal path %s', (url) => {
    expect(safeReturnUrl(url)).toBe(url);
  });

  it.each([
    ['nothing', null],
    ['nothing (undefined)', undefined],
    ['an empty string', ''],
    ['a protocol-relative URL', '//evil.com'],
    ['a backslash variant of it', '/\\evil.com'],
    ['an absolute URL', 'https://evil.com/requests'],
    ['a javascript: URL', 'javascript:alert(1)'],
    ['a relative path', 'requests'],
    ['the login screen itself', '/login'],
    ['the login screen with a query', '/login?returnUrl=%2Frequests'],
  ])('falls back to the list for %s', (_description, url) => {
    expect(safeReturnUrl(url)).toBe(DEFAULT_URL);
  });
});
