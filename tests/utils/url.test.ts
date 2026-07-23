import { describe, it, expect, vi, afterEach } from 'vitest';
import { getRedirectUri, getCurrentUrl } from '../../src/utils/url';

afterEach(() => {
  vi.unstubAllEnvs();
});

describe('getRedirectUri', () => {
  it('returns just the origin when the base path is root', () => {
    expect(getRedirectUri()).toBe(window.location.origin);
  });

  it('combines the window origin with a non-root base path', () => {
    vi.stubEnv('BASE_URL', '/payment-schedule-simulator/');

    expect(getRedirectUri()).toBe(`${window.location.origin}/payment-schedule-simulator`);
  });
});

describe('getCurrentUrl', () => {
  it('returns the current full URL', () => {
    expect(getCurrentUrl()).toBe(window.location.href);
  });
});
