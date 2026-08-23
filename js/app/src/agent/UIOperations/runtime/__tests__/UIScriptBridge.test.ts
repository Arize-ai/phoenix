import { describe, expect, it, vi } from "vitest";

import type {
  UIScriptMessageToWorker,
  UIScriptMessageToMain,
} from "@phoenix/agent/UIOperations/runtime/protocol";
import {
  runUIScript,
  type UIScriptWorkerLike,
} from "@phoenix/agent/UIOperations/runtime/UIScriptBridge";
import type { UIOperationResult } from "@phoenix/agent/UIOperations/types";

import UIScriptBridgeSource from "../UIScriptBridge.ts?raw";

/** A real approval-kind operation, so the bridge pauses the budget for it. */
const APPROVAL_OP = "playground.prompt.edit";

/** A deferred promise whose resolver is exposed for the test to fire later. */
function createDeferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((res) => {
    resolve = res;
  });
  return { promise, resolve };
}

type FakeWorker = UIScriptWorkerLike & {
  posted: UIScriptMessageToWorker[];
  isTerminated: boolean;
  emitMessage: (message: UIScriptMessageToMain) => void;
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
    postMessage(message: UIScriptMessageToWorker) {
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

describe("runUIScript worker failure backstop", () => {
  it("settles as failed when the worker fires an error event instead of burning the budget", async () => {
    const worker = createFakeWorker();
    const runPromise = runUIScript({
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

  it("keeps the budget paused until the last of several concurrent approvals settles", async () => {
    vi.useFakeTimers();
    try {
      const worker = createFakeWorker();
      const first = createDeferred<UIOperationResult>();
      const second = createDeferred<UIOperationResult>();
      const dispatchResults = [first.promise, second.promise];
      const dispatchCall = vi.fn(() => dispatchResults.shift()!);

      const runPromise = runUIScript({
        script: "await Promise.all([ui.a(), ui.b()]);",
        dispatchCall,
        createWorker: () => worker,
        timeoutMs: 1000,
      });

      // Two approvals staged concurrently (as a Promise.all would).
      worker.emitMessage({
        type: "call",
        callId: 1,
        operationName: APPROVAL_OP,
        input: {},
      });
      worker.emitMessage({
        type: "call",
        callId: 2,
        operationName: APPROVAL_OP,
        input: {},
      });
      await Promise.resolve();

      // Accept the first; the second is still awaiting the user.
      first.resolve({ ok: true, output: "one" });
      await Promise.resolve();

      // Burn far past the 1000ms budget while the second approval is pending.
      // Before the pause-depth fix this re-armed the clock and timed the run
      // out mid-approval; now the budget stays frozen.
      await vi.advanceTimersByTimeAsync(5000);

      // Accept the second, then let the worker report completion.
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

  it("hard-kills a run whose approval never settles, once the wait budget is spent", async () => {
    vi.useFakeTimers();
    try {
      const worker = createFakeWorker();
      const neverSettles = new Promise<UIOperationResult>(() => {});
      const dispatchCall = vi.fn(() => neverSettles);

      const runPromise = runUIScript({
        script: "await ui.something();",
        dispatchCall,
        createWorker: () => worker,
        timeoutMs: 1000,
        maxPausedMs: 2000,
      });

      // An approval goes in flight, switching the clock to the wait budget...
      worker.emitMessage({
        type: "call",
        callId: 1,
        operationName: APPROVAL_OP,
        input: {},
      });
      await Promise.resolve();

      // ...and the user never decides. Without a wait budget the run would
      // live forever with the execution clock paused; now it dies when the
      // 2000ms of waiting is spent.
      await vi.advanceTimersByTimeAsync(1999);
      expect(worker.isTerminated).toBe(false);
      await vi.advanceTimersByTimeAsync(2);

      const result = await runPromise;
      expect(result).toMatchObject({
        ok: false,
        error: expect.stringContaining("awaiting approvals"),
      });
      expect(worker.isTerminated).toBe(true);
    } finally {
      vi.useRealTimers();
    }
  });

  it("still enforces the execution budget when no approval is in flight", async () => {
    vi.useFakeTimers();
    try {
      const worker = createFakeWorker();
      const runPromise = runUIScript({
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
    const runPromise = runUIScript({
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

describe("createUIScriptWorker bundler contract", () => {
  it("imports the worker with ?worker&url so Vite emits a JS chunk", () => {
    expect(UIScriptBridgeSource).toMatch(/UIScriptWorker\.ts\?worker&url/);
  });
});
