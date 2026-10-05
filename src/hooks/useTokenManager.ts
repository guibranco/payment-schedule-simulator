import { useState, useEffect, useCallback } from 'react';
import { STORAGE_KEYS } from '../constants';
import { generateCodeVerifier, generateCodeChallenge } from '../utils/pkce';
import { getRedirectUri } from '../utils/url';
import { isEnvironment, isSafeIdentifier, microsoftOAuthEndpoint } from '../utils/oauthValidation';

interface TokenInfo {
  accessToken: string | null;
  expiresAt: number | null;
  isExpired: boolean;
  isExpiringSoon: boolean;
  /** Timestamp (ms) at which this information was read, used as "now" for countdowns. */
  checkedAt: number;
}

interface UseTokenManagerReturn {
  tokenInfo: TokenInfo;
  refreshToken: () => Promise<void>;
  isRefreshing: boolean;
  error: string | null;
}

/**
 * Reads token information from localStorage and calculates its expiration status.
 */
function readTokenInfo(): TokenInfo {
  const accessToken = localStorage.getItem(STORAGE_KEYS.ACCESS_TOKEN);
  const expiresAtStr = localStorage.getItem(STORAGE_KEYS.TOKEN_EXPIRES_AT);
  const expiresAt = expiresAtStr ? Number.parseInt(expiresAtStr, 10) : null;

  const now = Date.now();
  const isExpired = expiresAt ? now >= expiresAt : false;
  const isExpiringSoon = expiresAt ? now >= (expiresAt - 5 * 60 * 1000) : false; // 5 minutes before expiry

  return {
    accessToken,
    expiresAt,
    isExpired,
    isExpiringSoon,
    checkedAt: now
  };
}

/**
 * Custom hook for managing OAuth tokens with automatic refresh capabilities.
 *
 * This hook handles token expiration detection, automatic refresh when tokens
 * are about to expire, and provides manual refresh functionality.
 */
export function useTokenManager(): UseTokenManagerReturn {
  const [tokenInfo, setTokenInfo] = useState<TokenInfo>(readTokenInfo);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /**
   * Updates token information from localStorage and calculates expiration status
   */
  const updateTokenInfo = useCallback(() => {
    setTokenInfo(readTokenInfo());
  }, []);

  /**
   * Initiates the OAuth flow to refresh the token
   */
  const refreshToken = useCallback(async () => {
    setIsRefreshing(true);
    setError(null);

    try {
      const clientId = localStorage.getItem(STORAGE_KEYS.CLIENT_ID);
      const tenantId = localStorage.getItem(STORAGE_KEYS.TENANT_ID);
      const environment = localStorage.getItem(STORAGE_KEYS.ENVIRONMENT) || 'prod';

      if (!clientId || !tenantId) {
        throw new Error('OAuth configuration missing. Please reconfigure the application.');
      }
      if (!isSafeIdentifier(clientId) || !isSafeIdentifier(tenantId) || !isEnvironment(environment)) {
        throw new TypeError('OAuth configuration is invalid. Please reconfigure the application.');
      }

      const envSuffix = environment === 'prod' ? '' : `-${environment}`;
      const scope = `api://schedule-api${envSuffix}/user_impersonation`;

      // Generate PKCE parameters
      const codeVerifier = generateCodeVerifier();
      const codeChallenge = await generateCodeChallenge(codeVerifier);

      // Store code_verifier for later use in token exchange
      localStorage.setItem(STORAGE_KEYS.CODE_VERIFIER, codeVerifier);

      const redirectUri = getRedirectUri();
      const baseUrl = microsoftOAuthEndpoint(tenantId, 'authorize');

      const params = new URLSearchParams({
        client_id: clientId,
        response_type: 'code',
        redirect_uri: redirectUri,
        scope,
        state: crypto.randomUUID(),
        code_challenge: codeChallenge,
        code_challenge_method: 'S256',
        prompt: 'none' // Try silent refresh first
      });

      // Store where to return to after auth, as a path on this origin only
      const { pathname, search, hash } = window.location;
      localStorage.setItem(STORAGE_KEYS.RETURN_URL, `${pathname}${search}${hash}`);

      window.location.href = `${baseUrl}?${params.toString()}`;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to refresh token');
      setIsRefreshing(false);
    }
  }, []);

  /**
   * Automatically refresh token when it's about to expire.
   * The refresh is scheduled rather than run inline so no state is set synchronously in the effect.
   */
  useEffect(() => {
    if (!tokenInfo.isExpiringSoon || tokenInfo.isExpired || isRefreshing) {
      return undefined;
    }
    const timeout = setTimeout(() => {
      void refreshToken();
    }, 0);
    return () => clearTimeout(timeout);
  }, [tokenInfo.isExpiringSoon, tokenInfo.isExpired, isRefreshing, refreshToken]);

  /**
   * Set up periodic token info updates (the initial read happens in the state initialiser)
   */
  useEffect(() => {
    const interval = setInterval(updateTokenInfo, 60000); // Check every minute

    return () => clearInterval(interval);
  }, [updateTokenInfo]);

  /**
   * Listen for storage changes (token updates from other tabs)
   */
  useEffect(() => {
    /** Re-reads token information when another tab changes the stored token. */
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === STORAGE_KEYS.ACCESS_TOKEN || e.key === STORAGE_KEYS.TOKEN_EXPIRES_AT) {
        updateTokenInfo();
      }
    };

    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, [updateTokenInfo]);

  return {
    tokenInfo,
    refreshToken,
    isRefreshing,
    error
  };
}
