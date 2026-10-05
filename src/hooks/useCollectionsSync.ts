import { useCallback, useEffect, useRef, useState } from "react";
import { STORAGE_KEYS } from "../constants";
import type { CollectionTransaction, PaymentScheduleResponse } from "../types";
import {
  CollectionsApiError,
  type CollectionsApiErrorKind,
  deriveCollectionsBaseUrl,
  fetchScheduleCollections,
} from "../utils/collectionsApi";
import { buildAuthorizationUrl, collectionsScope } from "../utils/oauthFlow";
import { navigateTo } from "../utils/url";
import { useTokenManager } from "./useTokenManager";

/** Auto-refresh choices in minutes; 0 turns the timer off. */
export const REFRESH_INTERVAL_OPTIONS = [0, 1, 5, 15] as const;
export type RefreshMinutes = (typeof REFRESH_INTERVAL_OPTIONS)[number];
const DEFAULT_REFRESH_MINUTES: RefreshMinutes = 5;

/**
 * - `unconfigured`: no Collections Service client/tenant or base URL yet.
 * - `signedOut`: configured, but no token.
 * - `expired`: the token has expired.
 * - `ready`: collections can be fetched automatically.
 */
export type CollectionsConnection =
  | "unconfigured"
  | "signedOut"
  | "expired"
  | "ready";
export type CollectionsSyncStatus = "idle" | "loading" | "success" | "error";

/** The saved refresh interval, defaulting to 5 minutes. */
function readRefreshMinutes(): RefreshMinutes {
  const raw = localStorage.getItem(STORAGE_KEYS.COLLECTIONS_REFRESH_MINUTES);
  const saved = raw === null ? Number.NaN : Number(raw);
  return (REFRESH_INTERVAL_OPTIONS as readonly number[]).includes(saved)
    ? (saved as RefreshMinutes)
    : DEFAULT_REFRESH_MINUTES;
}

/**
 * The Collections API base URL: the saved one, else derived from the Payment Schedule
 * API URL, else from this page's URL (the simulator is hosted on the Schedule API's host).
 */
export function collectionsBaseUrl(): string | null {
  return (
    localStorage.getItem(STORAGE_KEYS.COLLECTIONS_API_ENDPOINT) ||
    deriveCollectionsBaseUrl(localStorage.getItem(STORAGE_KEYS.API_ENDPOINT)) ||
    deriveCollectionsBaseUrl(window.location.href)
  );
}

/** Whether the Collections Service sign-in is configured (client and tenant saved). */
function isCollectionsConfigured(): boolean {
  return Boolean(
    localStorage.getItem(STORAGE_KEYS.COLLECTIONS_CLIENT_ID) &&
    localStorage.getItem(STORAGE_KEYS.COLLECTIONS_TENANT_ID) &&
    collectionsBaseUrl(),
  );
}

/** Wraps any thrown value as a CollectionsApiError (of `kind` when it isn't one already). */
function toCollectionsError(
  err: unknown,
  kind: CollectionsApiErrorKind = "http",
): CollectionsApiError {
  if (err instanceof CollectionsApiError) return err;
  return new CollectionsApiError(
    kind,
    err instanceof Error ? err.message : String(err),
  );
}

interface Options {
  schedule: PaymentScheduleResponse | null;
  /** Receives the fetched Collection Transactions for the schedule. */
  onCollections: (collections: CollectionTransaction[]) => void;
}

/**
 * Keeps a schedule's Collection Transactions in sync with the Collections API once the
 * Collections Service is signed in to: fetches when a schedule is shown, then every few
 * minutes (configurable, remembered), plus on demand. Loading collections by hand pauses
 * the automatic fetches for that schedule until the next manual refresh.
 */
