/**
 * URL utility functions for handling base paths and redirects
 */

/**
 * Gets the full redirect URI including the base path from vite config
 */
export function getRedirectUri(): string {
  const origin = window.location.origin;
  const basePath = import.meta.env.BASE_URL || '/';
  
  // Ensure base path starts with / and doesn't end with / (unless it's just /)
  const normalizedBasePath = basePath === '/' ? '' : basePath.replace(/\/$/, '');
  
  return `${origin}${normalizedBasePath}`;
}

/**
 * Gets the current full URL including base path
 */
export function getCurrentUrl(): string {
  return window.location.href;
}