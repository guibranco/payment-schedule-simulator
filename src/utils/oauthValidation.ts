/**
 * Validation for values that flow from user input or browser storage into OAuth URLs,
 * storage and redirects, so a tampered value can't redirect the user off-site or
 * rewrite the identity-provider URL.
 */

/** A GUID or a domain-like name (e.g. `contoso.onmicrosoft.com`, `common`): letters, digits, dots and hyphens. */
const IDENTIFIER_PATTERN = /^[A-Za-z0-9](?:[A-Za-z0-9.-]{0,253}[A-Za-z0-9])?$/;

export const ENVIRONMENTS = ["prod", "int", "stg"] as const;
export type Environment = (typeof ENVIRONMENTS)[number];

/** Whether a tenant or client ID is safe to embed in an identity-provider URL path or query. */
export function isSafeIdentifier(value: string | null | undefined): value is string {
  return typeof value === "string" && IDENTIFIER_PATTERN.test(value);
}

/** Whether the value is one of the supported API environments. */
export function isEnvironment(value: string | null | undefined): value is Environment {
  return (ENVIRONMENTS as readonly string[]).includes(value ?? "");
}

/** Whether the URL uses HTTP or HTTPS (rejecting e.g. `javascript:` or `data:`). */
export function isHttpUrl(url: URL): boolean {
  return url.protocol === "http:" || url.protocol === "https:";
}

/**
 * Resolves a stored or derived URL (absolute, or relative to this page) and returns it
 * only when it stays on this origin over HTTP(S); otherwise null. Use before redirecting.
 */
export function toSameOriginUrl(value: string | null | undefined): string | null {
  if (!value) return null;
  try {
    const url = new URL(value, window.location.origin);
    return url.origin === window.location.origin && isHttpUrl(url) ? url.href : null;
  } catch {
    return null;
  }
}

/** The Microsoft identity platform OAuth 2.0 endpoint for a validated tenant. */
export function microsoftOAuthEndpoint(tenantId: string, endpoint: "authorize" | "token"): string {
  return `https://login.microsoftonline.com/${encodeURIComponent(tenantId)}/oauth2/v2.0/${endpoint}`;
}
