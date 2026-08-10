import type { z } from "zod";

import type { AgentCapabilityKey } from "@phoenix/agent/extensions/capabilities";
import type { AgentToolUIBehavior } from "@phoenix/agent/extensions/registry/defineTool";
import type { AgentClientActionResult } from "@phoenix/store/agentStore";

/**
 * How an operation affects app state, and therefore how the `execute_ui`
 * runtime treats it:
 * - `read` — returns data, no state change; scripts may call freely.
 * - `write` — mutates client state synchronously (e.g. set the time range).
 * - `approval` — stages a pending change that resolves only after the user
 *   accepts or rejects it. The script runtime suspends the calling script
 *   (and pauses its wall-clock budget) until the user decides.
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
 * The self-describing catalog entry for one client-side operation.
 *
 * This is the single source of truth that replaces today's three parallel
 * artifacts per tool: the server-side JSON schema in
 * `src/phoenix/server/agents/capabilities/tools/external/<name>.py`, the
 * hand-rolled `parseInput` in `app/src/agent/tools/<name>/parsers.ts`, and the
 * `defineClientActionTool` config. The model-facing JSON schema and the
 * runtime validator are both derived from `inputSchema`.
 */
export type UiOperationDescriptor<TSchema extends z.ZodType = z.ZodType> = {
  /**
   * Namespaced, dot-separated operation name (e.g. `timeRange.set`). The
   * namespace is the property path scripts use: `ui.timeRange.set(...)`.
   */
  name: string;
  /** Model-facing description; what today lives in the Python `DESCRIPTION`. */
  description: string;
  /** Zod schema for the operation input; the only schema definition anywhere. */
  inputSchema: TSchema;
  kind: UiOperationKind;
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
 * The callable a mounted component registers for an operation. Receives input
 * already validated against the descriptor's `inputSchema`.
 */
export type UiOperationHandler<TInput> = (
  input: TInput
) => Promise<AgentClientActionResult>;

/**
 * Identity helper that ties the descriptor's inferred input type to its
 * schema so `registerUiOperation` can enforce handler/schema agreement.
 */
export function defineUiOperation<TSchema extends z.ZodType>(
  descriptor: UiOperationDescriptor<TSchema>
): UiOperationDescriptor<TSchema> {
  return descriptor;
}
