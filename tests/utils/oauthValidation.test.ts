import { describe, it, expect } from "vitest";
import {
  isEnvironment,
  isHttpUrl,
  isSafeIdentifier,
  microsoftOAuthEndpoint,
  toSameOriginUrl,
} from "../../src/utils/oauthValidation";

describe("isSafeIdentifier", () => {
  it.each([
    "8f3c2a1e-4b5d-4c6e-9f7a-1b2c3d4e5f60",
    "contoso.onmicrosoft.com",
    "common",
    "tenant-123",
  ])("accepts %s", (value) => {
    expect(isSafeIdentifier(value)).toBe(true);
  });

  it.each([null, undefined, "", "../evil", "a/b", "tenant?x=1", "-leading", "trailing.", "evil.com#"])(
    "rejects %s",
    (value) => {
      expect(isSafeIdentifier(value)).toBe(false);
    },
  );
});

describe("isEnvironment", () => {
  it("accepts the supported environments only", () => {
    expect(isEnvironment("prod")).toBe(true);
    expect(isEnvironment("int")).toBe(true);
    expect(isEnvironment("stg")).toBe(true);
    expect(isEnvironment("dev")).toBe(false);
    expect(isEnvironment(null)).toBe(false);
  });
});

describe("isHttpUrl", () => {
  it("accepts http(s) and rejects other schemes", () => {
    expect(isHttpUrl(new URL("https://api.example.com"))).toBe(true);
    expect(isHttpUrl(new URL("http://localhost:5000"))).toBe(true);
    expect(isHttpUrl(new URL("javascript:alert(1)"))).toBe(false);
  });
});

describe("toSameOriginUrl", () => {
  it("resolves a relative path against this origin", () => {
    expect(toSameOriginUrl("/simulator?tab=view#top")).toBe(`${window.location.origin}/simulator?tab=view#top`);
  });

  it("keeps an absolute URL on this origin", () => {
    const url = `${window.location.origin}/return`;
    expect(toSameOriginUrl(url)).toBe(url);
  });

  it("rejects other origins, protocol-relative URLs and non-http schemes", () => {
    expect(toSameOriginUrl("https://evil.example.com/")).toBeNull();
    expect(toSameOriginUrl("//evil.example.com/")).toBeNull();
    expect(toSameOriginUrl("javascript:alert(1)")).toBeNull();
  });

  it("returns null for an empty value", () => {
    expect(toSameOriginUrl(null)).toBeNull();
    expect(toSameOriginUrl("")).toBeNull();
  });
});

describe("microsoftOAuthEndpoint", () => {
  it("builds the tenant's authorize and token endpoints", () => {
    expect(microsoftOAuthEndpoint("contoso.onmicrosoft.com", "token")).toBe(
      "https://login.microsoftonline.com/contoso.onmicrosoft.com/oauth2/v2.0/token",
    );
    expect(microsoftOAuthEndpoint("common", "authorize")).toBe(
      "https://login.microsoftonline.com/common/oauth2/v2.0/authorize",
    );
  });
});