export function useCollectionsSync({ schedule, onCollections }: Options) {
  const { tokenInfo } = useTokenManager("collections");
  const [status, setStatus] = useState<CollectionsSyncStatus>("idle");
  const [error, setError] = useState<CollectionsApiError | null>(null);
  const [lastCheckedAt, setLastCheckedAt] = useState<number | null>(null);
  const [refreshMinutes, setRefreshMinutes] =
    useState<RefreshMinutes>(readRefreshMinutes);
  const [pausedScheduleId, setPausedScheduleId] = useState<string | null>(null);

  // The latest schedule and callback, read at fetch time so editing the schedule on screen
  // (e.g. toggling an item's status) doesn't trigger a refetch; only switching schedules does.
  const scheduleRef = useRef(schedule);
  const onCollectionsRef = useRef(onCollections);
  const abortRef = useRef<AbortController | null>(null);
  useEffect(() => {
    scheduleRef.current = schedule;
    onCollectionsRef.current = onCollections;
  }, [schedule, onCollections]);

  let connection: CollectionsConnection;
  if (!isCollectionsConfigured()) connection = "unconfigured";
  else if (!tokenInfo.accessToken) connection = "signedOut";
  else if (tokenInfo.isExpired) connection = "expired";
  else connection = "ready";

  const scheduleId = schedule?.id ?? null;
  const isPaused = scheduleId !== null && pausedScheduleId === scheduleId;
  const accessToken = tokenInfo.accessToken;

  /** Fetches the schedule's collections now, replacing any request still in flight. */
  const fetchNow = useCallback(async () => {
    const schedule = scheduleRef.current;
    const baseUrl = collectionsBaseUrl();
    if (!schedule || !accessToken || !baseUrl) return;

    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setStatus("loading");
    try {
      const collections = await fetchScheduleCollections({
        baseUrl,
        token: accessToken,
        schedule,
        signal: controller.signal,
      });
      if (controller.signal.aborted) return;
      onCollectionsRef.current(collections);
      setError(null);
      setStatus("success");
    } catch (err) {
      if (controller.signal.aborted) return;
      setError(toCollectionsError(err));
      setStatus("error");
    } finally {
      if (!controller.signal.aborted) setLastCheckedAt(Date.now());
    }
  }, [accessToken]);

  // Fetch as soon as a schedule is shown, when switching schedules, and when the sign-in changes.
  const canAutoFetch =
    connection === "ready" && scheduleId !== null && !isPaused;
  useEffect(() => {
    if (!canAutoFetch) return undefined;
    const timeout = setTimeout(() => void fetchNow(), 0);
    return () => clearTimeout(timeout);
  }, [canAutoFetch, scheduleId, fetchNow]);

  // Then keep checking on the chosen interval.
  useEffect(() => {
    if (!canAutoFetch || refreshMinutes === 0) return undefined;
    const interval = setInterval(
      () => void fetchNow(),
      refreshMinutes * 60 * 1000,
    );
    return () => clearInterval(interval);
  }, [canAutoFetch, refreshMinutes, fetchNow]);

  // Cancel an in-flight request when the view goes away.
  useEffect(() => () => abortRef.current?.abort(), []);

  /** Fetches now, resuming automatic fetches if they were paused by a manual load. */
  const refresh = useCallback(() => {
    setPausedScheduleId(null);
    void fetchNow();
  }, [fetchNow]);

  /** Pauses automatic fetches for the current schedule (after collections were loaded by hand). */
  const pause = useCallback(() => {
    abortRef.current?.abort();
    setPausedScheduleId(scheduleId);
  }, [scheduleId]);

  /** Changes and remembers the auto-refresh interval. */
  const changeRefreshMinutes = useCallback((minutes: RefreshMinutes) => {
    localStorage.setItem(
      STORAGE_KEYS.COLLECTIONS_REFRESH_MINUTES,
      String(minutes),
    );
    setRefreshMinutes(minutes);
  }, []);

  /** Redirects to sign in to the Collections Service. */
  const signIn = useCallback(async () => {
    try {
      navigateTo(
        await buildAuthorizationUrl("collections", collectionsScope()),
      );
    } catch (err) {
      setError(toCollectionsError(err, "invalid"));
      setStatus("error");
    }
  }, []);

  return {
    connection,
    status,
    error,
    lastCheckedAt,
    isPaused,
    refreshMinutes,
    setRefreshMinutes: changeRefreshMinutes,
    refresh,
    pause,
    signIn,
  };
}
