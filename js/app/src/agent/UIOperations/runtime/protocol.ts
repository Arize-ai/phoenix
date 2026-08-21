import type { AgentClientActionResult } from "@phoenix/store/agentStore";

/**
 * Message protocol between the main-thread bridge and the `execute_browser_action`
 * script worker. Everything crossing the boundary goes through
 * `postMessage`'s structured clone, so payloads are restricted to plain JSON
 * — which the operation zod schemas already guarantee for inputs/outputs.
 */

/** Main thread → worker: start executing the script. Sent exactly once. */
export type UIScriptRunMessage = {
  type: "run";
  script: string;
  /**
   * Every operation name in the catalog, so the worker's `ui` proxy can
   * answer `in` and `Object.keys` truthfully. Without this the proxy
   * returned a callable for every property path, which made feature
   * detection silently lie (`typeof ui.anything === "function"`).
   */
  operationNames: string[];
};

/** Main thread → worker: the result of one proxied `ui.*` call. */
export type UIScriptCallResultMessage = {
  type: "callResult";
  callId: number;
  result: AgentClientActionResult;
};

export type UIScriptMessageToWorker =
  | UIScriptRunMessage
  | UIScriptCallResultMessage;

/** Worker → main thread: the script invoked `ui.<namespace>.<op>(input)`. */
export type UIScriptCallMessage = {
  type: "call";
  callId: number;
  operationName: string;
  input: unknown;
};

/** Worker → main thread: the script called `log(...)`. */
export type UIScriptLogMessage = {
  type: "log";
  message: string;
};

/** Worker → main thread: script finished; `returnValue` is JSON-serialized. */
export type UIScriptDoneMessage = {
  type: "done";
  returnValue: string;
};

/** Worker → main thread: script threw or failed to parse. */
export type UIScriptFailedMessage = {
  type: "failed";
  error: string;
};

export type UIScriptMessageToMain =
  | UIScriptCallMessage
  | UIScriptLogMessage
  | UIScriptDoneMessage
  | UIScriptFailedMessage;
