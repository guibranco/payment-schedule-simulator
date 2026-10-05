/**
 * URL utility functions for handling base paths and redirects
 */

/**
 * Constructs the full redirect URI by combining the window origin and the base path from vite config.
 */
export function getRedirectUri(): string {
  const origin = window.location.origin;
  const basePath = import.meta.env.BASE_URL || "/";

  // Ensure base path starts with / and doesn't end with / (unless it's just /)
  const normalizedBasePath =
    basePath === "/" ? "" : basePath.replace(/\/$/, "");

  return `${origin}${normalizedBasePath}`;
}

/**
 * Retrieves the current full URL, including the base path.
 */
export function getCurrentUrl(): string {
  return window.location.href;
}

/**
 * Derives the Collections Service Swagger UI URL from the simulator's own URL. Each
 * environment hosts the simulator under the Schedule API's host at `/simulator`
 * (e.g. `https://ca-devp-ne-schedule-api.<env>.azurecontainerapps.io/simulator`), and the
 * Collections API sits alongside it with `-schedule` swapped for `-collections`, serving
 * Swagger at `/swagger`. Returns null when the current host doesn't follow that naming
 * (e.g. running locally), since there's no environment to derive the URL from.
 */
export function getCollectionsSwaggerUrl(
  currentUrl: string = getCurrentUrl(),
): string | null {
  let url: URL;
  try {
    url = new URL(currentUrl);
  } catch {
    return null;
  }

  if (!url.hostname.includes("-schedule")) return null;

  url.hostname = url.hostname.replace("-schedule", "-collections");
  url.pathname = "/swagger";
  url.search = "";
  url.hash = "";
  return url.toString();
}
