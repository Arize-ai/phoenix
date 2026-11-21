import { describe, expect, it } from "vitest";

import { type PageViewRouterLike, trackPageViews } from "../pageViewTracking";

type RouterState = PageViewRouterLike["state"];

function createFakeRouter(initialState: RouterState) {
  const listeners = new Set<(state: RouterState) => void>();
  const router: PageViewRouterLike = {
    state: initialState,
    subscribe: (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
  const setState = (state: RouterState) => {
    router.state = state;
    listeners.forEach((listener) => listener(state));
  };
  return { router, setState };
}

function createState({
  pathname,
  paths,
  isInitialized = true,
  navigationState = "idle",
}: {
  pathname: string;
  paths: string[];
  isInitialized?: boolean;
  navigationState?: RouterState["navigation"]["state"];
}): RouterState {
  return {
    initialized: isInitialized,
    navigation: { state: navigationState },
    location: { pathname },
    matches: paths.map((path) => ({ route: { path } })),
  };
}

describe("trackPageViews", () => {
  it("reports the initial page once the router is initialized", () => {
    const { router, setState } = createFakeRouter(
      createState({
        pathname: "/projects",
        paths: ["projects"],
        isInitialized: false,
      })
    );
    const pageViews: string[] = [];
    trackPageViews({
      router,
      onPageView: (pattern) => pageViews.push(pattern),
    });
    expect(pageViews).toEqual([]);
    setState(createState({ pathname: "/projects", paths: ["projects"] }));
    expect(pageViews).toEqual(["/projects"]);
  });

  it("reports route patterns, never parameter values", () => {
    const { router, setState } = createFakeRouter(
      createState({ pathname: "/projects", paths: ["projects"] })
    );
    const pageViews: string[] = [];
    trackPageViews({
      router,
      onPageView: (pattern) => pageViews.push(pattern),
    });
    setState(
      createState({
        pathname: "/projects/UHJvamVjdDox",
        paths: ["projects", ":projectId"],
      })
    );
    expect(pageViews).toEqual(["/projects", "/projects/:projectId"]);
  });

  it("waits for navigations to settle and ignores repeated pathnames", () => {
    const { router, setState } = createFakeRouter(
      createState({ pathname: "/projects", paths: ["projects"] })
    );
    const pageViews: string[] = [];
    trackPageViews({
      router,
      onPageView: (pattern) => pageViews.push(pattern),
    });
    setState(
      createState({
        pathname: "/projects",
        paths: ["projects"],
        navigationState: "loading",
      })
    );
    setState(createState({ pathname: "/projects", paths: ["projects"] }));
    setState(
      createState({
        pathname: "/datasets",
        paths: ["datasets"],
        navigationState: "loading",
      })
    );
    expect(pageViews).toEqual(["/projects"]);
    setState(createState({ pathname: "/datasets", paths: ["datasets"] }));
    expect(pageViews).toEqual(["/projects", "/datasets"]);
  });

  it("stops reporting once unsubscribed", () => {
    const { router, setState } = createFakeRouter(
      createState({ pathname: "/projects", paths: ["projects"] })
    );
    const pageViews: string[] = [];
    const stopTracking = trackPageViews({
      router,
      onPageView: (pattern) => pageViews.push(pattern),
    });
    stopTracking();
    setState(createState({ pathname: "/datasets", paths: ["datasets"] }));
    expect(pageViews).toEqual(["/projects"]);
  });
});
