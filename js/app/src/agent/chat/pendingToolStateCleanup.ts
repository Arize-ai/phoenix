import { getToolName, isToolUIPart, type UIMessage } from "ai";

import { ASK_USER_TOOL_NAME } from "@phoenix/agent/tools/elicit";
import {
  abortActiveJSSandboxRun,
  EXECUTE_BROWSER_ACTION_TOOL_NAME,
} from "@phoenix/agent/uiOperations/executeBrowserActionTool";
import type { AgentState } from "@phoenix/store/agentStore";

type PendingToolStateCleanup = (state: AgentState, toolCallId: string) => void;

/**
 * Cleans up everything an interrupted or dropped `execute_browser_action` call owns:
 * aborts the script run (terminating its worker) or its parked whole-script
 * approval, then clears the staged script-approval entry.
 */
function cleanupExecuteBrowserActionToolState(
  state: AgentState,
  toolCallId: string
): void {
  abortActiveJSSandboxRun({
    toolCallId,
    reason: "The script run was interrupted.",
  });
  // Usually a no-op: a locally parked approval is already cleared by the
  // abort above. This also covers entries whose abort callback is gone.
  state.setPendingScriptApproval(toolCallId, null);
}

/**
 * Registry mapping tool names to the store action that cleans up the pending
 * approval/edit state their tool call owns. Tools that stage approval state
 * in the agent store must register a cleanup here so interrupted or dropped
 * tool calls don't leave dangling Accept/Reject affordances.
 *
 * The playground/evaluator approval tools that used to register here now run
 * as `execute_browser_action` operations covered by one whole-script approval.
 */
const PENDING_TOOL_STATE_CLEANUP: Readonly<
  Record<string, PendingToolStateCleanup>
> = {
  [ASK_USER_TOOL_NAME]: (state, toolCallId) => {
    for (const [sessionId, pending] of Object.entries(
      state.pendingElicitationBySessionId
    )) {
      if (pending.toolCallId === toolCallId) {
        state.setPendingElicitation(sessionId, null);
      }
    }
  },
  [EXECUTE_BROWSER_ACTION_TOOL_NAME]: cleanupExecuteBrowserActionToolState,
};

/**
 * The subset of registered tools whose pending state is cleaned up when a
 * rewind or branch drops their tool calls from the transcript.
 */
export const REWIND_CLEANUP_TOOL_NAMES: ReadonlySet<string> = new Set([
  EXECUTE_BROWSER_ACTION_TOOL_NAME,
]);

/**
 * Cleans up any pending approval/edit store state owned by the given tool
 * call. No-op for tools without registered pending state.
 */
export function cleanupPendingToolState(
  state: AgentState,
  tool: string,
  toolCallId: string
): void {
  PENDING_TOOL_STATE_CLEANUP[tool]?.(state, toolCallId);
}

const RESOLVED_TOOL_STATES: ReadonlySet<string> = new Set([
  "output-available",
  "output-error",
  "output-denied",
]);

/**
 * Cleans up pending approval/edit store state owned by tool calls the
 * transcript shows as resolved. Applied when a synced transcript replaces
 * local messages: another client may have resolved — or interrupted — a tool
 * call this client is still rendering an Accept/Reject affordance for, and
 * that affordance must not outlive the call's persisted terminal state.
 * Pending calls the transcript still shows as unresolved are left alone.
 */
export function cleanupResolvedPendingToolState(
  state: AgentState,
  messages: readonly UIMessage[]
): void {
  for (const message of messages) {
    if (message.role !== "assistant") {
      continue;
    }
    for (const part of message.parts) {
      if (!isToolUIPart(part) || !RESOLVED_TOOL_STATES.has(part.state)) {
        continue;
      }
      cleanupPendingToolState(state, getToolName(part), part.toolCallId);
    }
  }
}
