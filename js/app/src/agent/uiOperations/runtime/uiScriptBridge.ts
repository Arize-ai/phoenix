import { getUiOperationDescriptor } from "../catalog";
import type { UiOperationResult } from "../types";
import type {
  UiScriptMessageToMain,
  UiScriptMessageToWorker,
} from "./protocol";

/**
 * Executes one `ui.*` call from a running script. The `execute_ui` tool
 * builds this by binding `dispatchUiOperationCall` to its tool-call context
 * (agent store, session, capabilities).
 */
export type UiScriptDispatchCall = (call: {
  operationName: string;
  input: unknown;
  /** Monotonic 1-based sequence of this call within the script run. */
  callSequence: number;
}) => Promise<UiOperationResult>;

/** Wall-clock budget for one script, excluding time spent awaiting approvals. */
export const DEFAULT_UI_SCRIPT_TIMEOUT_MS = 30_000;

/** Maximum `ui.*` calls one script may make. */
export const DEFAULT_MAX_UI_CALLS_PER_SCRIPT = 50;

export type UiScriptRunResult = {
  /** Number of `ui.*` calls the script made (successful or not). */
  callCount: number;
  /** Messages the script emitted via `log(...)`, in order. */
  logs: string[];
} & ({ ok: true; returnValue: string } | { ok: false; error: string });

/**
 * The worker surface the bridge needs — satisfied by a real `Worker` and
 * trivially fakeable in tests without spawning threads.
 */
export type UiScriptWorkerLike = {
  postMessage(message: UiScriptMessageToWorker): void;
  addEventListener(
    type: "message",
    listener: (event: MessageEvent) => void
  ): void;
  terminate(): void;
};

/** Spawn the real module worker (Vite bundles it via the URL constructor). */
export function createUiScriptWorker(): UiScriptWorkerLike {
  const workerUrl = new URL("./uiScriptWorker.ts", import.meta.url);
  if (workerUrl.origin === globalThis.location.origin) {
    return new Worker(workerUrl, { type: "module" });
  }
  // Dev-mode split origin: the app page (e.g. :6006) loads its modules from
  // the Vite dev server (e.g. :5173), and `new Worker()` requires a
  // same-origin script URL. Bounce through a same-origin blob module that
  // imports the cross-origin worker module (served with CORS by Vite).
  const blobSource = `import ${JSON.stringify(workerUrl.href)};`;
  const blobUrl = URL.createObjectURL(
    new Blob([blobSource], { type: "text/javascript" })
  );
  try {
    return new Worker(blobUrl, { type: "module" });
  } finally {
    // The constructor dereferences the URL synchronously; revoking here
    // avoids leaking one object URL per script run.
    URL.revokeObjectURL(blobUrl);
  }
}

/**
 * Run one `execute_ui` script to completion in a fresh worker.
 *
 * One worker per run: spawn, run, terminate. Workers start in single-digit
 * milliseconds, a fresh realm leaks no state between runs, and timeout
 * enforcement is simply `terminate()` — the property main-thread `eval` can
 * never offer.
 *
 * All limits are enforced on this side of the boundary so a compromised or
 * runaway script cannot evade them:
 * - wall-clock timeout, hard-killed via `terminate()`;
 * - the timeout clock *pauses* while an `approval`-kind operation awaits the
 *   user's accept/reject decision, then resumes;
 * - a per-script `ui.*` call budget.
 *
 * @param params.script - agent-authored script body; may `await ui.*` calls,
 *   call `log(...)`, and `return` a final value
 * @param params.dispatchCall - operation dispatcher (injectable for tests)
 * @param params.createWorker - worker factory (injectable for tests)
 * @param params.timeoutMs - wall-clock budget, excluding approval waits
 * @param params.maxCalls - maximum `ui.*` calls before the run is failed
 * @param params.registerAbort - receives a callback that force-fails the run
 *   (chat interrupt / session teardown); the worker is terminated and the
 *   run resolves `ok: false`
 */
export function runUiScript({
  script,
  dispatchCall,
  createWorker = createUiScriptWorker,
  timeoutMs = DEFAULT_UI_SCRIPT_TIMEOUT_MS,
  maxCalls = DEFAULT_MAX_UI_CALLS_PER_SCRIPT,
  registerAbort,
}: {
  script: string;
  dispatchCall: UiScriptDispatchCall;
  createWorker?: () => UiScriptWorkerLike;
  timeoutMs?: number;
  maxCalls?: number;
  registerAbort?: (abort: (reason: string) => void) => void;
}): Promise<UiScriptRunResult> {
  return new Promise((resolveRun) => {
    const logs: string[] = [];
    let callCount = 0;
    let remainingMs = timeoutMs;
    let timerStartedAt = 0;
    let timerId: ReturnType<typeof setTimeout> | undefined;
    let isSettled = false;

    const worker = createWorker();

    const clearTimer = () => {
      if (timerId !== undefined) {
        clearTimeout(timerId);
        timerId = undefined;
      }
    };

    const settle = (result: UiScriptRunResult) => {
      if (isSettled) {
        return;
      }
      isSettled = true;
      clearTimer();
      worker.terminate();
      resolveRun(result);
    };

    const armTimer = () => {
      timerStartedAt = Date.now();
      timerId = setTimeout(
        () => {
          settle({
            ok: false,
            error: `Script exceeded the ${timeoutMs}ms execution budget and was terminated.`,
            callCount,
            logs,
          });
        },
        Math.max(0, remainingMs)
      );
    };

    const pauseTimer = () => {
      if (timerId !== undefined) {
        remainingMs -= Date.now() - timerStartedAt;
        clearTimer();
      }
    };

    const handleOperationCall = async (message: {
      callId: number;
      operationName: string;
      input: unknown;
    }) => {
      callCount += 1;
      if (callCount > maxCalls) {
        settle({
          ok: false,
          error: `Script exceeded the ${maxCalls}-call budget and was terminated.`,
          callCount,
          logs,
        });
        return;
      }
      // Approval operations block on the user's accept/reject decision;
      // their wait must not burn the script's execution budget.
      const isApprovalCall =
        getUiOperationDescriptor(message.operationName)?.kind === "approval";
      if (isApprovalCall) {
        pauseTimer();
      }
      const result = await dispatchCall({
        operationName: message.operationName,
        input: message.input,
        callSequence: message.callId,
      });
      if (isApprovalCall && !isSettled) {
        armTimer();
      }
      if (!isSettled) {
        worker.postMessage({
          type: "callResult",
          callId: message.callId,
          result,
        });
      }
    };

    worker.addEventListener("message", (event: MessageEvent) => {
      const message = event.data as UiScriptMessageToMain;
      switch (message.type) {
        case "log":
          logs.push(message.message);
          break;
        case "done":
          settle({
            ok: true,
            returnValue: message.returnValue,
            callCount,
            logs,
          });
          break;
        case "failed":
          settle({ ok: false, error: message.error, callCount, logs });
          break;
        case "call":
          void handleOperationCall(message);
          break;
      }
    });

    registerAbort?.((reason) => {
      settle({ ok: false, error: reason, callCount, logs });
    });

    armTimer();
    worker.postMessage({ type: "run", script });
  });
}
