import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { AgentCapabilities } from "@phoenix/agent/extensions/capabilities";
import { createAgentStore } from "@phoenix/store/agentStore";

import { dispatchUIOperationCall } from "../dispatch";
import {
  getRouteSettleWaitMs,
  markRouteChanged,
  resetRouteSettleForTests,
  ROUTE_SETTLE_MOUNT_TIMEOUT_MS,
  ROUTE_SETTLE_WINDOW_MS,
} from "../routeSettle";

const CAPABILITIES: AgentCapabilities = {
  "subagents.enabled": false,
  "web.access": false,
};

/** A read-kind catalog operation that takes an empty input and mounts with a page. */
const READ_OP = "evaluators.project.scope.read";

function dispatch(agentStore: ReturnType<typeof createAgentStore>) {
  return dispatchUIOperationCall({
    operationName: READ_OP,
    input: {},
    callId: "tool-call-1:1",
    agentStore,
    sessionId: "session-1",
    capabilities: CAPABILITIES,
  });
}

describe("route settle window", () => {
  afterEach(() => resetRouteSettleForTests());

  it("waits only within the window after a route change", () => {
    expect(getRouteSettleWaitMs(1_000)).toBe(0);
    markRouteChanged(1_000);
    expect(getRouteSettleWaitMs(1_000)).toBe(ROUTE_SETTLE_MOUNT_TIMEOUT_MS);
    expect(getRouteSettleWaitMs(1_000 + ROUTE_SETTLE_WINDOW_MS)).toBe(
      ROUTE_SETTLE_MOUNT_TIMEOUT_MS
    );
    expect(getRouteSettleWaitMs(1_001 + ROUTE_SETTLE_WINDOW_MS)).toBe(0);
  });
});

describe("dispatch after a route change", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => {
    vi.useRealTimers();
    resetRouteSettleForTests();
  });

  it("runs an operation that mounts shortly after the route changed", async () => {
    const agentStore = createAgentStore();
    markRouteChanged();
    const pending = dispatch(agentStore);
    await vi.advanceTimersByTimeAsync(800);
    agentStore
      .getState()
      .registerClientAction(READ_OP, async () => ({
        ok: true,
        output: "read",
      }));
    await expect(pending).resolves.toEqual({ ok: true, output: "read" });
  });

  it("fails with NOT_AVAILABLE when the operation never mounts", async () => {
    const agentStore = createAgentStore();
    markRouteChanged();
    const pending = dispatch(agentStore);
    await vi.advanceTimersByTimeAsync(ROUTE_SETTLE_MOUNT_TIMEOUT_MS + 1);
    await expect(pending).resolves.toMatchObject({
      ok: false,
      code: "NOT_AVAILABLE",
    });
  });

  it("fails at once when the route has not changed recently", async () => {
    const agentStore = createAgentStore();
    await expect(dispatch(agentStore)).resolves.toMatchObject({
      ok: false,
      code: "NOT_AVAILABLE",
    });
  });
});
