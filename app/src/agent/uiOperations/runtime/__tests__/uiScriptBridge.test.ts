import { describe, expect, it, vi } from "vitest";

import type {
  UiScriptMessageToWorker,
  UiScriptMessageToMain,
} from "@phoenix/agent/uiOperations/runtime/protocol";
import {
  runUiScript,
  type UiScriptWorkerLike,
} from "@phoenix/agent/uiOperations/runtime/uiScriptBridge";
import type { UiOperationResult } from "@phoenix/agent/uiOperations/types";

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

type FakeWorker = UiScriptWorkerLike & {
  posted: UiScriptMessageToWorker[];
  isTerminated: boolean;
  emitMessage: (message: UiScriptMessageToMain) => void;
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
    postMessage(message: UiScriptMessageToWorker) {
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

describe("runUiScript worker failure backstop", () => {
  it("settles as failed when the worker fires an error event instead of burning the budget", async () => {
    const worker = createFakeWorker();
    const runPromise = runUiScript({
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
      const first = createDeferred<UiOperationResult>();
      const second = createDeferred<UiOperationResult>();
      const dispatchResults = [first.promise, second.promise];
      const dispatchCall = vi.fn(() => dispatchResults.shift()!);

      const runPromise = runUiScript({
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

  it("reports a script-posted parse failure as the run error", async () => {
    const worker = createFakeWorker();
    const runPromise = runUiScript({
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
