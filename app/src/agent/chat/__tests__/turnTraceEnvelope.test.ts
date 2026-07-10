import { describe, expect, it } from "vitest";

import { createTurnEnvelopeManager } from "../turnTraceEnvelope";

const envelope = {
  traceId: "1".repeat(32),
  rootSpanId: "2".repeat(16),
  startedAt: "2026-07-10T12:00:00Z",
};

describe("createTurnEnvelopeManager", () => {
  it("captures, ignores empty metadata, and clears the active envelope", () => {
    const manager = createTurnEnvelopeManager();
    expect(manager.getActive()).toBeNull();

    manager.captureFromMetadata(envelope);
    manager.captureFromMetadata(null);
    manager.captureFromMetadata(undefined);
    expect(manager.getActive()).toEqual(envelope);

    manager.clear();
    expect(manager.getActive()).toBeNull();
  });
});
