import { describe, expect, it } from "vitest";

import { createTurnTraceContextManager } from "../turnTraceContext";

const turnTraceContext = {
  traceId: "1".repeat(32),
  rootSpanId: "2".repeat(16),
  startedAt: "2026-07-10T12:00:00Z",
};

describe("createTurnTraceContextManager", () => {
  it("captures, ignores empty metadata, and clears the active context", () => {
    const manager = createTurnTraceContextManager();
    expect(manager.getActive()).toBeNull();

    manager.captureFromMetadata(turnTraceContext);
    manager.captureFromMetadata(null);
    manager.captureFromMetadata(undefined);
    expect(manager.getActive()).toEqual(turnTraceContext);

    manager.clear();
    expect(manager.getActive()).toBeNull();
  });
});
