import type { z } from "zod";

import type { AgentCapabilityKey } from "@phoenix/agent/extensions/capabilities";
import type { AgentToolUIBehavior } from "@phoenix/agent/extensions/registry/defineTool";
import type { AgentClientActionResult } from "@phoenix/store/agentStore";

/**
 * How an operation affects app state, and therefore how the `execute_ui`
 * runtime treats it:
 * - `read` — returns data, no state change; scripts may call freely.
 * - `write` — mutates client state synchronously (e.g. set the time range).
 * - `approval` — stages a pending change whose promise resolves only after
 *   the user accepts or rejects it. The script runtime keeps awaiting (and
 *   pauses the script's wall-clock budget) until the user decides.
 */
export type UiOperationKind = "read" | "write" | "approval";

/**
 * Where an operation becomes available when its handler is not currently
 * mounted. Surfaced by `search_ui` and by not-mounted dispatch errors so the
 * agent can navigate instead of dead-ending.
 */
export type UiOperationAvailability = {
  /** Human/model-readable hint, e.g. "the Playground page (/playground)". */
  routeHint: string;
};

/**
 * The result every operation resolves with. `output` must be
 * JSON-serializable — it crosses the script worker's postMessage boundary
 * and is embedded in the `execute_ui` tool output.
 */
export type UiOperationResult = AgentClientActionResult;

/**
 * Per-call context handed to an operation handler by dispatch.
 *
 * `callId` uniquely identifies this invocation — approval operations use it
 * to key their pending-approval entries (the role the AI SDK `toolCallId`
 * played when each operation was its own tool call).
 */
export type UiOperationCallContext = {
  callId: string;
  sessionId: string | null;
};

/**
 * The self-describing catalog entry for one client-side operation.
 *
 * This is the single source of truth that replaces the three parallel
 * artifacts each tool used to keep in sync: the server-side JSON schema in
 * `src/phoenix/server/agents/capabilities/tools/external/<name>.py`, the
 * hand-rolled `parseInput` in `app/src/agent/tools/<name>/parsers.ts`, and
 * the `defineClientActionTool` config. The model-facing signature and the
 * runtime validator are both derived from `inputSchema`.
 */
export type UiOperationDescriptor<TSchema extends z.ZodType = z.ZodType> = {
  /**
   * Namespaced, dot-separated operation name (e.g. `timeRange.set`). The
   * namespace is the property path scripts use: `ui.timeRange.set(...)`.
   */
  name: string;
  /** Model-facing description; what used to live in the Python `DESCRIPTION`. */
  description: string;
  /** Zod schema for the operation input; the only schema definition anywhere. */
  inputSchema: TSchema;
  kind: UiOperationKind;
  /**
   * Marks an operation whose handler legitimately awaits completion of work
   * that can outlast the script's wall-clock budget (e.g. a playground run).
   * Like `approval`-kind calls, the budget pauses while the call is in
   * flight.
   */
  longRunning?: boolean;
  /** Capability keys that must be enabled for this operation to dispatch. */
  requiredCapabilities?: AgentCapabilityKey[];
  /** Whether an active agent session is required to dispatch. */
  requireSession?: boolean;
  /** Chat card rendering hints, keyed per inner operation call. */
  uiBehavior?: AgentToolUIBehavior;
  availability?: UiOperationAvailability;
  /** Fallback success output when the handler omits one. */
  defaultSuccessOutput?: string;
};

/**
 * The callable a mounted component registers for an operation. Receives
 * input already validated against the descriptor's `inputSchema`, plus the
 * per-call context. Approval handlers return a promise that stays pending
 * until the user accepts or rejects.
 */
export type UiOperationHandler<TInput> = (
  input: TInput,
  context: UiOperationCallContext
) => Promise<UiOperationResult>;

/**
 * Resolves an in-flight operation call. Approval binders receive this in
 * place of the retired `addToolOutput` sender: instead of writing tool
 * output for a dedicated tool call, accept/reject/cancel resolve the promise
 * the calling `execute_ui` script is awaiting.
 */
export type UiOperationResultEmitter = (result: UiOperationResult) => void;

/**
 * Narrow an unknown handler `context` argument to {@link UiOperationCallContext}.
 * Dispatch always constructs the context, so a mismatch means the handler was
 * invoked outside the operation dispatch path.
 */
export function parseUiOperationCallContext(
  context: unknown
): UiOperationCallContext | null {
  if (typeof context !== "object" || context === null) {
    return null;
  }
  const candidate = context as { callId?: unknown; sessionId?: unknown };
  if (typeof candidate.callId !== "string") {
    return null;
  }
  if (
    candidate.sessionId !== null &&
    candidate.sessionId !== undefined &&
    typeof candidate.sessionId !== "string"
  ) {
    return null;
  }
  return {
    callId: candidate.callId,
    sessionId: candidate.sessionId ?? null,
  };
}

/**
 * Identity helper that ties the descriptor's inferred input type to its
 * schema so `registerUiOperation` can enforce handler/schema agreement.
 */
export function defineUiOperation<TSchema extends z.ZodType>(
  descriptor: UiOperationDescriptor<TSchema>
): UiOperationDescriptor<TSchema> {
  return descriptor;
}
