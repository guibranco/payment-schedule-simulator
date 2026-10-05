import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { STORAGE_KEYS } from "../../src/constants";
import {
  buildAuthorizationUrl,
  collectionsScope,
  exchangeCodeForToken,
  resolveScope,
  serviceFromState,
} from "../../src/utils/oauthFlow";

beforeEach(() => {
  localStorage.clear();
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("serviceFromState", () => {
  it("recognises Collections sign-ins and treats everything else as the Payment Schedule Service", () => {
    expect(serviceFromState("collections:abc")).toBe("collections");
    expect(serviceFromState("abc")).toBe("schedule");
    expect(serviceFromState("xyz")).toBe("schedule");
  });
});

describe("resolveScope / collectionsScope", () => {
  it("fills the environment suffix, leaving it empty in prod", () => {
    expect(
      resolveScope(
        "api://collections-api{environment-suffix}/user_impersonation",
        "int",
      ),
    ).toBe("api://collections-api-int/user_impersonation");
    expect(
      resolveScope(
        "api://collections-api{environment-suffix}/user_impersonation",
        "prod",
      ),
    ).toBe("api://collections-api/user_impersonation");
  });

  it("uses the saved template and environment, defaulting the template", () => {
    localStorage.setItem(STORAGE_KEYS.ENVIRONMENT, "stg");
    expect(collectionsScope()).toBe(
      "api://collections-api-stg/user_impersonation",
    );
    localStorage.setItem(
      STORAGE_KEYS.COLLECTIONS_SCOPE,
      "api://custom{environment-suffix}/.default",
    );
    expect(collectionsScope()).toBe("api://custom-stg/.default");
  });
});

describe("buildAuthorizationUrl", () => {
  it("uses the Collections app registration and tags the state for the callback", async () => {
    localStorage.setItem(
      STORAGE_KEYS.COLLECTIONS_TENANT_ID,
      "collections-tenant",
    );
    localStorage.setItem(
      STORAGE_KEYS.COLLECTIONS_CLIENT_ID,
      "collections-client",
    );
    localStorage.setItem(STORAGE_KEYS.TENANT_ID, "schedule-tenant");

    const url = new URL(
      await buildAuthorizationUrl(
        "collections",
        "api://collections-api/user_impersonation",
      ),
    );

    expect(url.origin + url.pathname).toBe(
      "https://login.microsoftonline.com/collections-tenant/oauth2/v2.0/authorize",
    );
    expect(url.searchParams.get("client_id")).toBe("collections-client");
    expect(url.searchParams.get("scope")).toBe(
      "api://collections-api/user_impersonation",
    );
    expect(url.searchParams.get("state")).toMatch(/^collections:/);
    expect(url.searchParams.get("prompt")).toBeNull();
    expect(localStorage.getItem(STORAGE_KEYS.CODE_VERIFIER)).toBeTruthy();
    expect(localStorage.getItem(STORAGE_KEYS.RETURN_URL)).toBe(
      window.location.pathname + window.location.search,
    );
  });

  it("asks for a silent sign-in when requested, with an untagged state for the Payment Schedule Service", async () => {
    localStorage.setItem(STORAGE_KEYS.TENANT_ID, "schedule-tenant");
    localStorage.setItem(STORAGE_KEYS.CLIENT_ID, "schedule-client");

    const url = new URL(
      await buildAuthorizationUrl(
        "schedule",
        "api://schedule-api/user_impersonation",
        { silent: true },
      ),
    );

    expect(url.searchParams.get("prompt")).toBe("none");
    expect(url.searchParams.get("state")).not.toMatch(/^collections:/);
  });

  it("refuses to start without a valid configuration", async () => {
    await expect(buildAuthorizationUrl("collections", "scope")).rejects.toThrow(
      "OAuth configuration missing",
    );
    localStorage.setItem(STORAGE_KEYS.COLLECTIONS_TENANT_ID, "../evil");
    localStorage.setItem(STORAGE_KEYS.COLLECTIONS_CLIENT_ID, "client");
    await expect(buildAuthorizationUrl("collections", "scope")).rejects.toThrow(
      "OAuth configuration is invalid",
    );
  });
});

describe("exchangeCodeForToken", () => {
  it("stores a Collections token under the Collections keys and announces it", async () => {
    localStorage.setItem(
      STORAGE_KEYS.COLLECTIONS_TENANT_ID,
      "collections-tenant",
    );
    localStorage.setItem(
      STORAGE_KEYS.COLLECTIONS_CLIENT_ID,
      "collections-client",
    );
    localStorage.setItem(STORAGE_KEYS.ACCESS_TOKEN, "schedule-token");
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        access_token: "collections-token",
        expires_in: 3600,
      }),
    });
    vi.stubGlobal("fetch", fetchMock);
    const storageEvents: Array<string | null> = [];
    const listener = (e: StorageEvent) => storageEvents.push(e.key);
    window.addEventListener("storage", listener);

    await exchangeCodeForToken("code", "collections:abc", "verifier");
    window.removeEventListener("storage", listener);

    expect(fetchMock.mock.calls[0][0]).toBe(
      "https://login.microsoftonline.com/collections-tenant/oauth2/v2.0/token",
    );
    expect(
      (fetchMock.mock.calls[0][1].body as URLSearchParams).get("client_id"),
    ).toBe("collections-client");
    expect(localStorage.getItem(STORAGE_KEYS.COLLECTIONS_ACCESS_TOKEN)).toBe(
      "collections-token",
    );
    expect(
      localStorage.getItem(STORAGE_KEYS.COLLECTIONS_TOKEN_EXPIRES_AT),
    ).toBeTruthy();
    expect(localStorage.getItem(STORAGE_KEYS.ACCESS_TOKEN)).toBe(
      "schedule-token",
    );
    expect(storageEvents).toContain(STORAGE_KEYS.COLLECTIONS_ACCESS_TOKEN);
  });
});
