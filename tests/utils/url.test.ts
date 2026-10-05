import { describe, it, expect, vi, afterEach } from "vitest";
import {
  getRedirectUri,
  getCurrentUrl,
  getCollectionsSwaggerUrl,
} from "../../src/utils/url";

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("getRedirectUri", () => {
  it("returns just the origin when the base path is root", () => {
    expect(getRedirectUri()).toBe(window.location.origin);
  });

  it("combines the window origin with a non-root base path", () => {
    vi.stubEnv("BASE_URL", "/payment-schedule-simulator/");

    expect(getRedirectUri()).toBe(
      `${window.location.origin}/payment-schedule-simulator`,
    );
  });
});

describe("getCurrentUrl", () => {
  it("returns the current full URL", () => {
    expect(getCurrentUrl()).toBe(window.location.href);
  });
});

describe("getCollectionsSwaggerUrl", () => {
  it("swaps the Schedule API host for the Collections API host and points at its Swagger UI", () => {
    expect(
      getCollectionsSwaggerUrl(
        "https://ca-devp-ne-schedule-api.bluerock-fead6a46.northeurope.azurecontainerapps.io/simulator?tab=view#top",
      ),
    ).toBe(
      "https://ca-devp-ne-collections-api.bluerock-fead6a46.northeurope.azurecontainerapps.io/swagger",
    );
  });

  it("returns null when the host is not a Schedule API host (e.g. running locally)", () => {
    expect(getCollectionsSwaggerUrl("http://localhost:5173/")).toBeNull();
  });

  it("returns null for an unparseable URL", () => {
    expect(getCollectionsSwaggerUrl("not a url")).toBeNull();
  });
});
