import { posthog } from "posthog-js/dist/module.slim.no-external";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { PageViewRouterLike } from "../pageViewTracking";
import { startPostHogAnalytics } from "../posthog";

const router: PageViewRouterLike = {
  state: {
    initialized: true,
    navigation: { state: "idle" },
    location: { pathname: "/projects/UHJvamVjdDox" },
    matches: [
      { route: { path: "projects" } },
      { route: { path: ":projectId" } },
    ],
  },
  subscribe: () => () => {},
};

describe("startPostHogAnalytics", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("does not load the SDK when PostHog is not configured", async () => {
    const initSpy = vi.spyOn(posthog, "init");
    await startPostHogAnalytics({
      router,
      config: null,
      phoenixVersion: "1.0.0",
    });
    expect(initSpy).not.toHaveBeenCalled();
  });

  it("sends an anonymous page view keyed by route pattern", async () => {
    const fetchSpy = vi
      .spyOn(window, "fetch")
      .mockResolvedValue(new Response("{}", { status: 200 }));
    const beforeSendResults: unknown[] = [];
    const originalInit = posthog.init.bind(posthog);
    vi.spyOn(posthog, "init").mockImplementation((token, config) => {
      const beforeSend = config?.before_send;
      return originalInit(token, {
        ...config,
        before_send: (event) => {
          const result =
            typeof beforeSend === "function" ? beforeSend(event) : event;
          beforeSendResults.push(result);
          return null;
        },
      });
    });

    await startPostHogAnalytics({
      router,
      config: { apiKey: "phc_test", apiHost: "https://posthog.example" },
      phoenixVersion: "21.2.0",
    });

    expect(beforeSendResults).toHaveLength(1);
    const properties = (
      beforeSendResults[0] as { properties: Record<string, unknown> }
    ).properties;
    expect(properties).toMatchObject({
      route: "/projects/:projectId",
      phoenix_version: "21.2.0",
      $current_url: "/projects/:projectId",
      $pathname: "/projects/:projectId",
      $process_person_profile: false,
    });
    expect(JSON.stringify(properties)).not.toContain("UHJvamVjdDox");
    expect(properties).not.toHaveProperty("$host");
    expect(properties).not.toHaveProperty("$session_entry_url");
    expect(properties).not.toHaveProperty("title");
    expect(window.localStorage.length).toBe(0);
    expect(document.cookie).toBe("");
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});
