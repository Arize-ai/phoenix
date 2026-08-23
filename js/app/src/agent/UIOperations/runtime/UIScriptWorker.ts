import { maskNonCode } from "./maskNonCode";
import type {
  UIScriptMessageToMain,
  UIScriptMessageToWorker,
} from "./protocol";

/**
 * Dedicated-worker entry point for `execute_browser_action` scripts.
 *
 * The worker realm is the *execution* boundary, not a security boundary: it
 * has no DOM, no zustand, no Relay, and (after the hygiene pass below) no
 * network — so the only capability a script has is the `ui` proxy, whose
 * every call round-trips through the main-thread dispatch where validation,
 * capability gates, and approval staging live. The main thread can hard-kill
 * a runaway script at any time with `worker.terminate()`.
 */

/**
 * Typed view over the worker global. The app tsconfig ships the DOM lib (no
 * `DedicatedWorkerGlobalScope`), so the narrow surface this file uses is
 * declared by hand instead of pulling in the WebWorker lib for one module.
 */
type UIScriptWorkerScope = {
  addEventListener(
    type: "message",
    listener: (event: MessageEvent) => void
  ): void;
  postMessage(message: UIScriptMessageToMain): void;
};

const workerScope = globalThis as unknown as UIScriptWorkerScope;

/**
 * Private postMessage used by this module after the guest-visible binding is
 * shadowed. Captured at load — before any script runs — so forged
 * `done` / `log` / `call` frames cannot ride the real channel.
 */
const postMessageToMain: UIScriptWorkerScope["postMessage"] =
  workerScope.postMessage.bind(workerScope);

/**
 * Globals removed before the script runs so the `ui` bridge is the worker's
 * only capability. Defense-in-depth, not a sandbox guarantee: a same-origin
 * worker is not a security boundary, and PXI scripts already run at user
 * trust level — this just makes "everything flows through dispatch" true in
 * practice.
 *
 * The messaging names are shadowed *after* this module registers its
 * `message` listener and binds `postMessageToMain`. Guest scripts otherwise
 * keep `postMessage` (forge protocol frames) and `dispatchEvent` (inject a
 * synthetic `callResult` into that listener).
 */
export const BLOCKED_GLOBAL_NAMES = [
  "fetch",
  "XMLHttpRequest",
  "WebSocket",
  "EventSource",
  "WebTransport",
  "BroadcastChannel",
  "importScripts",
  "indexedDB",
  "caches",
  "navigator",
  "Worker",
  "SharedWorker",
  "postMessage",
  "onmessage",
  "onmessageerror",
  "addEventListener",
  "removeEventListener",
  "dispatchEvent",
  "close",
] as const;

/**
 * Remove globals from the entire prototype chain of `globalThis`, then shadow
 * them as own properties.
 *
 * Shadowing `globalThis` alone is not enough: per WebIDL, interface
 * *operations* (`fetch`, `importScripts`) and *attributes* (`navigator`,
 * `indexedDB`, `caches`) live on `WorkerGlobalScope.prototype`, not on the
 * global object — an own-property shadow leaves them recoverable via
 * `Object.getPrototypeOf(globalThis)`. WebIDL interface members are
 * configurable, so they can be deleted outright at each chain level; the
 * non-configurable own-property shadow then covers anything an engine keeps
 * (or adds in future) as an own property of the global.
 */
export function removeGlobalsEverywhere(names: readonly string[]): void {
  const prototypeChain: object[] = [];
  for (
    let level: object | null = Object.getPrototypeOf(globalThis);
    level != null;
    level = Object.getPrototypeOf(level)
  ) {
    prototypeChain.push(level);
  }
  for (const globalName of names) {
    for (const level of prototypeChain) {
      try {
        Reflect.deleteProperty(level, globalName);
      } catch {
        // Non-configurable in some engines; the shadow below still covers it.
      }
    }
    try {
      Object.defineProperty(globalThis, globalName, {
        value: undefined,
        configurable: false,
        writable: false,
      });
    } catch {
      // Some globals are non-configurable in some engines; best effort.
    }
  }
}

function removeBlockedGlobals() {
  removeGlobalsEverywhere(BLOCKED_GLOBAL_NAMES);
}

/** Resolvers for in-flight `ui.*` calls, keyed by callId. */
const pendingCalls = new Map<number, (result: unknown) => void>();
let nextCallId = 1;

function postOperationCall(operationName: string, input: unknown) {
  return new Promise((resolve) => {
    const callId = nextCallId++;
    pendingCalls.set(callId, resolve);
    postMessageToMain({ type: "call", callId, operationName, input });
  });
}

