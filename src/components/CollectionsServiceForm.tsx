import React, { useId, useState } from "react";
import { DEFAULT_COLLECTIONS_SCOPE, STORAGE_KEYS } from "../constants";
import { collectionsBaseUrl } from "../hooks/useCollectionsSync";
import {
  buildAuthorizationUrl,
  resolveScope,
  savedEnvironment,
} from "../utils/oauthFlow";
import { isHttpUrl, isSafeIdentifier } from "../utils/oauthValidation";
import { getRedirectUri, navigateTo } from "../utils/url";

/** One or more space-separated scopes made of URI-safe characters, allowing the `{environment-suffix}` placeholder. */
const SCOPE_PATTERN = /^[\w:/.{}-]+(?: [\w:/.{}-]+)*$/;

const INPUT_CLASS =
  "mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-primary focus:ring-primary";

interface Props {
  onCancel: () => void;
  onClose: () => void;
}

/** The saved Collections Service settings, with sensible defaults for a first set-up. */
function readSavedCollectionsConfig() {
  return {
    baseUrl: collectionsBaseUrl() ?? "",
    tenantId:
      localStorage.getItem(STORAGE_KEYS.COLLECTIONS_TENANT_ID) ||
      localStorage.getItem(STORAGE_KEYS.TENANT_ID) ||
      "",
    clientId: localStorage.getItem(STORAGE_KEYS.COLLECTIONS_CLIENT_ID) || "",
    scope:
      localStorage.getItem(STORAGE_KEYS.COLLECTIONS_SCOPE) ||
      DEFAULT_COLLECTIONS_SCOPE,
    isSignedIn: Boolean(
      localStorage.getItem(STORAGE_KEYS.COLLECTIONS_ACCESS_TOKEN),
    ),
  };
}

/** Why the Collections settings can't be saved, or null when they're valid. */
function validationError(
  baseUrl: string,
  tenantId: string,
  clientId: string,
  scope: string,
): string | null {
  let url: URL;
  try {
    url = new URL(baseUrl);
  } catch {
    return "Enter a valid Collections API base URL.";
  }
  if (!isHttpUrl(url))
    return "The Collections API base URL must use http or https.";
  if (!isSafeIdentifier(tenantId) || !isSafeIdentifier(clientId)) {
    return "Tenant and client IDs may only contain letters, digits, dots and hyphens.";
  }
  if (!SCOPE_PATTERN.test(scope))
    return "Enter the scope as space-separated values, e.g. api://collections-api/user_impersonation.";
  return null;
}

/**
 * The Collections Service settings: its API base URL and its own app registration (tenant,
 * client and scope). Connecting saves them and signs in, so View Schedule can load each
 * schedule's collections automatically.
 */
