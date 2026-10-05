import { useState, useEffect, useCallback } from "react";
import {
  type OAuthService,
  SERVICE_STORAGE,
  buildAuthorizationUrl,
  collectionsScope,
  environmentSuffix,
  savedEnvironment,
} from "../utils/oauthFlow";

export interface TokenInfo {
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

interface UseTokenManagerOptions {
  /**
   * Silently re-authorize shortly before the token expires. This navigates away from the
   * page, so it's only on for the Payment Schedule Service, whose token the app needs.
   */
  autoRefresh?: boolean;
}

/**
 * Reads a service's token information from localStorage and calculates its expiration status.
 */
export function readTokenInfo(service: OAuthService = "schedule"): TokenInfo {
  const keys = SERVICE_STORAGE[service];
  const accessToken = localStorage.getItem(keys.accessToken);
  const expiresAtStr = localStorage.getItem(keys.expiresAt);
  const expiresAt = expiresAtStr ? Number.parseInt(expiresAtStr, 10) : null;

  const now = Date.now();
  const isExpired = expiresAt ? now >= expiresAt : false;
  const isExpiringSoon = expiresAt ? now >= expiresAt - 5 * 60 * 1000 : false; // 5 minutes before expiry

  return {
    accessToken,
    expiresAt,
    isExpired,
    isExpiringSoon,
    checkedAt: now,
  };
}

/** The scope requested when re-authorizing a service. */
function refreshScope(service: OAuthService): string {
  if (service === "collections") return collectionsScope();
  return `api://schedule-api${environmentSuffix(savedEnvironment())}/user_impersonation`;
}

/**
 * Custom hook for managing a service's OAuth token with automatic refresh capabilities.
 *
 * This hook handles token expiration detection, optional automatic refresh when the token
 * is about to expire, and provides manual refresh functionality.
 */
export function useTokenManager(
  service: OAuthService = "schedule",
  { autoRefresh = service === "schedule" }: UseTokenManagerOptions = {},
): UseTokenManagerReturn {
  const [tokenInfo, setTokenInfo] = useState<TokenInfo>(() =>
    readTokenInfo(service),
  );
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /**
   * Updates token information from localStorage and calculates expiration status
   */
  const updateTokenInfo = useCallback(() => {
    setTokenInfo(readTokenInfo(service));
  }, [service]);

  /**
   * Initiates the OAuth flow to refresh the token, trying a silent sign-in first
   */
  const refreshToken = useCallback(async () => {
    setIsRefreshing(true);
    setError(null);

    try {
      window.location.href = await buildAuthorizationUrl(
        service,
        refreshScope(service),
        { silent: true },
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to refresh token");
      setIsRefreshing(false);
    }
  }, [service]);

  /**
   * Automatically refresh token when it's about to expire.
   * The refresh is scheduled rather than run inline so no state is set synchronously in the effect.
   */
  useEffect(() => {
    if (
      !autoRefresh ||
      !tokenInfo.isExpiringSoon ||
      tokenInfo.isExpired ||
      isRefreshing
    ) {
      return undefined;
    }
    const timeout = setTimeout(() => {
      void refreshToken();
    }, 0);
    return () => clearTimeout(timeout);
  }, [
    autoRefresh,
    tokenInfo.isExpiringSoon,
    tokenInfo.isExpired,
    isRefreshing,
    refreshToken,
  ]);

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
    const keys = SERVICE_STORAGE[service];
    /** Re-reads token information when another tab changes the stored token. */
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === keys.accessToken || e.key === keys.expiresAt) {
        updateTokenInfo();
      }
    };

    window.addEventListener("storage", handleStorageChange);
    return () => window.removeEventListener("storage", handleStorageChange);
  }, [service, updateTokenInfo]);

  return {
    tokenInfo,
    refreshToken,
    isRefreshing,
    error,
  };
}
