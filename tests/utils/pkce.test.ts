import { describe, it, expect } from 'vitest';
import { generateCodeVerifier, generateCodeChallenge } from '../../src/utils/pkce';

const BASE64URL_SAFE = /^[A-Za-z0-9_-]+$/;

describe('generateCodeVerifier', () => {
  it('returns a base64url-safe string with no padding', () => {
    const verifier = generateCodeVerifier();

    expect(verifier).toMatch(BASE64URL_SAFE);
    expect(verifier).not.toContain('+');
    expect(verifier).not.toContain('/');
    expect(verifier).not.toContain('=');
  });

  it('returns a different value on each call', () => {
    const first = generateCodeVerifier();
    const second = generateCodeVerifier();

    expect(first).not.toBe(second);
  });
});

describe('generateCodeChallenge', () => {
  it('returns a base64url-safe SHA-256 digest of the verifier', async () => {
    const challenge = await generateCodeChallenge('a-fixed-code-verifier');

    expect(challenge).toMatch(BASE64URL_SAFE);
    expect(challenge).not.toContain('+');
    expect(challenge).not.toContain('/');
    expect(challenge).not.toContain('=');
  });

  it('is deterministic for the same verifier', async () => {
    const first = await generateCodeChallenge('same-verifier');
    const second = await generateCodeChallenge('same-verifier');

    expect(first).toBe(second);
  });

  it('produces different challenges for different verifiers', async () => {
    const first = await generateCodeChallenge('verifier-one');
    const second = await generateCodeChallenge('verifier-two');

    expect(first).not.toBe(second);
  });
});