export default function CollectionsServiceForm({
  onCancel,
  onClose,
}: Readonly<Props>) {
  const [saved] = useState(readSavedCollectionsConfig);
  const [baseUrl, setBaseUrl] = useState(saved.baseUrl);
  const [tenantId, setTenantId] = useState(saved.tenantId);
  const [clientId, setClientId] = useState(saved.clientId);
  const [scope, setScope] = useState(saved.scope);
  const [isSignedIn, setIsSignedIn] = useState(saved.isSignedIn);
  const [error, setError] = useState<string | null>(null);
  const idPrefix = useId();
  const environment = savedEnvironment();

  /** Saves the settings and redirects to sign in to the Collections Service. */
  const handleSubmit = async (e: React.SubmitEvent<HTMLFormElement>) => {
    e.preventDefault();
    const problem = validationError(baseUrl, tenantId, clientId, scope);
    if (problem) {
      setError(problem);
      return;
    }

    localStorage.setItem(
      STORAGE_KEYS.COLLECTIONS_API_ENDPOINT,
      new URL(baseUrl).toString(),
    );
    localStorage.setItem(STORAGE_KEYS.COLLECTIONS_TENANT_ID, tenantId);
    localStorage.setItem(STORAGE_KEYS.COLLECTIONS_CLIENT_ID, clientId);
    localStorage.setItem(STORAGE_KEYS.COLLECTIONS_SCOPE, scope);

    try {
      navigateTo(
        await buildAuthorizationUrl(
          "collections",
          resolveScope(scope, environment),
        ),
      );
      onClose();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Could not start the sign-in.",
      );
    }
  };

  /** Forgets the Collections Service token, keeping the settings. */
  const handleSignOut = () => {
    localStorage.removeItem(STORAGE_KEYS.COLLECTIONS_ACCESS_TOKEN);
    localStorage.removeItem(STORAGE_KEYS.COLLECTIONS_TOKEN_EXPIRES_AT);
    setIsSignedIn(false);
  };

  /** The id of a field, unique to this form. */
  const fieldId = (name: string) => `${idPrefix}-${name}`;

  return (
    <form onSubmit={handleSubmit} className="p-4">
      <div className="space-y-4">
        <p className="text-sm text-gray-600">
          Used by View Schedule to load each schedule&apos;s collections
          automatically. The Collections Service has its own app registration,
          so it has its own sign-in.
        </p>
        <div>
          <label
            htmlFor={fieldId("baseUrl")}
            className="block text-sm font-medium text-gray-700"
          >
            Collections API Base URL
          </label>
          <input
            type="url"
            id={fieldId("baseUrl")}
            value={baseUrl}
            onChange={(e) => setBaseUrl(e.target.value)}
            placeholder="https://ca-devp-ne-collections-api.example.io"
            className={INPUT_CLASS}
            required
          />
          <p className="mt-1 text-xs text-gray-500">
            Defaults to the Payment Schedule API host with &quot;-schedule&quot;
            replaced by &quot;-collections&quot;.
          </p>
        </div>
        <div>
          <label
            htmlFor={fieldId("tenantId")}
            className="block text-sm font-medium text-gray-700"
          >
            Collections Tenant ID
          </label>
          <input
            type="text"
            id={fieldId("tenantId")}
            value={tenantId}
            onChange={(e) => setTenantId(e.target.value)}
            placeholder="Enter the Collections app's tenant ID"
            className={INPUT_CLASS}
            required
          />
        </div>
        <div>
          <label
            htmlFor={fieldId("clientId")}
            className="block text-sm font-medium text-gray-700"
          >
            Collections Client ID
          </label>
          <input
            type="text"
            id={fieldId("clientId")}
            value={clientId}
            onChange={(e) => setClientId(e.target.value)}
            placeholder="Enter the Collections app's client ID"
            className={INPUT_CLASS}
            required
          />
        </div>
        <div>
          <label
            htmlFor={fieldId("scope")}
            className="block text-sm font-medium text-gray-700"
          >
            Collections Scope
          </label>
          <input
            type="text"
            id={fieldId("scope")}
            value={scope}
            onChange={(e) => setScope(e.target.value)}
            className={`${INPUT_CLASS} font-mono text-xs`}
            required
          />
          <p className="mt-1 text-xs text-gray-500 break-all">
            Requested as <code>{resolveScope(scope, environment)}</code> for the{" "}
            {environment} environment (set on the Payment Schedule Service tab).
          </p>
        </div>
        <div>
          <span className="block text-sm font-medium text-gray-700">
            Redirect URI
          </span>
          <div className="mt-1 p-2 bg-gray-50 rounded text-sm text-gray-600 break-all">
            {getRedirectUri()}
          </div>
          <p className="mt-1 text-xs text-gray-500">
            Add this URL to the Collections app registration.
          </p>
        </div>
        {error && (
          <p
            role="alert"
            className="p-2 bg-red-50 border border-red-200 rounded text-sm text-red-700"
          >
            {error}
          </p>
        )}
        <div className="flex justify-between gap-3">
          <div>
            {isSignedIn && (
              <button
                type="button"
                onClick={handleSignOut}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
              >
                Sign out
              </button>
            )}
          </div>
          <div className="flex gap-3">
            <button
              type="button"
              onClick={onCancel}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 text-sm font-medium text-white bg-primary rounded-md hover:bg-primary-dark"
            >
              Connect
            </button>
          </div>
        </div>
      </div>
    </form>
  );
}
