import { afterEach, describe, expect, it, vi } from "vitest";

import {
  registerUiOperation,
  renderUiOperationCatalog,
  searchUiOperations,
  unregisterUiOperation,
} from "../catalog";
import { dispatchUiOperationCall } from "../dispatch";
import { setTimeRangeOperation } from "../operations/setTimeRange";
import type {
  UiScriptMessageToMain,
  UiScriptMessageToWorker,
} from "../runtime/protocol";
import {
  runUiScript,
  type UiScriptWorkerLike,
} from "../runtime/uiScriptBridge";

afterEach(() => {
  unregisterUiOperation(setTimeRangeOperation.name);
});

describe("setTimeRangeOperation input schema", () => {
  it("accepts a preset key", () => {
    const parsed = setTimeRangeOperation.inputSchema.safeParse({
      timeRangeKey: "7d",
    });
    expect(parsed.success).toBe(true);
  });

  it("accepts a custom range with ISO times", () => {
    const parsed = setTimeRangeOperation.inputSchema.safeParse({
      timeRangeKey: "custom",
      startTime: "2026-08-01T00:00:00Z",
      endTime: "2026-08-08T00:00:00Z",
    });
    expect(parsed.success).toBe(true);
  });

  it("rejects an unknown preset key", () => {
    const parsed = setTimeRangeOperation.inputSchema.safeParse({
      timeRangeKey: "90d",
    });
    expect(parsed.success).toBe(false);
  });

  it("rejects a non-string startTime", () => {
    const parsed = setTimeRangeOperation.inputSchema.safeParse({
      timeRangeKey: "custom",
      startTime: 1723075200000,
    });
    expect(parsed.success).toBe(false);
  });

  it("rejects unknown properties, matching the server schema's additionalProperties: false", () => {
    const parsed = setTimeRangeOperation.inputSchema.safeParse({
      timeRangeKey: "7d",
      timezone: "UTC",
    });
    expect(parsed.success).toBe(false);
  });
});

describe("catalog search", () => {
  it("finds timeRange.set by keyword and reports mounted state", () => {
    const results = searchUiOperations({ query: "time range" });
    expect(results.map((result) => result.descriptor.name)).toContain(
      "timeRange.set"
    );
    expect(results[0]?.isMounted).toBe(false);
  });

  it("renders a signature block with the enum inlined", () => {
    const rendered = renderUiOperationCatalog(
      searchUiOperations({ query: "" })
    );
    expect(rendered).toContain("ui.timeRange.set(input: {");
    expect(rendered).toContain('"custom"');
    expect(rendered).toContain("Promise<UiResult>");
  });
});

