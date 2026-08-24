import { registerRouteInfoCatalog } from "@phoenix/agent/tools/getRouteInfo/routeCatalogRegistry";
import { createAgentStore } from "@phoenix/store/agentStore";

import { createNavigationGoToClientAction } from "../clientActions";
import {
  buildNavigationSettledElsewhereError,
  NAVIGATION_BLOCKED_ERROR,
  NAVIGATION_DECLINED_ERROR,
} from "../constants";
import {
  createDataRouterNavigationStateSource,
  registerRouterNavigationStateSource,
} from "../routerStateRegistry";
import type { RouterNavigationStateSource } from "../routerStateRegistry";

const CALL_CONTEXT = { callId: "tool-call-1:0", sessionId: "session-1" };

/**
 * A hand-cranked router state source: tests drive it through the same
 * loading → idle transitions the data router emits.
 */
function createFakeRouterSource(initialPathname: string) {
  let pathname = initialPathname;
  let status: "idle" | "loading" | "submitting" = "idle";
  const listeners = new Set<() => void>();
  const notify = () => {
    for (const listener of [...listeners]) {
      listener();
    }
  };
  const source: RouterNavigationStateSource = {
    getPathname: () => pathname,
    getNavigationStatus: () => status,
    subscribe: (onStateChange) => {
      listeners.add(onStateChange);
      return () => {
        listeners.delete(onStateChange);
      };
    },
  };
  return {
    source,
    startNavigation() {
      status = "loading";
      notify();
    },
    settleAt(settledPathname: string) {
      status = "idle";
      pathname = settledPathname;
      notify();
    },
  };
}

function setup({
  currentPath = "/projects",
  navigateChangesPath = true,
  routerSource = null,
}: {
  currentPath?: string;
  navigateChangesPath?: boolean;
  routerSource?: RouterNavigationStateSource | null;
} = {}) {
  registerRouteInfoCatalog({
    catalog: [
      {
        path: "/playground",
        metadata: { label: "Playground", description: "Prompt playground" },
        routeIndex: 0,
      },
      {
        path: "/datasets/:datasetId",
        metadata: { label: "Dataset", description: "One dataset" },
        routeIndex: 1,
      },
    ],
  });
  registerRouterNavigationStateSource({ source: routerSource });
  const store = createAgentStore();
  let path = currentPath;
  const navigate = vi.fn((to: string) => {
    if (navigateChangesPath) {
      path = to;
    }
  });
  const handler = createNavigationGoToClientAction({
    agentStore: store,
    navigate,
    getCurrentPath: () => path,
  });
  return { store, navigate, handler };
}

function getPending(store: ReturnType<typeof createAgentStore>) {
  return store.getState().pendingNavigationsByToolCallId[CALL_CONTEXT.callId];
}

afterEach(() => {
  registerRouterNavigationStateSource({ source: null });
});

describe("navigation.goTo client action", () => {
  it("rejects a path outside the route catalog without staging", async () => {
    const { store, handler } = setup();
    const result = await handler(
      { path: "/nonsense", reason: "to test" },
      CALL_CONTEXT
    );
    expect(result).toMatchObject({ ok: false });
    expect((result as { error: string }).error).toContain("get_route_info");
    expect(getPending(store)).toBeUndefined();
  });

  it("matches parameterized catalog routes", async () => {
    const { store, handler } = setup();
    void handler(
      { path: "/datasets/RGF0YXNldDox", reason: "to open the dataset" },
      CALL_CONTEXT
    );
    await Promise.resolve();
    expect(getPending(store)).toMatchObject({
      path: "/datasets/RGF0YXNldDox",
      label: "Dataset",
    });
  });

  it("resolves already_there without staging when the user is on the path", async () => {
    const { store, handler } = setup({ currentPath: "/playground" });
    const result = await handler(
      { path: "/playground", reason: "to edit the prompt" },
      CALL_CONTEXT
    );
    expect(result).toMatchObject({
      ok: true,
      output: { status: "already_there", path: "/playground" },
    });
    expect(getPending(store)).toBeUndefined();
  });

  it("navigates and resolves after the user accepts", async () => {
    const { store, navigate, handler } = setup();
    const resultPromise = handler(
      { path: "/playground", reason: "to stage the prompt edit" },
      CALL_CONTEXT
    );
    await Promise.resolve();
    const pending = getPending(store);
    expect(pending).toMatchObject({
      path: "/playground",
      label: "Playground",
      reason: "to stage the prompt edit",
    });

    await pending?.accept?.();
    expect(navigate).toHaveBeenCalledWith("/playground");
    await expect(resultPromise).resolves.toMatchObject({
      ok: true,
      output: { status: "navigated", path: "/playground" },
    });
    expect(getPending(store)).toBeUndefined();
  });

  it("resolves a blocked navigation as an error", async () => {
    const { store, handler } = setup({ navigateChangesPath: false });
    const resultPromise = handler(
      { path: "/playground", reason: "to stage the prompt edit" },
      CALL_CONTEXT
    );
    await Promise.resolve();
    await getPending(store)?.accept?.();
    await expect(resultPromise).resolves.toEqual({
      ok: false,
      error: NAVIGATION_BLOCKED_ERROR,
    });
  });

  it("resolves a declined navigation with the do-not-retry error", async () => {
    const { store, handler } = setup();
    const resultPromise = handler(
      { path: "/playground", reason: "to stage the prompt edit" },
      CALL_CONTEXT
    );
    await Promise.resolve();
    await getPending(store)?.reject?.();
    await expect(resultPromise).resolves.toEqual({
      ok: false,
      error: NAVIGATION_DECLINED_ERROR,
    });
    expect(getPending(store)).toBeUndefined();
  });

  it("never auto-accepts, even in bypass edit mode", async () => {
    const { store, navigate, handler } = setup();
    store.getState().setPermissions({ edits: "bypass" });
    void handler(
      { path: "/playground", reason: "to stage the prompt edit" },
      CALL_CONTEXT
    );
    await Promise.resolve();
    expect(getPending(store)).toBeDefined();
    expect(navigate).not.toHaveBeenCalled();
  });
});

