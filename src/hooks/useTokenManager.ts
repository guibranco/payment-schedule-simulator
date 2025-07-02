import { useState, useEffect, useCallback } from 'react';
import { STORAGE_KEYS } from '../constants';
import { generateCodeVerifier, generateCodeChallenge } from '../utils/pkce';
import { getRedirectUri } from '../utils/url';

interface TokenInfo {
  accessToken: string | null;
  expiresAt: number | null;
  isExpired: boolean;
  isExpiringSoon: boolean;
}

interface UseTokenManagerReturn {
  tokenInfo: TokenInfo;
  refreshToken: () => Promise<void>;
  isRefreshing: boolean;
  error: string | null;
}

/**
 * Custom hook for managing OAuth tokens with automatic refresh capabilities.
 * 
 * This hook handles token expiration detection, automatic refresh when tokens
 * are about to expire, and provides manual refresh functionality.
 */
export function useTokenManager(): UseTokenManagerReturn {
  const [tokenInfo, setTokenInfo] = useState<TokenInfo>({
    accessToken: null,
    expiresAt: null,
    isExpired: false,
    isExpiringSoon: false
  });
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /**
   * Updates token information from localStorage and calculates expiration status
   */
  const updateTokenInfo = useCallback(() => {
    const accessToken = localStorage.getItem(STORAGE_KEYS.ACCESS_TOKEN);
    const expiresAtStr = localStorage.getItem(STORAGE_KEYS.TOKEN_EXPIRES_AT);
    const expiresAt = expiresAtStr ? parseInt(expiresAtStr, 10) : null;
    
    const now = Date.now();
    const isExpired = expiresAt ? now >= expiresAt : false;
    const isExpiringSoon = expiresAt ? now >= (expiresAt - 5 * 60 * 1000) : false; // 5 minutes before expiry

    setTokenInfo({
      accessToken,
      expiresAt,
      isExpired,
      isExpiringSoon
    });
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

      const envSuffix = environment === 'prod' ? '' : `-${environment}`;
      const scope = `api://schedule-api${envSuffix}/user_impersonation`;

      // Generate PKCE parameters
      const codeVerifier = generateCodeVerifier();
      const codeChallenge = await generateCodeChallenge(codeVerifier);
      
      // Store code_verifier for later use in token exchange
      localStorage.setItem(STORAGE_KEYS.CODE_VERIFIER, codeVerifier);

      const redirectUri = getRedirectUri();
      const baseUrl = `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/authorize`;

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

      // Store the current URL to return to after auth
      localStorage.setItem(STORAGE_KEYS.RETURN_URL, window.location.href);

      window.location.href = `${baseUrl}?${params.toString()}`;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to refresh token');
      setIsRefreshing(false);
    }
  }, []);

  /**
   * Automatically refresh token when it's about to expire
   */
  useEffect(() => {
    if (tokenInfo.isExpiringSoon && !tokenInfo.isExpired && !isRefreshing) {
      refreshToken();
    }
  }, [tokenInfo.isExpiringSoon, tokenInfo.isExpired, isRefreshing, refreshToken]);

  /**
   * Set up periodic token info updates
   */
  useEffect(() => {
    updateTokenInfo();
    
    const interval = setInterval(updateTokenInfo, 60000); // Check every minute
    
    return () => clearInterval(interval);
  }, [updateTokenInfo]);

  /**
   * Listen for storage changes (token updates from other tabs)
   */
  useEffect(() => {
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