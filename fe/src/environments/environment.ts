// Production build (the default). `ng serve` / the development build swap this file for environment.development.ts.
export const environment = {
  production: true,
  // Relative on purpose: in development the dev-server proxy forwards /api to the API (proxy.conf.json);
  // in a deployment the web server is expected to do the same. Same origin = no CORS.
  apiBaseUrl: '/api',
  // The demo credentials hint on the login screen exists only in development builds.
  showDemoHint: false,
};
