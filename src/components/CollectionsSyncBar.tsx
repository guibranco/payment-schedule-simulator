import { useId } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  LogIn,
  PlugZap,
  RefreshCw,
} from "lucide-react";
import {
  REFRESH_INTERVAL_OPTIONS,
  type CollectionsConnection,
  type CollectionsSyncStatus,
  type RefreshMinutes,
} from "../hooks/useCollectionsSync";
import type { CollectionsApiError } from "../utils/collectionsApi";

interface Props {
  connection: CollectionsConnection;
  status: CollectionsSyncStatus;
  error: CollectionsApiError | null;
  lastCheckedAt: number | null;
  isPaused: boolean;
  refreshMinutes: RefreshMinutes;
  onRefreshMinutesChange: (minutes: RefreshMinutes) => void;
  onRefresh: () => void;
  onSignIn: () => void;
}

const BUTTON_CLASS =
  "flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-md transition-colors";

/** "Off" or "Every N min" for an auto-refresh option. */
function intervalLabel(minutes: RefreshMinutes): string {
  return minutes === 0 ? "Off" : `Every ${minutes} min`;
}

/**
 * Shows how this schedule's collections are kept up to date: how to set up the Collections
 * Service, a sign-in prompt, or (once signed in) the last check, auto-refresh interval and
 * a Refresh now button. Manual loading (Load Collections) works in every state.
 */
export default function CollectionsSyncBar(props: Readonly<Props>) {
  if (props.connection === "unconfigured") {
    return (
      <div className="flex items-start gap-2 p-3 bg-gray-50 border border-gray-200 rounded-md text-sm text-gray-700">
        <PlugZap className="w-5 h-5 flex-shrink-0 text-gray-500" />
        <p>
          To load this schedule&apos;s collections automatically, set up the
          Collections Service in Settings (the gear icon at the top right).
          Until then, use Load Collections to paste them.
        </p>
      </div>
    );
  }

  if (props.connection !== "ready") {
    return (
      <div className="flex flex-wrap items-center justify-between gap-3 p-3 bg-amber-50 border border-amber-200 rounded-md text-sm text-amber-900">
        <span className="flex items-center gap-2">
          <AlertTriangle className="w-5 h-5 flex-shrink-0" />
          {props.connection === "expired"
            ? "Your Collections Service sign-in has expired."
            : "Sign in to the Collections Service to load collections automatically."}
        </span>
        <SignInButton onSignIn={props.onSignIn} />
      </div>
    );
  }

  return <ReadyBar {...props} />;
}

/** Starts the Collections Service sign-in. */
function SignInButton({ onSignIn }: Readonly<{ onSignIn: () => void }>) {
  return (
    <button
      type="button"
      onClick={onSignIn}
      className={`${BUTTON_CLASS} text-white bg-primary hover:bg-primary-dark`}
    >
      <LogIn className="w-4 h-4" />
      Sign in
    </button>
  );
}

/** The signed-in bar: status of the last check, the auto-refresh interval and Refresh now. */
function ReadyBar({
  status,
  error,
  lastCheckedAt,
  isPaused,
  refreshMinutes,
  onRefreshMinutesChange,
  onRefresh,
  onSignIn,
}: Readonly<Props>) {
  const intervalId = useId();
  const isLoading = status === "loading";

  return (
    <div className="p-3 bg-indigo-50 border border-indigo-200 rounded-md text-sm text-indigo-900 space-y-2">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <SyncStatusText
          status={status}
          lastCheckedAt={lastCheckedAt}
          isPaused={isPaused}
        />
        <div className="flex items-center gap-2">
          <label htmlFor={intervalId} className="text-indigo-800">
            Auto-refresh
          </label>
          <select
            id={intervalId}
            value={refreshMinutes}
            onChange={(e) =>
              onRefreshMinutesChange(Number(e.target.value) as RefreshMinutes)
            }
            className="text-sm px-2 py-1 border border-indigo-200 rounded-md bg-white"
          >
            {REFRESH_INTERVAL_OPTIONS.map((minutes) => (
              <option key={minutes} value={minutes}>
                {intervalLabel(minutes)}
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={onRefresh}
            disabled={isLoading}
            className={`${BUTTON_CLASS} text-indigo-700 bg-white border border-indigo-200 hover:bg-indigo-100 disabled:opacity-60`}
          >
            <RefreshCw
              className={`w-4 h-4 ${isLoading ? "animate-spin" : ""}`}
            />
            Refresh now
          </button>
        </div>
      </div>
      {error && status === "error" && (
        <div
          role="alert"
          className="flex flex-wrap items-center justify-between gap-2 p-2 bg-red-50 border border-red-200 rounded text-red-800"
        >
          <span>{error.message}</span>
          {error.kind === "unauthorized" && (
            <SignInButton onSignIn={onSignIn} />
          )}
        </div>
      )}
    </div>
  );
}

/** "Checking collections…", "Collections checked at 14:05:12", or why automatic checks are paused. */
function SyncStatusText({
  status,
  lastCheckedAt,
  isPaused,
}: Readonly<{
  status: CollectionsSyncStatus;
  lastCheckedAt: number | null;
  isPaused: boolean;
}>) {
  if (status === "loading") {
    return (
      <span className="flex items-center gap-2">
        <RefreshCw className="w-4 h-4 animate-spin" />
        Checking collections…
      </span>
    );
  }
  if (isPaused) {
    return (
      <span>
        Automatic checks are paused because collections were loaded by hand.
        Refresh now to resume.
      </span>
    );
  }
  const checkedAt = lastCheckedAt
    ? new Date(lastCheckedAt).toLocaleTimeString("en-GB")
    : null;
  return (
    <span className="flex items-center gap-2">
      <CheckCircle2 className="w-4 h-4" />
      {checkedAt
        ? `Collections checked at ${checkedAt}`
        : "Collections are checked automatically."}
    </span>
  );
}
