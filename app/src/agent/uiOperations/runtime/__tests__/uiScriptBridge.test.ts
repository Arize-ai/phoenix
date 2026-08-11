import { describe, expect, it, vi } from "vitest";

import type {
  UiScriptMessageToWorker,
  UiScriptMessageToMain,
} from "@phoenix/agent/uiOperations/runtime/protocol";
import {
  runUiScript,
  type UiScriptWorkerLike,
} from "@phoenix/agent/uiOperations/runtime/uiScriptBridge";

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
