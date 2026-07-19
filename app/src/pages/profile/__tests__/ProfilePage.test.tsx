import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { MemoryRouter, Route, Routes, useLocation } from "react-router";
import { vi } from "vitest";

import { installTestMatchMedia } from "@phoenix/__tests__/installTestMatchMedia";

import { ProfilePage } from "../ProfilePage";

const viewerState = vi.hoisted((): { viewer: object | null } => ({
  viewer: {},
}));

vi.mock("@phoenix/contexts/ViewerContext", () => ({
  useViewer: () => ({
    viewer: viewerState.viewer,
    refetchViewer: () => undefined,
  }),
}));

installTestMatchMedia();

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
  viewerState.viewer = {};
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => {
    root.unmount();
  });
  container.remove();
  vi.restoreAllMocks();
});

function CurrentProfileRoute() {
  const { pathname } = useLocation();
  return <output>{pathname}</output>;
}

async function renderProfilePage(initialEntry: string) {
  await act(async () => {
    root.render(
      <MemoryRouter initialEntries={[initialEntry]}>
        <Routes>
          <Route path="/profile" element={<ProfilePage />}>
            <Route path="account" element={<CurrentProfileRoute />} />
            <Route path="api-keys" element={<CurrentProfileRoute />} />
            <Route path="apps" element={<CurrentProfileRoute />} />
            <Route path="preferences" element={<CurrentProfileRoute />} />
            <Route path="*" element={<CurrentProfileRoute />} />
          </Route>
        </Routes>
      </MemoryRouter>
    );
  });
}

describe("ProfilePage", () => {
  it.each(["/profile", "/profile/not-a-section"])(
    "redirects %s to the account section",
    async (initialEntry) => {
      await renderProfilePage(initialEntry);

      expect(container.querySelector("output")?.textContent).toBe(
        "/profile/account"
      );
    }
  );

  it("renders a tab with an icon for every profile section", async () => {
    await renderProfilePage("/profile/account");

    const tabs = Array.from(container.querySelectorAll('[role="tab"]'));
    expect(tabs.map((tab) => tab.textContent)).toEqual([
      "Account",
      "API Keys",
      "Apps",
      "Preferences",
    ]);
    expect(tabs.every((tab) => tab.querySelector("svg"))).toBe(true);
  });

  it("shows preferences when authentication is disabled", async () => {
    viewerState.viewer = null;

    await renderProfilePage("/profile");

    expect(container.querySelector("output")?.textContent).toBe(
      "/profile/preferences"
    );
    const tabs = Array.from(container.querySelectorAll('[role="tab"]'));
    expect(tabs.map((tab) => tab.textContent)).toEqual(["Preferences"]);
  });
});
