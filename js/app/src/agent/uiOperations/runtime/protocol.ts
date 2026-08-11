import type { AgentClientActionResult } from "@phoenix/store/agentStore";

/**
 * Message protocol between the main-thread bridge and the `execute_ui`
 * script worker. Everything crossing the boundary goes through
 * `postMessage`'s structured clone, so payloads are restricted to plain JSON
 * — which the operation zod schemas already guarantee for inputs/outputs.
 */

/** Main thread → worker: start executing the script. Sent exactly once. */
export type UiScriptRunMessage = {
  type: "run";
  script: string;
};

/** Main thread → worker: the result of one proxied `ui.*` call. */
export type UiScriptCallResultMessage = {
  type: "callResult";
  callId: number;
  result: AgentClientActionResult;
};

export type UiScriptMessageToWorker =
  | UiScriptRunMessage
  | UiScriptCallResultMessage;

/** Worker → main thread: the script invoked `ui.<namespace>.<op>(input)`. */
export type UiScriptCallMessage = {
  type: "call";
  callId: number;
  operationName: string;
  input: unknown;
};

/** Worker → main thread: the script called `log(...)`. */
export type UiScriptLogMessage = {
  type: "log";
  message: string;
};

/** Worker → main thread: script finished; `returnValue` is JSON-serialized. */
export type UiScriptDoneMessage = {
  type: "done";
  returnValue: string;
};

/** Worker → main thread: script threw or failed to parse. */
export type UiScriptFailedMessage = {
  type: "failed";
  error: string;
};

export type UiScriptMessageToMain =
  | UiScriptCallMessage
  | UiScriptLogMessage
  | UiScriptDoneMessage
  | UiScriptFailedMessage;
