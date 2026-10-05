import { DEFAULT_COLLECTIONS_SCOPE, STORAGE_KEYS } from '../constants';
import { generateCodeChallenge, generateCodeVerifier } from './pkce';
import { getRedirectUri } from './url';
import {
  type Environment,
  isEnvironment,
  isSafeIdentifier,
  microsoftOAuthEndpoint,
  toSameOriginUrl
} from './oauthValidation';

/** The APIs this app signs in to, each with its own app registration and token. */
export type OAuthService = 'schedule' | 'collections';

interface ServiceStorageKeys {
  clientId: string;
  tenantId: string;
  accessToken: string;
  expiresAt: string;
}

/** Where each service's configuration and token live in localStorage. */
export const SERVICE_STORAGE: Record<OAuthService, ServiceStorageKeys> = {
  schedule: {
    clientId: STORAGE_KEYS.CLIENT_ID,
    tenantId: STORAGE_KEYS.TENANT_ID,
    accessToken: STORAGE_KEYS.ACCESS_TOKEN,
    expiresAt: STORAGE_KEYS.TOKEN_EXPIRES_AT
  },
  collections: {
    clientId: STORAGE_KEYS.COLLECTIONS_CLIENT_ID,
    tenantId: STORAGE_KEYS.COLLECTIONS_TENANT_ID,
    accessToken: STORAGE_KEYS.COLLECTIONS_ACCESS_TOKEN,
    expiresAt: STORAGE_KEYS.COLLECTIONS_TOKEN_EXPIRES_AT
  }
};

// The OAuth `state` round-trips through the identity provider, so it's how the callback
// knows which service's token is being issued. Untagged states are the Payment Schedule
// Service, matching sign-ins started before the Collections Service existed.
const COLLECTIONS_STATE_PREFIX = 'collections:';

/** Which service an OAuth callback's `state` belongs to. */
export function serviceFromState(state: string): OAuthService {
  return state.startsWith(COLLECTIONS_STATE_PREFIX) ? 'collections' : 'schedule';
}

/** The configured environment, defaulting to prod. */
export function savedEnvironment(): Environment {
  const stored = localStorage.getItem(STORAGE_KEYS.ENVIRONMENT);
  return isEnvironment(stored) ? stored : 'prod';
}

/** The scope suffix for an environment: nothing in prod, otherwise e.g. `-int`. */
export function environmentSuffix(environment: Environment): string {
  return environment === 'prod' ? '' : `-${environment}`;
}

/** Fills a scope template's `{environment-suffix}` placeholder for the environment. */
export function resolveScope(template: string, environment: Environment): string {
  return template.replaceAll('{environment-suffix}', environmentSuffix(environment));
}

/** The Collections Service scope to request: the saved template (or default) for the saved environment. */
export function collectionsScope(): string {
  const template = localStorage.getItem(STORAGE_KEYS.COLLECTIONS_SCOPE) || DEFAULT_COLLECTIONS_SCOPE;
  return resolveScope(template, savedEnvironment());
}

/**
 * Starts a PKCE authorization for a service: stores the code verifier and where to
 * return to (a same-origin path), and returns the identity provider URL to navigate to.
 * With `silent`, asks for `prompt=none` so an existing session is reused without a prompt.
 */
export async function buildAuthorizationUrl(
  service: OAuthService,
  scope: string,
  { silent = false }: { silent?: boolean } = {}
): Promise<string> {
  const keys = SERVICE_STORAGE[service];
  const clientId = localStorage.getItem(keys.clientId);
  const tenantId = localStorage.getItem(keys.tenantId);
  if (!clientId || !tenantId) {
    throw new Error('OAuth configuration missing. Please reconfigure the application.');
  }
  if (!isSafeIdentifier(clientId) || !isSafeIdentifier(tenantId)) {
    throw new TypeError('OAuth configuration is invalid. Please reconfigure the application.');
  }

  const codeVerifier = generateCodeVerifier();
  const codeChallenge = await generateCodeChallenge(codeVerifier);
  localStorage.setItem(STORAGE_KEYS.CODE_VERIFIER, codeVerifier);

  const { pathname, search, hash } = window.location;
  localStorage.setItem(STORAGE_KEYS.RETURN_URL, `${pathname}${search}${hash}`);

  const statePrefix = service === 'collections' ? COLLECTIONS_STATE_PREFIX : '';
  const params = new URLSearchParams({
    client_id: clientId,
    response_type: 'code',
    redirect_uri: getRedirectUri(),
    scope,
    state: `${statePrefix}${crypto.randomUUID()}`,
    code_challenge: codeChallenge,
    code_challenge_method: 'S256'
  });
  if (silent) {
    params.set('prompt', 'none');
  }

  return `${microsoftOAuthEndpoint(tenantId, 'authorize')}?${params.toString()}`;
}

/**
 * Exchanges an authorization code for an access token with the issuing service's app
 * registration, stores the token and its expiry under that service, and returns to the
 * original (same-origin) URL if one was saved. Throws if the configuration is invalid
 * or the exchange fails.
 */
export async function exchangeCodeForToken(code: string, state: string, codeVerifier: string): Promise<void> {
  const keys = SERVICE_STORAGE[serviceFromState(state)];
  const tenantId = localStorage.getItem(keys.tenantId);
  const clientId = localStorage.getItem(keys.clientId);

  if (!isSafeIdentifier(tenantId)) {
    throw new TypeError('Invalid or missing tenant ID');
  }

  const response = await fetch(microsoftOAuthEndpoint(tenantId, 'token'), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded'
    },
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      client_id: isSafeIdentifier(clientId) ? clientId : '',
      redirect_uri: getRedirectUri(),
      code_verifier: codeVerifier
    })
  });

  if (!response.ok) {
    throw new Error(`Token exchange failed: ${response.status}`);
  }

  const data: { access_token?: unknown; expires_in?: unknown } = await response.json();
  if (typeof data.access_token !== 'string' || data.access_token === '') {
    throw new TypeError('Token response did not include an access token');
  }
  localStorage.setItem(keys.accessToken, data.access_token);

  // Calculate and store expiration time, defaulting to 1 hour if missing or invalid
  const expiresIn = Number(data.expires_in);
  const expiresAt = Date.now() + (Number.isFinite(expiresIn) && expiresIn > 0 ? expiresIn : 3600) * 1000;
  localStorage.setItem(keys.expiresAt, expiresAt.toString());
  // Writes in this tab don't fire `storage` events here, so announce the new token for
  // views that mounted before the exchange finished (see useTokenManager).
  window.dispatchEvent(new StorageEvent('storage', { key: keys.accessToken }));

  localStorage.removeItem(STORAGE_KEYS.CODE_VERIFIER);

  // Return to the original URL if available — only ever on this origin
  const returnUrl = toSameOriginUrl(localStorage.getItem(STORAGE_KEYS.RETURN_URL));
  localStorage.removeItem(STORAGE_KEYS.RETURN_URL);
  if (returnUrl && returnUrl !== window.location.href) {
    window.location.href = returnUrl;
  }
}
