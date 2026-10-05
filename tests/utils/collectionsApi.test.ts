import { describe, it, expect, vi, afterEach } from "vitest";
import {
  CollectionsApiError,
  deriveCollectionsBaseUrl,
  fetchScheduleCollections,
} from "../../src/utils/collectionsApi";
import type { PaymentScheduleResponse, ScheduleItem } from "../../src/types";

const BASE_URL = "https://ca-devp-ne-collections-api.example.io";

function makeItem(id: string): ScheduleItem {
  return {
    id,
    collectionType: "full",
    periodStartDate: "2026-01-01",
    periodEndDate: "2026-01-31",
    adjustmentDate: null,
    dueDate: "2026-01-01",
    amountDue: 10,
    netAmount: 10,
    taxesAndLevies: {},
    adminFees: {},
    succeeded: null,
  };
}

function makeSchedule(overrides: Partial<PaymentScheduleResponse> = {}): PaymentScheduleResponse {
  return {
    id: "schedule-1",
    token: "",
    hash: "",
    collectionFrequency: "monthly",
    collectionDay: 1,
    inceptionDate: "2026-01-01",
    coverStartDate: "2026-01-01",
    coverEndDate: "2026-12-31",
    scheduleItems: [makeItem("item-1"), makeItem("item-2")],
    ...overrides,
  };
}

function transaction(ids: string[], overrides: Record<string, unknown> = {}) {
  return { paymentScheduleItemIds: ids, collectionStatus: "collected", amountDue: 10, ...overrides };
}

function jsonResponse(body: unknown, status = 200) {
  return { ok: status >= 200 && status < 300, status, json: async () => body } as Response;
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("deriveCollectionsBaseUrl", () => {
  it("swaps -schedule for -collections and keeps only the origin", () => {
    expect(deriveCollectionsBaseUrl("https://ca-devp-ne-schedule-api.example.io/simulator?x=1")).toBe(
      "https://ca-devp-ne-collections-api.example.io",
    );
  });

  it("returns null when the host doesn't follow the naming, or the URL is missing/invalid", () => {
    expect(deriveCollectionsBaseUrl("http://localhost:5173/")).toBeNull();
    expect(deriveCollectionsBaseUrl(null)).toBeNull();
    expect(deriveCollectionsBaseUrl("not a url")).toBeNull();
  });
});

describe("fetchScheduleCollections", () => {
  it("fetches the policy/risk history in one call and keeps only this schedule's transactions", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      jsonResponse([transaction(["item-1"]), transaction(["other-version-item"]), transaction(["item-2", "x"])]),
    );
    vi.stubGlobal("fetch", fetchMock);

    const result = await fetchScheduleCollections({
      baseUrl: BASE_URL,
      token: "tok",
      schedule: makeSchedule({ policyNumber: "OUT 001", riskId: 2 }),
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe(`${BASE_URL}/api/v1/collections/OUT%20001/2`);
    expect(init.headers.Authorization).toBe("Bearer tok");
    expect(result.map((t) => t.paymentScheduleItemIds[0])).toEqual(["item-1", "item-2"]);
  });

  it("falls back to one lookup per item without a policy number, de-duplicating shared transactions", async () => {
    const shared = transaction(["item-1", "item-2"], { transactionReference: "REF-1" });
    const fetchMock = vi.fn((url: string) =>
      Promise.resolve(url.endsWith("/item-1") || url.endsWith("/item-2") ? jsonResponse(shared) : jsonResponse(null, 404)),
    );
    vi.stubGlobal("fetch", fetchMock);

    const result = await fetchScheduleCollections({ baseUrl: `${BASE_URL}/`, token: "tok", schedule: makeSchedule() });

    expect(fetchMock.mock.calls.map(([url]) => url)).toEqual([
      `${BASE_URL}/api/v1/collection/item-1`,
      `${BASE_URL}/api/v1/collection/item-2`,
    ]);
    expect(result).toHaveLength(1);
  });

  it("treats 404 and 204 as no transactions", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse(null, 204)));
    await expect(
      fetchScheduleCollections({ baseUrl: BASE_URL, token: "tok", schedule: makeSchedule() }),
    ).resolves.toEqual([]);
  });

  it("drops entries that aren't linked to any schedule item", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(jsonResponse([transaction(["item-1"]), { ...transaction([]), paymentScheduleItemIds: null }])),
    );
    const result = await fetchScheduleCollections({
      baseUrl: BASE_URL,
      token: "tok",
      schedule: makeSchedule({ policyNumber: "OUT001", riskId: 1 }),
    });
    expect(result).toHaveLength(1);
  });

  it.each([
    [401, "unauthorized"],
    [403, "forbidden"],
    [500, "http"],
  ])("classifies a %i response as %s", async (status, kind) => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse({}, status)));
    const error = await fetchScheduleCollections({
      baseUrl: BASE_URL,
      token: "tok",
      schedule: makeSchedule({ policyNumber: "OUT001", riskId: 1 }),
    }).catch((err: unknown) => err);
    expect(error).toBeInstanceOf(CollectionsApiError);
    expect((error as CollectionsApiError).kind).toBe(kind);
  });

  it("reports a request that never got a response (offline or blocked by CORS) as a network error", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("Failed to fetch")));
    const error = await fetchScheduleCollections({ baseUrl: BASE_URL, token: "tok", schedule: makeSchedule() }).catch(
      (err: unknown) => err,
    );
    expect((error as CollectionsApiError).kind).toBe("network");
    expect((error as CollectionsApiError).message).toContain("CORS");
  });

  it("rejects a base URL that isn't http(s)", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    await expect(
      fetchScheduleCollections({ baseUrl: "javascript:alert(1)", token: "tok", schedule: makeSchedule() }),
    ).rejects.toMatchObject({ kind: "invalid" });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("reports malformed transactions as invalid data", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse([{ paymentScheduleItemIds: ["item-1"], amountDue: 1 }])));
    await expect(
      fetchScheduleCollections({ baseUrl: BASE_URL, token: "tok", schedule: makeSchedule({ policyNumber: "P", riskId: 1 }) }),
    ).rejects.toMatchObject({ kind: "invalid" });
  });
});
