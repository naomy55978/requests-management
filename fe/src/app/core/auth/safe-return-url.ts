/** Where to go when there is no (valid) return URL: the dashboard, the first screen after login (D-43). */
export const DEFAULT_URL = '/dashboard';

/**
 * The `returnUrl` query parameter can be set by anyone who crafts a link, so only internal paths are accepted:
 * "/requests?x=1" is fine, "//evil.com", "/\evil.com" or "https://evil.com" (open redirect) are not.
 */
export function safeReturnUrl(url: string | null | undefined): string {
  if (!url || !url.startsWith('/') || url.startsWith('//') || url.startsWith('/\\')) {
    return DEFAULT_URL;
  }
  // Going back to the login screen after logging in would be pointless
  if (url === '/login' || url.startsWith('/login?') || url.startsWith('/login/')) {
    return DEFAULT_URL;
  }
  return url;
}
