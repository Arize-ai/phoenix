import { describe, expect, it, vi } from "vitest";

import type { EvaluatorTaskAgentHost } from "@phoenix/agent/tools/playgroundEvaluator/types";

import { createEvaluatorTaskAgentRegistry } from "../evaluatorTaskAgentRegistry";

function createHost(): EvaluatorTaskAgentHost {
  return {
    read: vi.fn(),
    edit: vi.fn(),
    save: vi.fn(),
  } as unknown as EvaluatorTaskAgentHost;
}

describe("createEvaluatorTaskAgentRegistry", () => {
  it("hands out the adapter registered for an instance and withdraws it", () => {
    const registry = createEvaluatorTaskAgentRegistry();
    const host = createHost();

    const unregister = registry.register(3, host);
    expect(registry.get(3)).toBe(host);
    expect(registry.get(4)).toBeUndefined();

    unregister();
    expect(registry.get(3)).toBeUndefined();
  });

  it("resolves a waiter with the adapter registered later", async () => {
    const registry = createEvaluatorTaskAgentRegistry();
    const host = createHost();

    const waiting = registry.waitFor(7, 1000);
    registry.register(7, host);

    await expect(waiting).resolves.toBe(host);
  });

  it("lets a newer registration for the same instance survive the older one's cleanup", () => {
    const registry = createEvaluatorTaskAgentRegistry();
    const older = createHost();
    const newer = createHost();

    const unregisterOlder = registry.register(1, older);
    registry.register(1, newer);
    unregisterOlder();

    expect(registry.get(1)).toBe(newer);
  });

  it("resolves null when no adapter registers in time", async () => {
    vi.useFakeTimers();
    try {
      const registry = createEvaluatorTaskAgentRegistry();
      const waiting = registry.waitFor(1, 50);
      vi.advanceTimersByTime(50);
      await expect(waiting).resolves.toBeNull();
    } finally {
      vi.useRealTimers();
    }
  });
});
