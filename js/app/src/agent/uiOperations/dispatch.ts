import { z } from "zod";

import type { AgentCapabilities } from "@phoenix/agent/extensions/capabilities";
import type { AgentStore } from "@phoenix/store/agentStore";

import {
  getMountedUIOperationHandler,
  getUIOperationDescriptor,
  suggestUIOperationNames,
} from "./catalog";
import { isOperationCallApprovalGranted } from "./scriptApprovalGrant";
import type { UIOperationCallContext, UIOperationResult } from "./types";

/** Everything dispatch needs from the enclosing `execute_browser_action` tool call. */
export type UIOperationDispatchContext = {
  agentStore: AgentStore;
  sessionId: string | null;
  capabilities: AgentCapabilities;
};

/**
 * Execute one operation call on behalf of a running `execute_browser_action` script.
 *
 * This is the single choke point every scripted effect flows through:
 * catalog lookup → capability gate → session gate → mounted check → schema
 * validation → script-approval gate → handler invocation. It is the relocated core of the retired
 * `defineClientActionTool` execute path, run once per `ui.*` call instead of
 * once per tool call.
 *
 * Every failure mode returns an actionable `{ ok: false }` result (never
 * throws), so the calling script can branch on errors and the model can
 * recover — e.g. by calling `search_browser_actions` after an unknown-operation error.
 */
export async function dispatchUIOperationCall({
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
   * Unique id for this invocation, `<executeBrowserActionToolCallId>:<sequence>`.
   * Approval handlers key their pending-approval entries by it, and
   * interrupt cleanup cancels pending entries by tool-call-id prefix.
   */
  callId: string;
} & UIOperationDispatchContext): Promise<UIOperationResult> {
  const descriptor = getUIOperationDescriptor(operationName);
  if (descriptor == null) {
    const suggestions = suggestUIOperationNames(operationName).join(", ");
    return {
      ok: false,
      code: "UNKNOWN_OPERATION",
      error:
        `Unknown operation "${operationName}". Did you mean: ${suggestions}? ` +
        "Use search_browser_actions to discover operations and their signatures.",
    };
  }

  const missingCapability = (descriptor.requiredCapabilities ?? []).find(
    (capability) => !capabilities[capability]
  );
  if (missingCapability != null) {
    return {
      ok: false,
      code: "CAPABILITY_DISABLED",
      error: `Operation "${operationName}" requires the disabled capability "${missingCapability}".`,
    };
  }

  if (descriptor.requireSession && sessionId == null) {
    return {
      ok: false,
      code: "NO_SESSION",
      error: `Operation "${operationName}" requires an active session.`,
    };
  }

  const handler = getMountedUIOperationHandler(agentStore, operationName);
  if (handler == null) {
    const routeHint = descriptor.availability?.routeHint;
    return {
      ok: false,
      code: "NOT_AVAILABLE",
      error:
        `Operation "${operationName}" is not available on the current page` +
        (routeHint ? `; it requires ${routeHint}.` : ".") +
        " Use ui.navigation.goTo({ path, reason }) to ask the user to go" +
        " there, then retry.",
    };
  }

  const parsed = descriptor.inputSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      code: "INVALID_INPUT",
      error: `Invalid input for "${operationName}": ${z.prettifyError(parsed.error)}`,
    };
  }

  // Script-level approval gate — the operation counterpart of phoenix-gql's
  // mutation policy. Reads are always free. State-changing operations (kind
  // `write` or `approval`) execute only with the user's consent: implicit in
  // bypass edit mode, and in manual edit mode granted when the user accepted
  // the enclosing script's `write_description` before the run. A
  // state-changing call from an unapproved script is refused with
  // instructions to re-issue — exactly how phoenix-gql refuses an unapproved
  // mutation — so omitting `write_description` never skips approval.
  if (
    descriptor.operationKind !== "read" &&
    agentStore.getState().permissions.edits === "manual" &&
    !isOperationCallApprovalGranted(callId)
  ) {
    return {
      ok: false,
      code: "APPROVAL_REQUIRED",
      error:
        `Operation "${operationName}" changes state and requires the user's ` +
        "approval, which this script did not request. Re-issue the " +
        "execute_browser_action call with a write_description describing the " +
        "changes the script will make, so the user can approve the script " +
        "before it runs.",
    };
  }

  const context: UIOperationCallContext = { callId, sessionId };

  try {
    const result = await handler(parsed.data, context);
    if (result.ok && result.output == null) {
      return { ok: true, output: descriptor.defaultSuccessOutput ?? "Done." };
    }
    return result;
  } catch (error) {
    return {
      ok: false,
      code: "HANDLER_ERROR",
      error: error instanceof Error ? error.message : String(error),
    };
  }
}
