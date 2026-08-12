import { registerRouteInfoCatalog } from "@phoenix/agent/tools/getRouteInfo/routeCatalogRegistry";
import { createAgentStore } from "@phoenix/store/agentStore";

import { createNavigationGoToClientAction } from "../clientActions";
import {
  NAVIGATION_BLOCKED_ERROR,
  NAVIGATION_DECLINED_ERROR,
} from "../constants";

const CALL_CONTEXT = { callId: "tool-call-1:0", sessionId: "session-1" };

function setup({
  currentPath = "/projects",
  navigateChangesPath = true,
}: { currentPath?: string; navigateChangesPath?: boolean } = {}) {
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
