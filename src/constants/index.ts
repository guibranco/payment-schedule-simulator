export const STORAGE_KEYS = {
  ACTIVE_TAB: 'activeTab',
  API_ENDPOINT: 'apiEndpoint',
  ACCESS_TOKEN: 'accessToken',
  TOKEN_EXPIRES_AT: 'tokenExpiresAt',
  CLIENT_ID: 'clientId',
  TENANT_ID: 'tenantId',
  ENVIRONMENT: 'environment',
  CONFIG_CANCELLED: 'configCancelled',
  CODE_VERIFIER: 'codeVerifier',
  RETURN_URL: 'returnUrl',
  SCHEDULE_EXPORT_FORMAT: 'scheduleExportFormat',
  // Collections Service (its own app registration and token)
  COLLECTIONS_API_ENDPOINT: 'collectionsApiEndpoint',
  COLLECTIONS_CLIENT_ID: 'collectionsClientId',
  COLLECTIONS_TENANT_ID: 'collectionsTenantId',
  COLLECTIONS_SCOPE: 'collectionsScope',
  COLLECTIONS_ACCESS_TOKEN: 'collectionsAccessToken',
  COLLECTIONS_TOKEN_EXPIRES_AT: 'collectionsTokenExpiresAt',
  COLLECTIONS_REFRESH_MINUTES: 'collectionsRefreshMinutes'
} as const;

/** Default Collections Service scope; `{environment-suffix}` becomes e.g. `-int`, or nothing in prod. */
export const DEFAULT_COLLECTIONS_SCOPE = 'api://collections-api{environment-suffix}/user_impersonation';
