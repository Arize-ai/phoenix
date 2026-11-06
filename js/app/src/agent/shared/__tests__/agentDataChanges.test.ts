import { describe, expect, it, vi } from "vitest";

import {
  emitAgentDataChange,
  subscribeToAgentDataChanges,
} from "../agentDataChanges";

describe("agentDataChanges", () => {
  it("delivers a change to every subscriber and stops after unsubscribe", () => {
    const first = vi.fn();
    const second = vi.fn();
    const unsubscribeFirst = subscribeToAgentDataChanges(first);
    const unsubscribeSecond = subscribeToAgentDataChanges(second);

    emitAgentDataChange({ entity: "datasets" });
    expect(first).toHaveBeenCalledWith({ entity: "datasets" });
    expect(second).toHaveBeenCalledWith({ entity: "datasets" });

    unsubscribeFirst();
    emitAgentDataChange({ entity: "datasetExamples", datasetId: "d1" });
    expect(first).toHaveBeenCalledTimes(1);
    expect(second).toHaveBeenLastCalledWith({
      entity: "datasetExamples",
      datasetId: "d1",
    });
    unsubscribeSecond();
  });

  it("keeps notifying other subscribers when one throws", () => {
    const failing = vi.fn(() => {
      throw new Error("boom");
    });
    const healthy = vi.fn();
    const unsubscribeFailing = subscribeToAgentDataChanges(failing);
    const unsubscribeHealthy = subscribeToAgentDataChanges(healthy);

    expect(() =>
      emitAgentDataChange({ entity: "datasetSplits" })
    ).not.toThrow();
    expect(healthy).toHaveBeenCalledWith({ entity: "datasetSplits" });

    unsubscribeFailing();
    unsubscribeHealthy();
  });
});
