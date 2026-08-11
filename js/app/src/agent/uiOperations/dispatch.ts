import { z } from "zod";

import type { AgentCapabilities } from "@phoenix/agent/extensions/capabilities";
import type { AgentStore } from "@phoenix/store/agentStore";

import {
  getMountedUiOperationHandler,
  getUiOperationDescriptor,
  suggestUiOperationNames,
} from "./catalog";
import type { UiOperationCallContext, UiOperationResult } from "./types";

/** Everything dispatch needs from the enclosing `execute_ui` tool call. */
export type UiOperationDispatchContext = {
  agentStore: AgentStore;
  sessionId: string | null;
  capabilities: AgentCapabilities;
};

/**
 * Execute one operation call on behalf of a running `execute_ui` script.
 *
 * This is the single choke point every scripted effect flows through:
 * catalog lookup → capability gate → session gate → mounted check → schema
 * validation → handler invocation. It is the relocated core of the retired
 * `defineClientActionTool` execute path, run once per `ui.*` call instead of
 * once per tool call.
 *
 * Every failure mode returns an actionable `{ ok: false }` result (never
 * throws), so the calling script can branch on errors and the model can
 * recover — e.g. by calling `search_ui` after an unknown-operation error.
 */
export async function dispatchUiOperationCall({
  operationName,
  input,
  callId,
  agentStore,
  sessionId,
  capabilities,
}: {
  operationName: string;
  input: unknown;
  /**
   * Unique id for this invocation, `<executeUiToolCallId>:<sequence>`.
   * Approval handlers key their pending-approval entries by it, and
   * interrupt cleanup cancels pending entries by tool-call-id prefix.
   */
  callId: string;
} & UiOperationDispatchContext): Promise<UiOperationResult> {
  const descriptor = getUiOperationDescriptor(operationName);
  if (descriptor == null) {
    const suggestions = suggestUiOperationNames(operationName).join(", ");
    return {
      ok: false,
      error:
        `Unknown operation "${operationName}". Known operations: ${suggestions}. ` +
        "Use search_ui to discover operations and their signatures.",
    };
  }

  const missingCapability = (descriptor.requiredCapabilities ?? []).find(
    (capability) => !capabilities[capability]
  );
  if (missingCapability != null) {
    return {
      ok: false,
      error: `Operation "${operationName}" requires the disabled capability "${missingCapability}".`,
    };
  }

  if (descriptor.requireSession && sessionId == null) {
    return {
      ok: false,
      error: `Operation "${operationName}" requires an active session.`,
    };
  }

  const handler = getMountedUiOperationHandler(agentStore, operationName);
  if (handler == null) {
    const routeHint = descriptor.availability?.routeHint;
    return {
      ok: false,
      error:
        `Operation "${operationName}" is not available on the current page` +
        (routeHint ? `; it requires ${routeHint}.` : "."),
    };
  }

  const parsed = descriptor.inputSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: `Invalid input for "${operationName}": ${z.prettifyError(parsed.error)}`,
    };
  }

  const context: UiOperationCallContext = { callId, sessionId };

  try {
    const result = await handler(parsed.data, context);
    if (result.ok && result.output == null) {
      return { ok: true, output: descriptor.defaultSuccessOutput ?? "Done." };
    }
    return result;
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}
