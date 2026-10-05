import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import ConfigDialog from "../../src/components/ConfigDialog";
import { STORAGE_KEYS } from "../../src/constants";
import { navigateTo } from "../../src/utils/url";

vi.mock("../../src/utils/url", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../src/utils/url")>()),
  navigateTo: vi.fn(),
}));

/** Renders the open dialog and switches to the Collections Service tab. */
function openCollectionsTab(onClose = vi.fn()) {
  render(<ConfigDialog isOpen={true} onClose={onClose} onSave={vi.fn()} />);
  fireEvent.click(screen.getByRole("tab", { name: "Collections Service" }));
  return onClose;
}

beforeEach(() => {
  localStorage.clear();
  vi.mocked(navigateTo).mockReset();
});

describe("ConfigDialog — Collections Service tab", () => {
  it("shows the Payment Schedule Service settings first", () => {
    render(<ConfigDialog isOpen={true} onClose={vi.fn()} onSave={vi.fn()} />);
    expect(screen.getByRole("tab", { name: "Payment Schedule Service" })).toHaveAttribute("aria-selected", "true");
    expect(screen.getByLabelText("API Base URL")).toBeInTheDocument();
  });

  it("prefills the base URL from the Schedule API and the tenant from the Payment Schedule settings", () => {
    localStorage.setItem(STORAGE_KEYS.API_ENDPOINT, "https://ca-devp-ne-schedule-api.example.io/");
    localStorage.setItem(STORAGE_KEYS.TENANT_ID, "shared-tenant");
    localStorage.setItem(STORAGE_KEYS.ENVIRONMENT, "int");
    openCollectionsTab();

    expect(screen.getByLabelText("Collections API Base URL")).toHaveValue("https://ca-devp-ne-collections-api.example.io");
    expect(screen.getByLabelText("Collections Tenant ID")).toHaveValue("shared-tenant");
    expect(screen.getByLabelText("Collections Scope")).toHaveValue(
      "api://collections-api{environment-suffix}/user_impersonation",
    );
    expect(screen.getByText("api://collections-api-int/user_impersonation")).toBeInTheDocument();
  });

  it("saves the settings and signs in to the Collections Service", async () => {
    const onClose = openCollectionsTab();
    fireEvent.change(screen.getByLabelText("Collections API Base URL"), {
      target: { value: "https://collections.example.io" },
    });
    fireEvent.change(screen.getByLabelText("Collections Tenant ID"), { target: { value: "collections-tenant" } });
    fireEvent.change(screen.getByLabelText("Collections Client ID"), { target: { value: "collections-client" } });
    fireEvent.click(screen.getByRole("button", { name: "Connect" }));

    await waitFor(() => expect(navigateTo).toHaveBeenCalledTimes(1));
    expect(localStorage.getItem(STORAGE_KEYS.COLLECTIONS_API_ENDPOINT)).toBe("https://collections.example.io/");
    expect(localStorage.getItem(STORAGE_KEYS.COLLECTIONS_TENANT_ID)).toBe("collections-tenant");
    expect(localStorage.getItem(STORAGE_KEYS.COLLECTIONS_CLIENT_ID)).toBe("collections-client");
    const url = new URL(vi.mocked(navigateTo).mock.calls[0][0]);
    expect(url.pathname).toBe("/collections-tenant/oauth2/v2.0/authorize");
    expect(url.searchParams.get("scope")).toBe("api://collections-api/user_impersonation");
    expect(onClose).toHaveBeenCalledTimes(1);
    // The Payment Schedule settings are untouched
    expect(localStorage.getItem(STORAGE_KEYS.CLIENT_ID)).toBeNull();
  });

  it("explains invalid settings instead of saving them", () => {
    openCollectionsTab();
    fireEvent.change(screen.getByLabelText("Collections API Base URL"), {
      target: { value: "https://collections.example.io" },
    });
    fireEvent.change(screen.getByLabelText("Collections Tenant ID"), { target: { value: "../evil" } });
    fireEvent.change(screen.getByLabelText("Collections Client ID"), { target: { value: "client" } });
    fireEvent.click(screen.getByRole("button", { name: "Connect" }));

    expect(screen.getByRole("alert")).toHaveTextContent("Tenant and client IDs may only contain");
    expect(localStorage.getItem(STORAGE_KEYS.COLLECTIONS_TENANT_ID)).toBeNull();
    expect(navigateTo).not.toHaveBeenCalled();
  });

  it("signs out of the Collections Service, keeping its settings", () => {
    localStorage.setItem(STORAGE_KEYS.COLLECTIONS_CLIENT_ID, "collections-client");
    localStorage.setItem(STORAGE_KEYS.COLLECTIONS_ACCESS_TOKEN, "token");
    localStorage.setItem(STORAGE_KEYS.COLLECTIONS_TOKEN_EXPIRES_AT, "123");
    openCollectionsTab();

    fireEvent.click(screen.getByRole("button", { name: "Sign out" }));

    expect(localStorage.getItem(STORAGE_KEYS.COLLECTIONS_ACCESS_TOKEN)).toBeNull();
    expect(localStorage.getItem(STORAGE_KEYS.COLLECTIONS_CLIENT_ID)).toBe("collections-client");
    expect(screen.queryByRole("button", { name: "Sign out" })).not.toBeInTheDocument();
  });
});
