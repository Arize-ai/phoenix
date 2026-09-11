import { describe, expect, it, vi } from "vitest";

import { createLatestValue } from "../latestValue";

describe("createLatestValue", () => {
  it("resolves at once when the current value already satisfies the condition", async () => {
    const latest = createLatestValue(2);
    await expect(latest.waitFor((value) => value > 1, 1000)).resolves.toBe(2);
  });

  it("resolves with the first later value that satisfies the condition", async () => {
    const latest = createLatestValue(0);
    const waiting = latest.waitFor((value) => value >= 2, 1000);
    latest.set(1);
    latest.set(2);
    latest.set(3);
    await expect(waiting).resolves.toBe(2);
    expect(latest.get()).toBe(3);
  });

  it("resolves with null when the condition is not met in time", async () => {
    vi.useFakeTimers();

    try {
      const latest = createLatestValue(0);
      const waiting = latest.waitFor((value) => value > 0, 50);
      vi.advanceTimersByTime(50);
      await expect(waiting).resolves.toBeNull();
      // The timed-out watcher is gone; later values no longer reach it.
      latest.set(1);
      expect(latest.get()).toBe(1);
    } finally {
      vi.useRealTimers();
    }
  });
});
