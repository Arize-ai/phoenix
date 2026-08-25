import type { AgentClientActionResult } from "@phoenix/store/agentStore";

/**
 * Message protocol between the main-thread bridge and the `execute_browser_action`
 * script worker. Everything crossing the boundary goes through
 * `postMessage`'s structured clone, so payloads are restricted to plain JSON
 * — which the operation zod schemas already guarantee for inputs/outputs.
 */

/** Main thread → worker: start executing the script. Sent exactly once. */
export type JSSandboxRunMessage = {
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
export type JSSandboxCallResultMessage = {
  type: "callResult";
  callId: number;
  result: AgentClientActionResult;
};

export type JSSandboxMessageToWorker =
  | JSSandboxRunMessage
  | JSSandboxCallResultMessage;

/** Worker → main thread: the script invoked `ui.<namespace>.<op>(input)`. */
export type JSSandboxCallMessage = {
  type: "call";
  callId: number;
  operationName: string;
  input: unknown;
};

/** Worker → main thread: the script called `log(...)`. */
export type JSSandboxLogMessage = {
  type: "log";
  message: string;
};

/** Worker → main thread: script finished; `returnValue` is JSON-serialized. */
export type JSSandboxDoneMessage = {
  type: "done";
  returnValue: string;
};

/** Worker → main thread: script threw or failed to parse. */
export type JSSandboxFailedMessage = {
  type: "failed";
  error: string;
};

export type JSSandboxMessageToMain =
  | JSSandboxCallMessage
  | JSSandboxLogMessage
  | JSSandboxDoneMessage
  | JSSandboxFailedMessage;
