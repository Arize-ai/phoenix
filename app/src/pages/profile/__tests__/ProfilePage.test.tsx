import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { createMemoryRouter, useLocation } from "react-router";
import { RouterProvider } from "react-router/dom";
import { vi } from "vitest";

import { installTestMatchMedia } from "@phoenix/__tests__/installTestMatchMedia";
import {
  buildRouteNavigationCatalog,
  registerRouteNavigationCatalog,
} from "@phoenix/routing/routeNavigation";

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
  const route = (
    path: string,
    label: string,
    icon: "Person" | "Key" | "Link2" | "Options",
    requiresViewer = true
  ) => ({
    path,
    element: <CurrentProfileRoute />,
    handle: {
      navigation: {
        section: "Profile" as const,
        label,
        description: `${label} profile settings`,
        icon,
        requiresViewer,
      },
    },
  });
  const routes = [
    {
      path: "/profile",
      element: <ProfilePage />,
      children: [
        route("account", "Account", "Person"),
        route("api-keys", "API Keys", "Key"),
        route("apps", "Apps", "Link2"),
        route("preferences", "Preferences", "Options", false),
        { path: "*", element: <CurrentProfileRoute /> },
      ],
    },
  ];
  registerRouteNavigationCatalog({
    catalog: buildRouteNavigationCatalog(routes),
  });
  const router = createMemoryRouter(routes, { initialEntries: [initialEntry] });

  await act(async () => {
    root.render(<RouterProvider router={router} />);
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

  it.each(["/profile/api-keys/", "/Profile/API-Keys"])(
    "selects the matched tab for URL variant %s instead of redirecting",
    async (initialEntry) => {
      await renderProfilePage(initialEntry);

      const selectedTab = container.querySelector(
        '[role="tab"][aria-selected="true"]'
      );
      expect(selectedTab?.textContent).toBe("API Keys");
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
