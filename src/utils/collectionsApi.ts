import type { CollectionTransaction, PaymentScheduleResponse } from "../types";
import { validateCollections } from "./reconcileCollections";
import { isHttpUrl } from "./oauthValidation";

/** Why a Collections API call failed, so the view can suggest the right fix. */
export type CollectionsApiErrorKind =
  | "unauthorized"
  | "forbidden"
  | "network"
  | "http"
  | "invalid";

/** A failed Collections API call, classified by `kind`. */
export class CollectionsApiError extends Error {
  readonly kind: CollectionsApiErrorKind;
  readonly status?: number;

  constructor(kind: CollectionsApiErrorKind, message: string, status?: number) {
    super(message);
    this.name = "CollectionsApiError";
    this.kind = kind;
    this.status = status;
  }
}

/**
 * The default Collections API base URL: the Payment Schedule API's host with `-schedule`
 * swapped for `-collections` (each environment hosts both side by side). Null when the
 * host doesn't follow that naming, e.g. when running locally.
 */
export function deriveCollectionsBaseUrl(
  scheduleApiUrl: string | null | undefined,
): string | null {
  if (!scheduleApiUrl) return null;
  let url: URL;
  try {
    url = new URL(scheduleApiUrl);
  } catch {
    return null;
  }
  if (!url.hostname.includes("-schedule")) return null;
  url.hostname = url.hostname.replace("-schedule", "-collections");
  return url.origin;
}

/** Joins a base URL and an API path, tolerating a trailing slash on the base. */
function apiUrl(baseUrl: string, path: string): string {
  return `${baseUrl.replace(/\/+$/, "")}${path}`;
}

/** GETs a Collections API path as JSON, classifying failures; 204/404 mean "nothing found". */
async function getJson(
  baseUrl: string,
  path: string,
  token: string,
  signal?: AbortSignal,
): Promise<unknown> {
  let response: Response;
  try {
    response = await fetch(apiUrl(baseUrl, path), {
      headers: { Accept: "application/json", Authorization: `Bearer ${token}` },
      signal,
    });
  } catch (err) {
    if (err instanceof DOMException && err.name === "AbortError") throw err;
    // fetch only rejects when no response arrived: offline, DNS, TLS, or the browser
    // blocking a cross-origin response the API didn't allow (CORS).
    throw new CollectionsApiError(
      "network",
      "Couldn't reach the Collections API. Check the base URL and your connection; if both are right, the API may not allow requests from this site (CORS).",
    );
  }

  if (response.status === 204 || response.status === 404) return null;
  if (response.status === 401) {
    throw new CollectionsApiError(
      "unauthorized",
      "The Collections Service sign-in has expired or was rejected. Sign in again.",
      401,
    );
  }
  if (response.status === 403) {
    throw new CollectionsApiError(
      "forbidden",
      "Your account isn't allowed to read collections (403).",
      403,
    );
  }
  if (!response.ok) {
    throw new CollectionsApiError(
      "http",
      `The Collections API returned ${response.status}.`,
      response.status,
    );
  }
  return response.json();
}

/** Validates a transaction list from the API, dropping entries not linked to any schedule item. */
function toTransactions(json: unknown): CollectionTransaction[] {
  if (json === null) return [];
  const entries = Array.isArray(json) ? json : [json];
  const linked = entries.filter(
    (entry) =>
      entry &&
      typeof entry === "object" &&
      Array.isArray(
        (entry as { paymentScheduleItemIds?: unknown }).paymentScheduleItemIds,
      ),
  );
  try {
    return validateCollections(linked);
  } catch (err) {
    throw new CollectionsApiError(
      "invalid",
      `The Collections API returned unexpected data: ${err instanceof Error ? err.message : String(err)}`,
    );
  }
}

/** A stable identity for a transaction, used to drop duplicates returned by several item lookups. */
function transactionKey(txn: CollectionTransaction): string {
  return (
    txn.transactionReference ||
    `${txn.collectionId ?? ""}|${txn.paymentScheduleItemIds.join(",")}|${txn.collectionStatus}|${txn.amountDue}|${txn.modifiedDate ?? txn.createdDate ?? ""}`
  );
}

interface FetchScheduleCollectionsOptions {
  baseUrl: string;
  token: string;
  schedule: PaymentScheduleResponse;
  signal?: AbortSignal;
}

/**
 * Fetches the Collection Transactions for a schedule's items.
 *
 * When the schedule carries its policy number and risk ID (CosmosDB documents), one call
 * returns the risk's whole history (`GET /api/v1/collections/{policyNumber}/{riskId}`),
 * filtered to this schedule's items. Otherwise each item is looked up on its own
 * (`GET /api/v1/collection/{paymentScheduleItemId}`), which returns only its latest transaction.
 */
export async function fetchScheduleCollections({
  baseUrl,
  token,
  schedule,
  signal,
}: FetchScheduleCollectionsOptions): Promise<CollectionTransaction[]> {
  let base: URL;
  try {
    base = new URL(baseUrl);
  } catch {
    throw new CollectionsApiError(
      "invalid",
      "The Collections API base URL is not a valid URL.",
    );
  }
  if (!isHttpUrl(base)) {
    throw new CollectionsApiError(
      "invalid",
      "The Collections API base URL must use http or https.",
    );
  }

  const itemIds = new Set(schedule.scheduleItems.map((item) => item.id));
  const belongsToSchedule = (txn: CollectionTransaction) =>
    txn.paymentScheduleItemIds.some((id) => itemIds.has(id));

  if (
    schedule.policyNumber &&
    schedule.riskId !== null &&
    schedule.riskId !== undefined
  ) {
    const path = `/api/v1/collections/${encodeURIComponent(schedule.policyNumber)}/${encodeURIComponent(String(schedule.riskId))}`;
    return toTransactions(await getJson(base.href, path, token, signal)).filter(
      belongsToSchedule,
    );
  }

  const results = await Promise.all(
    [...itemIds].map(async (id) =>
      toTransactions(
        await getJson(
          base.href,
          `/api/v1/collection/${encodeURIComponent(id)}`,
          token,
          signal,
        ),
      ),
    ),
  );
  const unique = new Map<string, CollectionTransaction>();
  for (const txn of results.flat()) {
    unique.set(transactionKey(txn), txn);
  }
  return [...unique.values()];
}