/**
 * Build the `ui` object as nested proxies so any property path terminates in
 * a callable: `ui.timeRange.set(input)` posts a call for `"timeRange.set"`.
 * Unknown names are deliberately let through — the main-thread dispatch
 * rejects them with a did-you-mean error the model can act on, which beats a
 * bare `undefined is not a function` inside the script.
 */
function createUIProxy(): unknown {
  const buildNode = (path: string[]): unknown =>
    new Proxy(function () {}, {
      get: (_target, property) =>
        typeof property === "string"
          ? buildNode([...path, property])
          : undefined,
      apply: (_target, _thisArg, args) =>
        postOperationCall(path.join("."), args[0]),
    });
  return buildNode([]);
}

function serializeReturnValue(value: unknown): string {
  if (value === undefined) {
    return "undefined";
  }
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    // JSON.stringify only throws for cyclic/BigInt values; don't guess at a
    // stringification, just say so.
    return "[unserializable return value]";
  }
}

function describeError(error: unknown): string {
  return error instanceof Error
    ? `${error.name}: ${error.message}`
    : String(error);
}

const DYNAMIC_IMPORT_PATTERN = /\bimport\s*[.(]/;

/**
 * Dynamic `import()` and `import.meta` are syntax, not properties, so
 * `removeBlockedGlobals` cannot reach them: `import("https://host/?" + data)`
 * would issue a network request that bypasses the `ui` bridge's audit trail
 * even if the module never loads. Reject any script that references them
 * before compiling, so the only route out of this realm stays the bridge.
 * (Static `import ... from` is already a SyntaxError inside `new Function`.)
 *
 * The scan runs on masked source (see `maskNonCode`), so comments and string
 * contents neither smuggle an import past the check (`import∕**∕(`) nor trip
 * it as data (`"import("`, `importlib.reload`).
 *
 * Residual bypass by construction: `eval("import(...)")` and
 * `new Function("return import(...)")()` carry the payload as runtime data
 * and no source scan can see it — `Function` cannot be removed while the
 * realm holds any function object. Closing that hole needs a network-layer
 * control, which is why the worker script response carries a CSP of
 * `script-src 'unsafe-eval'; connect-src 'none'` in production builds.
 */
export function referencesDynamicImport(script: string): boolean {
  return DYNAMIC_IMPORT_PATTERN.test(maskNonCode(script));
}

async function evaluateUIScript(script: string) {
  removeBlockedGlobals();
  const ui = createUIProxy();
  const log = (message: unknown) => {
    postMessageToMain({ type: "log", message: String(message) });
  };
  // The script body may `await` ui calls and `return` a final value. Dynamic
  // evaluation is the point of this worker: the agent-authored script is data
  // arriving at runtime, and this realm holds nothing but the `ui` bridge.
  // Compilation gets its own failure message: a script that does not parse
  // must fail loudly and immediately (not escape as an unhandled rejection
  // and burn the whole execution budget in silence), and "failed to parse"
  // tells the model to fix its syntax rather than re-issue the script.
  if (referencesDynamicImport(script)) {
    postMessageToMain({
      type: "failed",
      error:
        "The script uses `import`, which is not available in execute_browser_action — " +
        "reach the outside world only through `ui.*` operations.",
    });
    return;
  }
  let runner: (ui: unknown, log: (message: unknown) => void) => unknown;
  try {
    // eslint-disable-next-line @typescript-eslint/no-implied-eval
    runner = new Function(
      "ui",
      "log",
      `"use strict"; return (async () => {\n${script}\n})();`
    ) as typeof runner;
  } catch (error) {
    postMessageToMain({
      type: "failed",
      error: `The script failed to parse — fix the syntax and retry. ${describeError(error)}`,
    });
    return;
  }
  try {
    const returnValue: unknown = await runner(ui, log);
    postMessageToMain({
      type: "done",
      returnValue: serializeReturnValue(returnValue),
    });
  } catch (error) {
    postMessageToMain({
      type: "failed",
      error: describeError(error),
    });
  }
}

workerScope.addEventListener("message", (event: MessageEvent) => {
  const message = event.data as UIScriptMessageToWorker;
  if (message.type === "run") {
    void evaluateUIScript(message.script);
    return;
  }
  if (message.type === "callResult") {
    const resolve = pendingCalls.get(message.callId);
    if (resolve != null) {
      pendingCalls.delete(message.callId);
      resolve(message.result);
    }
  }
});
