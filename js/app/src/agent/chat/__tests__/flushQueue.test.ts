import { createFlushQueue } from "@phoenix/agent/chat/flushQueue";

/** A promise plus the function that resolves it. */
function deferred(): { promise: Promise<void>; resolve: () => void } {
  let resolve: () => void = () => undefined;
  const promise = new Promise<void>((resolvePromise) => {
    resolve = resolvePromise;
  });
  return { promise, resolve };
}

describe("createFlushQueue", () => {
  it("runs queued flushes one at a time", async () => {
    const queue = createFlushQueue();
    const events: string[] = [];
    const firstRelease = deferred();
    const secondRan = deferred();

    queue.enqueue(async () => {
      events.push("first:start");
      await firstRelease.promise;
      events.push("first:end");
    });
    queue.enqueue(async () => {
      events.push("second:start");
      secondRan.resolve();
    });

    // The second flush must not start while the first is in flight — both
    // routes claim the session's turn lock.
    await Promise.resolve();
    expect(events).toEqual(["first:start"]);

    firstRelease.resolve();
    await secondRan.promise;
    expect(events).toEqual(["first:start", "first:end", "second:start"]);
  });

  it("runs the next flush even when the one before it rejects", async () => {
    const queue = createFlushQueue();
    const events: string[] = [];
    const secondRan = deferred();

    queue.enqueue(() => Promise.reject(new Error("offline")));
    queue.enqueue(async () => {
      events.push("second");
      secondRan.resolve();
    });

    await secondRan.promise;
    expect(events).toEqual(["second"]);
  });

  it("reports a flush as pending until it settles", async () => {
    const queue = createFlushQueue();
    const release = deferred();
    const started = deferred();

    expect(queue.hasPending()).toBe(false);
    queue.enqueue(async () => {
      started.resolve();
      await release.promise;
    });
    expect(queue.hasPending()).toBe(true);

    await started.promise;
    release.resolve();
    // Drain the queue's bookkeeping hop.
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(queue.hasPending()).toBe(false);
  });
});
