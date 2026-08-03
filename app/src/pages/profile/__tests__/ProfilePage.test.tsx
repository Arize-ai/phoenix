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

const featureFlagState = vi.hoisted(
  (): { featureFlags: Record<string, boolean> } => ({ featureFlags: {} })
);

vi.mock("@phoenix/contexts/ViewerContext", () => ({
  useViewer: () => ({
    viewer: viewerState.viewer,
    refetchViewer: () => undefined,
  }),
}));

vi.mock("@phoenix/contexts/FeatureFlagsContext", () => ({
  useFeatureFlags: () => ({
    featureFlags: featureFlagState.featureFlags,
    setFeatureFlags: () => undefined,
  }),
}));

installTestMatchMedia();

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
  viewerState.viewer = {};
  featureFlagState.featureFlags = {};
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
    icon: "Person" | "Key" | "Link2" | "Options" | "Sparkles",
    requiresViewer = true,
    requiresFeatureFlag?: string
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
        ...(requiresFeatureFlag ? { requiresFeatureFlag } : {}),
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
        route("generative-ai", "Generative AI", "Sparkles", false, "ai-search"),
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

  it("hides a feature-flagged tab until its flag is on", async () => {
    await renderProfilePage("/profile/account");

    const tabLabels = () =>
      Array.from(container.querySelectorAll('[role="tab"]')).map(
        (tab) => tab.textContent
      );
    expect(tabLabels()).not.toContain("Generative AI");

    featureFlagState.featureFlags = { "ai-search": true };
    await renderProfilePage("/profile/account");

    expect(tabLabels()).toContain("Generative AI");
  });

  it("redirects away from a feature-flagged section while its flag is off", async () => {
    await renderProfilePage("/profile/generative-ai");

    expect(container.querySelector("output")?.textContent).toBe(
      "/profile/account"
    );
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