describe("navigation.goTo settle detection via the router state source", () => {
  it("waits out a slow-settling navigation instead of reporting it blocked", async () => {
    const fakeRouter = createFakeRouterSource("/projects");
    const { store, handler } = setup({
      routerSource: fakeRouter.source,
      // The rendered pathname never moves — mimics a destination page
      // suspending inside the navigation transition.
      navigateChangesPath: false,
    });
    const resultPromise = handler(
      { path: "/playground", reason: "to stage the prompt edit" },
      CALL_CONTEXT
    );
    await Promise.resolve();
    const acceptPromise = getPending(store)?.accept?.();

    fakeRouter.startNavigation();
    // Let well past the old 10-frame poll budget elapse before settling.
    await new Promise((resolve) => setTimeout(resolve, 50));
    fakeRouter.settleAt("/playground");

    await acceptPromise;
    await expect(resultPromise).resolves.toMatchObject({
      ok: true,
      output: { status: "navigated", path: "/playground" },
    });
  });

  it("reports where the router settled when it lands elsewhere", async () => {
    const fakeRouter = createFakeRouterSource("/projects");
    const { store, handler } = setup({
      routerSource: fakeRouter.source,
      navigateChangesPath: false,
    });
    const resultPromise = handler(
      { path: "/playground", reason: "to stage the prompt edit" },
      CALL_CONTEXT
    );
    await Promise.resolve();
    const acceptPromise = getPending(store)?.accept?.();

    fakeRouter.startNavigation();
    fakeRouter.settleAt("/projects");

    await acceptPromise;
    await expect(resultPromise).resolves.toEqual({
      ok: false,
      error: buildNavigationSettledElsewhereError({
        requestedPath: "/playground",
        settledPath: "/projects",
      }),
    });
  });

  it("reports blocked when the router never settles", async () => {
    vi.useFakeTimers();
    try {
      const fakeRouter = createFakeRouterSource("/projects");
      const { store, handler } = setup({
        routerSource: fakeRouter.source,
        navigateChangesPath: false,
      });
      const resultPromise = handler(
        { path: "/playground", reason: "to stage the prompt edit" },
        CALL_CONTEXT
      );
      await Promise.resolve();
      const acceptPromise = getPending(store)?.accept?.();

      // A blocker holds the navigation: the router never leaves idle and the
      // location never changes.
      await vi.advanceTimersByTimeAsync(10_000);

      await acceptPromise;
      await expect(resultPromise).resolves.toEqual({
        ok: false,
        error: NAVIGATION_BLOCKED_ERROR,
      });
    } finally {
      vi.useRealTimers();
    }
  });
});

describe("createDataRouterNavigationStateSource", () => {
  function createStubRouter(pathname: string) {
    return {
      state: {
        location: { pathname },
        navigation: { state: "idle" as const },
      },
      subscribe: () => () => {},
    };
  }

  it("strips the basename from the router's pathname", () => {
    const source = createDataRouterNavigationStateSource({
      router: createStubRouter("/phoenix/playground"),
      basename: "/phoenix",
    });
    expect(source.getPathname()).toBe("/playground");
  });

  it("returns the pathname unchanged for the root basename", () => {
    const source = createDataRouterNavigationStateSource({
      router: createStubRouter("/playground"),
      basename: "/",
    });
    expect(source.getPathname()).toBe("/playground");
  });

  it("does not strip a same-prefix segment that is not a basename boundary", () => {
    const source = createDataRouterNavigationStateSource({
      router: createStubRouter("/phoenixette/playground"),
      basename: "/phoenix",
    });
    expect(source.getPathname()).toBe("/phoenixette/playground");
  });
});
