// oxlint-disable import/no-duplicates -- the bridge module is imported twice on purpose: once for its exports, once as source text via Vite's `?raw` query
import { describe, expect, it, vi } from "vitest";

import {
  runJSSandboxScript,
  type JSSandboxWorkerLike,
} from "@phoenix/agent/uiOperations/runtime/jsSandboxBridge";
import type {
  JSSandboxMessageToWorker,
  JSSandboxMessageToMain,
} from "@phoenix/agent/uiOperations/runtime/protocol";
import type { UIOperationResult } from "@phoenix/agent/uiOperations/types";

// oxlint-disable-next-line import/default -- Vite `?raw` import; the resolver can't see the synthesized default export
import JSSandboxBridgeSource from "../jsSandboxBridge.ts?raw";

/** A real long-running operation, so the bridge pauses the budget for it. */
const LONG_RUNNING_OP = "playground.run";

/** A deferred promise whose resolver is exposed for the test to fire later. */
function createDeferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((res) => {
    resolve = res;
  });
  return { promise, resolve };
}

type FakeWorker = JSSandboxWorkerLike & {
  posted: JSSandboxMessageToWorker[];
  isTerminated: boolean;
  emitMessage: (message: JSSandboxMessageToMain) => void;
  emitError: (event: { message?: string }) => void;
};

function createFakeWorker(): FakeWorker {
  const listenersByType = new Map<string, ((event: unknown) => void)[]>();
  const addListener = (type: string, listener: (event: unknown) => void) => {
    const listeners = listenersByType.get(type) ?? [];
    listeners.push(listener);
    listenersByType.set(type, listeners);
  };
  const emit = (type: string, event: unknown) => {
    for (const listener of listenersByType.get(type) ?? []) {
      listener(event);
    }
  };
  return {
    posted: [],
    isTerminated: false,
    postMessage(message: JSSandboxMessageToWorker) {
      this.posted.push(message);
    },
    addEventListener: addListener as FakeWorker["addEventListener"],
    terminate() {
      this.isTerminated = true;
    },
    emitMessage(message) {
      emit("message", { data: message });
    },
    emitError(event) {
      emit("error", event);
    },
  };
}

describe("runJSSandboxScript worker failure backstop", () => {
  it("settles as failed when the worker fires an error event instead of burning the budget", async () => {
    const worker = createFakeWorker();
    const runPromise = runJSSandboxScript({
      script: "return 1;",
      dispatchCall: vi.fn(),
      createWorker: () => worker,
    });

    worker.emitError({ message: "SyntaxError: Invalid or unexpected token" });

    const result = await runPromise;
    expect(result).toMatchObject({
      ok: false,
      error: expect.stringContaining("SyntaxError"),
    });
    expect(worker.isTerminated).toBe(true);
  });

  it("keeps the budget paused until the last of several concurrent long-running ops settles", async () => {
    vi.useFakeTimers();
    try {
      const worker = createFakeWorker();
      const first = createDeferred<UIOperationResult>();
      const second = createDeferred<UIOperationResult>();
      const dispatchResults = [first.promise, second.promise];
      const dispatchCall = vi.fn(() => dispatchResults.shift()!);

      const runPromise = runJSSandboxScript({
        script: "await Promise.all([ui.a(), ui.b()]);",
        dispatchCall,
        createWorker: () => worker,
        timeoutMs: 1000,
      });

      // Two long-running ops in flight concurrently (as a Promise.all would).
      worker.emitMessage({
        type: "call",
        callId: 1,
        operationName: LONG_RUNNING_OP,
        input: {},
      });
      worker.emitMessage({
        type: "call",
        callId: 2,
        operationName: LONG_RUNNING_OP,
        input: {},
      });
      await Promise.resolve();

      // The first completes; the second is still in flight.
      first.resolve({ ok: true, output: "one" });
      await Promise.resolve();

      // Burn far past the 1000ms budget while the second op is pending.
      // Before the pause-depth fix this re-armed the clock and timed the run
      // out mid-flight; now the budget stays frozen.
      await vi.advanceTimersByTimeAsync(5000);

      // Complete the second, then let the worker report completion.
      second.resolve({ ok: true, output: "two" });
      await Promise.resolve();
      worker.emitMessage({ type: "done", returnValue: "done" });

      const result = await runPromise;
      expect(result).toMatchObject({ ok: true });
      expect(worker.isTerminated).toBe(true);
    } finally {
      vi.useRealTimers();
    }
  });

  it("hard-kills a run whose long-running op never settles, once the wait budget is spent", async () => {
    vi.useFakeTimers();
    try {
      const worker = createFakeWorker();
      const neverSettles = new Promise<UIOperationResult>(() => {});
      const dispatchCall = vi.fn(() => neverSettles);

      const runPromise = runJSSandboxScript({
        script: "await ui.something();",
        dispatchCall,
        createWorker: () => worker,
        timeoutMs: 1000,
        maxPausedMs: 2000,
      });

      // A long-running op goes in flight, switching the clock to the wait
      // budget...
      worker.emitMessage({
        type: "call",
        callId: 1,
        operationName: LONG_RUNNING_OP,
        input: {},
      });
      await Promise.resolve();

      // ...and it never completes. Without a wait budget the run would live
      // forever with the execution clock paused; now it dies when the 2000ms
      // of waiting is spent.
      await vi.advanceTimersByTimeAsync(1999);
      expect(worker.isTerminated).toBe(false);
      await vi.advanceTimersByTimeAsync(2);

      const result = await runPromise;
      expect(result).toMatchObject({
        ok: false,
        error: expect.stringContaining("awaiting long-running operations"),
      });
      expect(worker.isTerminated).toBe(true);
    } finally {
      vi.useRealTimers();
    }
  });

  it("still enforces the execution budget when no long-running op is in flight", async () => {
    vi.useFakeTimers();
    try {
      const worker = createFakeWorker();
      const runPromise = runJSSandboxScript({
        script: "while (true) {}",
        dispatchCall: vi.fn(),
        createWorker: () => worker,
        timeoutMs: 1000,
        maxPausedMs: 2000,
      });

      await vi.advanceTimersByTimeAsync(999);
      expect(worker.isTerminated).toBe(false);
      await vi.advanceTimersByTimeAsync(2);

      const result = await runPromise;
      expect(result).toMatchObject({
        ok: false,
        error: expect.stringContaining("execution budget"),
      });
      expect(worker.isTerminated).toBe(true);
    } finally {
      vi.useRealTimers();
    }
  });

  it("reports a script-posted parse failure as the run error", async () => {
    const worker = createFakeWorker();
    const runPromise = runJSSandboxScript({
      script: "const s = `broken\\\\`;",
      dispatchCall: vi.fn(),
      createWorker: () => worker,
    });

    worker.emitMessage({
      type: "failed",
      error:
        "The script failed to parse — fix the syntax and retry. SyntaxError: Invalid or unexpected token",
    });

    const result = await runPromise;
    expect(result).toMatchObject({
      ok: false,
      error: expect.stringContaining("failed to parse"),
    });
  });
});

describe("createJSSandboxWorker bundler contract", () => {
  it("imports the worker with ?worker&url so Vite emits a JS chunk", () => {
    expect(JSSandboxBridgeSource).toMatch(/jsSandboxWorker\.ts\?worker&url/);
  });
});
