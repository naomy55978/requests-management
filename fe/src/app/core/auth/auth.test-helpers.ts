import { LoginResponse } from '../api/api.models';

/** A login response for tests. `expiresInMs` can be negative to get an already expired token. */
export function fakeSession(expiresInMs = 60 * 60 * 1000): LoginResponse {
  return {
    accessToken: 'test-token',
    expiresAt: new Date(Date.now() + expiresInMs).toISOString(),
    userName: 'dana.cohen',
    displayName: 'Dana Cohen',
  };
}
