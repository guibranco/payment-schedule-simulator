import { describe, it, expect } from 'vitest';
import { getRedirectUri, getCurrentUrl } from '../../src/utils/url';

describe('getRedirectUri', () => {
  it('combines the window origin with the base path', () => {
    expect(getRedirectUri()).toBe(window.location.origin);
  });
});

describe('getCurrentUrl', () => {
  it('returns the current full URL', () => {
    expect(getCurrentUrl()).toBe(window.location.href);
  });
});
