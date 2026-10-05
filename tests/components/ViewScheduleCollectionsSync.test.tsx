import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  render,
  screen,
  fireEvent,
  waitFor,
  act,
  within,
} from "@testing-library/react";
import ViewSchedule from "../../src/components/ViewSchedule";
import { SAMPLE_SCHEDULES } from "../../src/constants/sampleSchedules";
import { STORAGE_KEYS } from "../../src/constants";
import { navigateTo } from "../../src/utils/url";
import { must } from "../helpers";

vi.mock("../../src/utils/url", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../src/utils/url")>()),
  navigateTo: vi.fn(),
}));

const COLLECTIONS_BASE_URL = "https://ca-devp-ne-collections-api.example.io";
const policyAdminJson = JSON.stringify(
  must(SAMPLE_SCHEDULES.find((s) => s.format === "policyAdmin")).json,
);
const FIRST_ITEM_ID = "b056db41-31ad-4618-beb4-db7a5f304269";

/** Pastes JSON and submits it, as a user would. */
function submitJson(json: string) {
  fireEvent.change(screen.getByPlaceholderText(/{/), {
    target: { value: json },
  });
  fireEvent.click(screen.getByRole("button", { name: "View Schedule" }));
}

/** Saves a Collections Service configuration, optionally with a valid token. */
function configureCollections({ signedIn }: { signedIn: boolean }) {
  localStorage.setItem(
    STORAGE_KEYS.COLLECTIONS_API_ENDPOINT,
    COLLECTIONS_BASE_URL,
  );
  localStorage.setItem(
    STORAGE_KEYS.COLLECTIONS_TENANT_ID,
    "collections-tenant",
  );
  localStorage.setItem(
    STORAGE_KEYS.COLLECTIONS_CLIENT_ID,
    "collections-client",
  );
  if (signedIn) {
    localStorage.setItem(
      STORAGE_KEYS.COLLECTIONS_ACCESS_TOKEN,
      "collections-token",
    );
    localStorage.setItem(
      STORAGE_KEYS.COLLECTIONS_TOKEN_EXPIRES_AT,
      String(Date.now() + 60 * 60 * 1000),
    );
  }
}

/** A fetch mock answering with one collected transaction for the sample's first item. */
function mockCollectionsFetch(status = 200) {
  const fetchMock = vi.fn().mockResolvedValue({
    ok: status === 200,
    status,
    json: async () => [
      {
        paymentScheduleItemIds: [FIRST_ITEM_ID],
        collectionStatus: "collected",
        amountDue: 82.12,
      },
    ],
  });
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

beforeEach(() => {
  localStorage.clear();
  sessionStorage.clear();
  vi.mocked(navigateTo).mockReset();
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe("ViewSchedule — Collections integration", () => {
  it("explains how to set up automatic collections when the Collections Service isn't configured", () => {
    render(<ViewSchedule apiEndpoint="" />);
    submitJson(policyAdminJson);

    expect(
      screen.getByText(/set up the\s+Collections Service in Settings/),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /Load Collections/ }),
    ).toBeInTheDocument();
  });

  it("offers to sign in when configured but signed out, keeping the schedule across the redirect", async () => {
    configureCollections({ signedIn: false });
    render(<ViewSchedule apiEndpoint="" />);
    submitJson(policyAdminJson);

    expect(
      screen.getByText(
        "Sign in to the Collections Service to load collections automatically.",
      ),
    ).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Sign in" }));

    await waitFor(() => expect(navigateTo).toHaveBeenCalledTimes(1));
    const url = new URL(vi.mocked(navigateTo).mock.calls[0][0]);
    expect(url.searchParams.get("client_id")).toBe("collections-client");
    expect(url.searchParams.get("state")).toMatch(/^collections:/);
    expect(sessionStorage.getItem("pendingViewScheduleJson")).toBe(
      policyAdminJson,
    );
  });

  it("restores the schedule saved before a sign-in redirect", () => {
    sessionStorage.setItem("pendingViewScheduleJson", policyAdminJson);
    render(<ViewSchedule apiEndpoint="" />);

    expect(
      screen.getByText(/Detected format: Policy Admin CosmosDB Document/),
    ).toBeInTheDocument();
    expect(sessionStorage.getItem("pendingViewScheduleJson")).toBeNull();
  });

  it("loads the schedule's collections automatically once signed in", async () => {
    configureCollections({ signedIn: true });
    const fetchMock = mockCollectionsFetch();
    render(<ViewSchedule apiEndpoint="" />);
    submitJson(policyAdminJson);

    await waitFor(() =>
      expect(screen.getByText(/Collections checked at/)).toBeInTheDocument(),
    );
    expect(fetchMock).toHaveBeenCalledWith(
      `${COLLECTIONS_BASE_URL}/api/v1/collections/POL0000001/1`,
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: "Bearer collections-token",
        }),
      }),
    );
    expect(
      screen.getByText(/Collections reconciliation: 1 collected/),
    ).toBeInTheDocument();
  });

  it("checks again on the chosen interval and on Refresh now, remembering the interval", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    configureCollections({ signedIn: true });
    const fetchMock = mockCollectionsFetch();
    render(<ViewSchedule apiEndpoint="" />);
    submitJson(policyAdminJson);
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));

    fireEvent.change(screen.getByLabelText("Auto-refresh"), {
      target: { value: "1" },
    });
    expect(localStorage.getItem(STORAGE_KEYS.COLLECTIONS_REFRESH_MINUTES)).toBe(
      "1",
    );

    await act(async () => {
      await vi.advanceTimersByTimeAsync(60 * 1000);
    });
    expect(fetchMock).toHaveBeenCalledTimes(2);

    fireEvent.click(screen.getByRole("button", { name: "Refresh now" }));
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(3));
  });

  it("shows a rejected sign-in with a way to sign in again", async () => {
    configureCollections({ signedIn: true });
    mockCollectionsFetch(401);
    render(<ViewSchedule apiEndpoint="" />);
    submitJson(policyAdminJson);

    const alert = await screen.findByText(
      /sign-in has expired or was rejected/,
    );
    expect(
      within(must(alert.closest("[role=alert]")) as HTMLElement).getByRole(
        "button",
        { name: "Sign in" },
      ),
    ).toBeInTheDocument();
  });

  it("pauses automatic checks after collections are loaded by hand", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    configureCollections({ signedIn: true });
    const fetchMock = mockCollectionsFetch();
    render(<ViewSchedule apiEndpoint="" />);
    submitJson(policyAdminJson);
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));

    fireEvent.click(screen.getByRole("button", { name: /Reload Collections/ }));
    fireEvent.change(
      screen.getByPlaceholderText(
        "Paste the Collections Service JSON array here...",
      ),
      {
        target: {
          value: JSON.stringify([
            {
              paymentScheduleItemIds: [FIRST_ITEM_ID],
              collectionStatus: "rejected",
              amountDue: 82.12,
            },
          ]),
        },
      },
    );
    fireEvent.click(screen.getByRole("button", { name: "Reconcile" }));

    expect(screen.getByText(/Automatic checks are paused/)).toBeInTheDocument();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(5 * 60 * 1000);
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(
      screen.getByText(/Collections reconciliation: 0 collected, 1 rejected/),
    ).toBeInTheDocument();
  });
});
