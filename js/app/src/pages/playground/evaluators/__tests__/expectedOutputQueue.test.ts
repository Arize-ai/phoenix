import { describe, expect, it, vi } from "vitest";

import {
  createExpectedOutputQueue,
  mergePendingExpectedOutputs,
  type ExpectedOutputQueueState,
  type PendingExpectedOutputs,
} from "../expectedOutputQueue";

/** Manual timers: callbacks run only when the test fires them. */
function createTimers() {
  const timers = new Map<number, { callback: () => void; ms: number }>();
  let nextHandle = 1;

  return {
    schedule: (callback: () => void, ms: number) => {
      const handle = nextHandle++;
      timers.set(handle, { callback, ms });

      return () => {
        timers.delete(handle);
      };
    },
    fire(ms: number) {
      for (const [handle, timer] of [...timers]) {
        if (timer.ms === ms) {
          timers.delete(handle);
          timer.callback();
        }
      }
    },
    scheduled: () =>
      [...timers.values()].map((timer) => timer.ms).sort((a, b) => a - b),
  };
}

const settle = () => new Promise((resolve) => setTimeout(resolve, 0));

describe("expected output queue", () => {
  it("coalesces annotations made within the idle window into one batch, last annotation winning", async () => {
    const timers = createTimers();
    const flush = vi.fn(async () => ({ ok: true as const }));
    const states: ExpectedOutputQueueState[] = [];

    const queue = createExpectedOutputQueue({
      flush,
      onChange: (state) => states.push(state),
      idleMs: 2000,
      maxWaitMs: 10000,
      ...timers,
    });

    queue.enqueue("ex1", "judge", { label: "pass" });
    queue.enqueue("ex2", "judge", { label: "fail" });
    queue.enqueue("ex1", "judge", { label: "fail" });
    expect(queue.getState()).toMatchObject({
      pendingCount: 2,
      status: "pending",
      overlay: {
        ex1: { judge: { label: "fail" } },
        ex2: { judge: { label: "fail" } },
      },
    });
    // Each annotation restarts the idle timer; the max-wait timer is armed once.
    expect(timers.scheduled()).toEqual([2000, 10000]);
    expect(flush).not.toHaveBeenCalled();
    timers.fire(2000);
    await settle();
    expect(flush).toHaveBeenCalledTimes(1);
    expect(flush).toHaveBeenCalledWith({
      ex1: { judge: { label: "fail" } },
      ex2: { judge: { label: "fail" } },
    });
    expect(queue.getState()).toMatchObject({
      pendingCount: 0,
      status: "saved",
      overlay: {},
    });
    expect(states.some((state) => state.status === "saving")).toBe(true);
    // Nothing left to write, so the max-wait timer was cancelled with the flush.
    expect(timers.scheduled()).toEqual([2500]);
    timers.fire(2500);
    expect(queue.getState().status).toBe("idle");
  });

  it("keeps annotations made during a write for the next batch and shows both as recorded", async () => {
    const timers = createTimers();
    let resolveFlush: (() => void) | null = null;

    const flush = vi.fn(
      () =>
        new Promise<{ ok: true }>((resolve) => {
          resolveFlush = () => resolve({ ok: true });
        })
    );

    const queue = createExpectedOutputQueue({ flush, ...timers });
    queue.enqueue("ex1", "judge", { label: "pass" });
    const first = queue.flushNow();
    expect(queue.getState().isSaving).toBe(true);
    queue.enqueue("ex2", "judge", { label: "pass" });
    expect(queue.getState().overlay).toEqual({
      ex1: { judge: { label: "pass" } },
      ex2: { judge: { label: "pass" } },
    });
    resolveFlush!();
    await first;
    expect(queue.getState()).toMatchObject({
      isSaving: false,
      pendingCount: 1,
      overlay: { ex2: { judge: { label: "pass" } } },
    });
    const second = queue.flushNow();
    expect(flush).toHaveBeenLastCalledWith({
      ex2: { judge: { label: "pass" } },
    });
    resolveFlush!();
    await second;
    expect(queue.getState()).toMatchObject({
      isSaving: false,
      pendingCount: 0,
    });
  });

  it("returns a failed batch to the queue beneath newer annotations and reports the error", async () => {
    const timers = createTimers();

    const flush = vi
      .fn<
        (
          batch: PendingExpectedOutputs
        ) => Promise<{ ok: true } | { ok: false; error: string }>
      >()
      .mockResolvedValueOnce({ ok: false, error: "offline" })
      .mockResolvedValueOnce({ ok: true });

    const queue = createExpectedOutputQueue({ flush, ...timers });
    queue.enqueue("ex1", "judge", { label: "pass" });
    queue.enqueue("ex2", "judge", { label: "pass" });
    expect(await queue.flushNow()).toEqual({ ok: false, error: "offline" });
    expect(queue.getState()).toMatchObject({
      status: "error",
      error: "offline",
      pendingCount: 2,
    });
    // Re-annotating after the failure supersedes the queued value.
    queue.enqueue("ex1", "judge", null);
    expect(queue.getState().error).toBeNull();
    await queue.flushNow();
    expect(flush).toHaveBeenLastCalledWith({
      ex1: { judge: null },
      ex2: { judge: { label: "pass" } },
    });
    expect(queue.getState().status).toBe("saved");
  });

  it("flushes no later than the maximum wait while annotating continues", async () => {
    const timers = createTimers();
    const flush = vi.fn(async () => ({ ok: true as const }));

    const queue = createExpectedOutputQueue({
      flush,
      idleMs: 2000,
      maxWaitMs: 10000,
      ...timers,
    });

    queue.enqueue("ex1", "judge", { label: "pass" });
    queue.enqueue("ex2", "judge", { label: "pass" });
    timers.fire(10000);
    await settle();
    expect(flush).toHaveBeenCalledTimes(1);
    // The idle timer was cleared by the flush rather than firing a second write.
    timers.fire(2000);
    await settle();
    expect(flush).toHaveBeenCalledTimes(1);
  });

  it("merges with later annotations winning", () => {
    expect(
      mergePendingExpectedOutputs(
        { ex1: { a: { label: "x" }, b: { label: "y" } } },
        { ex1: { a: null }, ex2: { a: { label: "z" } } }
      )
    ).toEqual({
      ex1: { a: null, b: { label: "y" } },
      ex2: { a: { label: "z" } },
    });
  });
});