describe("dispatchUiOperationCall", () => {
  it("returns a did-you-mean error for an unknown operation", async () => {
    const result = await dispatchUiOperationCall({
      operationName: "timeRange.update",
      input: {},
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toContain("timeRange.set");
      expect(result.error).toContain("search_ui");
    }
  });

  it("returns the route hint when the operation is not mounted", async () => {
    const result = await dispatchUiOperationCall({
      operationName: "timeRange.set",
      input: { timeRangeKey: "7d" },
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toContain("time range selector");
    }
  });

  it("rejects invalid input before reaching the handler", async () => {
    const handler = vi.fn();
    registerUiOperation({ descriptor: setTimeRangeOperation, handler });
    const result = await dispatchUiOperationCall({
      operationName: "timeRange.set",
      input: { timeRangeKey: "90d" },
    });
    expect(result.ok).toBe(false);
    expect(handler).not.toHaveBeenCalled();
  });

  it("invokes the handler with parsed input and applies the default success output", async () => {
    const handler = vi.fn().mockResolvedValue({ ok: true });
    registerUiOperation({ descriptor: setTimeRangeOperation, handler });
    const result = await dispatchUiOperationCall({
      operationName: "timeRange.set",
      input: { timeRangeKey: "7d" },
    });
    expect(handler).toHaveBeenCalledWith({ timeRangeKey: "7d" });
    expect(result).toEqual({ ok: true, output: "Time range updated." });
  });

  it("maps a thrown handler error to an ok: false result", async () => {
    registerUiOperation({
      descriptor: setTimeRangeOperation,
      handler: async () => {
        throw new Error("selector unavailable");
      },
    });
    const result = await dispatchUiOperationCall({
      operationName: "timeRange.set",
      input: { timeRangeKey: "7d" },
    });
    expect(result).toEqual({ ok: false, error: "selector unavailable" });
  });
});

/**
 * Drives the bridge with a scripted fake worker: what the worker realm would
 * emit for a given script is played back over the protocol, so the bridge's
 * dispatch round-trip, limits, and settlement logic are tested without
 * spawning threads.
 */
function createFakeWorker(
  handleMessage: (
    message: UiScriptMessageToWorker,
    emit: (message: UiScriptMessageToMain) => void
  ) => void
) {
  let bridgeListener: ((event: MessageEvent) => void) | undefined;
  const emit = (message: UiScriptMessageToMain) => {
    queueMicrotask(() =>
      bridgeListener?.({ data: message } as unknown as MessageEvent)
    );
  };
  const terminate = vi.fn();
  const worker: UiScriptWorkerLike = {
    addEventListener: (_type, listener) => {
      bridgeListener = listener;
    },
    postMessage: (message) => handleMessage(message, emit),
    terminate,
  };
  return { worker, terminate };
}

describe("runUiScript bridge", () => {
  it("round-trips a ui call through dispatch and resolves with the script result", async () => {
    const dispatchCall = vi
      .fn()
      .mockResolvedValue({ ok: true, output: "Time range updated." });
    const { worker, terminate } = createFakeWorker((message, emit) => {
      if (message.type === "run") {
        emit({
          type: "call",
          callId: 1,
          operationName: "timeRange.set",
          input: { timeRangeKey: "7d" },
        });
      }
      if (message.type === "callResult") {
        emit({ type: "log", message: "range set" });
        emit({ type: "done", returnValue: JSON.stringify(message.result) });
      }
    });

    const run = await runUiScript({
      script: "return await ui.timeRange.set({ timeRangeKey: '7d' });",
      dispatchCall,
      createWorker: () => worker,
    });

    expect(dispatchCall).toHaveBeenCalledWith({
      operationName: "timeRange.set",
      input: { timeRangeKey: "7d" },
    });
    expect(run).toEqual({
      ok: true,
      returnValue: JSON.stringify({ ok: true, output: "Time range updated." }),
      callCount: 1,
      logs: ["range set"],
    });
    expect(terminate).toHaveBeenCalled();
  });

  it("terminates a script that exceeds its wall-clock budget", async () => {
    const { worker, terminate } = createFakeWorker(() => {
      // Never respond: simulates a hung or looping script.
    });
    const run = await runUiScript({
      script: "while (true) {}",
      createWorker: () => worker,
      timeoutMs: 10,
    });
    expect(run.ok).toBe(false);
    if (!run.ok) {
      expect(run.error).toContain("execution budget");
    }
    expect(terminate).toHaveBeenCalled();
  });

  it("terminates a script that exceeds its call budget", async () => {
    const dispatchCall = vi.fn().mockResolvedValue({ ok: true });
    const { worker } = createFakeWorker((message, emit) => {
      if (message.type === "run" || message.type === "callResult") {
        emit({
          type: "call",
          callId: message.type === "run" ? 1 : message.callId + 1,
          operationName: "timeRange.set",
          input: { timeRangeKey: "7d" },
        });
      }
    });
    const run = await runUiScript({
      script: "loop forever",
      dispatchCall,
      createWorker: () => worker,
      maxCalls: 3,
    });
    expect(run.ok).toBe(false);
    if (!run.ok) {
      expect(run.error).toContain("call budget");
    }
  });
});
