import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { MemoryRouter, Route, Routes, useLocation } from "react-router";
import { vi } from "vitest";

import { installTestMatchMedia } from "@phoenix/__tests__/installTestMatchMedia";

import { SettingsPage } from "../SettingsPage";

installTestMatchMedia();

let container: HTMLDivElement;
let root: Root;
let originalAuthenticationEnabled: boolean;

beforeEach(() => {
  originalAuthenticationEnabled = window.Config.authenticationEnabled;
  window.Config.authenticationEnabled = false;
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => {
    root.unmount();
  });
  container.remove();
  window.Config.authenticationEnabled = originalAuthenticationEnabled;
  vi.restoreAllMocks();
});

function CurrentSettingsRoute() {
  const { pathname } = useLocation();
  return <output>{pathname}</output>;
}

async function renderSettingsPage(initialEntry: string) {
  await act(async () => {
    root.render(
      <MemoryRouter initialEntries={[initialEntry]}>
        <Routes>
          <Route path="/settings" element={<SettingsPage />}>
            <Route path="general" element={<CurrentSettingsRoute />} />
            <Route path="users" element={<div>Users page</div>} />
            <Route path="api-keys" element={<div>API Keys page</div>} />
          </Route>
        </Routes>
      </MemoryRouter>
    );
  });
}

describe("SettingsPage access control without authentication", () => {
  it.each(["/settings/users", "/settings/api-keys"])(
    "redirects %s to general settings",
    async (initialEntry) => {
      await renderSettingsPage(initialEntry);

      expect(container.querySelector("output")?.textContent).toBe(
        "/settings/general"
      );
      expect(container.textContent).not.toContain("Users page");
      expect(container.textContent).not.toContain("API Keys page");
    }
  );

  it("does not render the Users or API Keys tabs", async () => {
    await renderSettingsPage("/settings/general");

    const tabNames = Array.from(
      container.querySelectorAll('[role="tab"]'),
      (tab) => tab.textContent
    );
    expect(tabNames).not.toContain("Users");
    expect(tabNames).not.toContain("API Keys");
  });
});
