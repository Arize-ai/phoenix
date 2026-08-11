import { getToolName, isToolUIPart, type UIMessage } from "ai";

import { BATCH_SPAN_ANNOTATE_TOOL_NAME } from "@phoenix/agent/tools/batchSpanAnnotate";
import { ASK_USER_TOOL_NAME } from "@phoenix/agent/tools/elicit";
import { EXECUTE_UI_TOOL_NAME } from "@phoenix/agent/uiOperations/executeUiAgentTool";
import { abortActiveUiScriptRun } from "@phoenix/agent/uiOperations/executeUiAgentTool";
import type { AgentState } from "@phoenix/store/agentStore";

type PendingToolStateCleanup = (state: AgentState, toolCallId: string) => void;

/**
 * The approval pending-state maps that `execute_ui` script calls can write.
 * Entries are keyed by the inner operation call id
 * (`<executeUiToolCallId>:<sequence>`), so cleanup for an `execute_ui` tool
 * call clears every entry whose key carries that tool call's prefix.
 */
const EXECUTE_UI_PENDING_MAP_CLEANERS: ReadonlyArray<{
  getKeys: (state: AgentState) => string[];
  clear: (state: AgentState, key: string) => void;
}> = [
  {
    getKeys: (state) => Object.keys(state.pendingPromptEditsByToolCallId),
    clear: (state, key) => state.setPendingPromptEdit(key, null),
  },
  {
    getKeys: (state) =>
      Object.keys(state.pendingPromptInstanceRemovalsByToolCallId),
    clear: (state, key) => state.setPendingPromptInstanceRemoval(key, null),
  },
  {
    getKeys: (state) => Object.keys(state.pendingPromptToolWritesByToolCallId),
    clear: (state, key) => state.setPendingPromptToolWrite(key, null),
  },
  {
    getKeys: (state) => Object.keys(state.pendingSavePromptsByToolCallId),
    clear: (state, key) => state.setPendingSavePrompt(key, null),
  },
  {
    getKeys: (state) =>
      Object.keys(state.pendingCodeEvaluatorEditsByToolCallId),
    clear: (state, key) => state.setPendingCodeEvaluatorEdit(key, null),
  },
  {
    getKeys: (state) => Object.keys(state.pendingLlmEvaluatorEditsByToolCallId),
    clear: (state, key) => state.setPendingLlmEvaluatorEdit(key, null),
  },
  {
    getKeys: (state) => Object.keys(state.pendingLoadDatasetsByToolCallId),
    clear: (state, key) => state.setPendingLoadDataset(key, null),
  },
];

/**
 * Cleans up everything an interrupted or dropped `execute_ui` call owns:
 * aborts the script run (terminating its worker) and clears any pending
 * approval entries its inner operation calls staged.
 */
function cleanupExecuteUiToolState(
  state: AgentState,
  toolCallId: string
): void {
  abortActiveUiScriptRun({
    toolCallId,
    reason: "The script run was interrupted.",
  });
  const childKeyPrefix = `${toolCallId}:`;
  for (const cleaner of EXECUTE_UI_PENDING_MAP_CLEANERS) {
    for (const key of cleaner.getKeys(state)) {
      if (key.startsWith(childKeyPrefix)) {
        cleaner.clear(state, key);
      }
    }
  }
}

/**
 * Registry mapping tool names to the store action that cleans up the pending
 * approval/edit state their tool call owns. Tools that stage approval state
 * in the agent store must register a cleanup here so interrupted or dropped
 * tool calls don't leave dangling Accept/Reject affordances.
 *
 * The playground/evaluator approval tools that used to register here now run
 * as `execute_ui` operations; their pending state is keyed by inner call id
 * and cleaned by the `execute_ui` entry.
 */
const PENDING_TOOL_STATE_CLEANUP: Readonly<
  Record<string, PendingToolStateCleanup>
> = {
  [BATCH_SPAN_ANNOTATE_TOOL_NAME]: (state, toolCallId) =>
    state.setPendingBatchSpanAnnotate(toolCallId, null),
  [ASK_USER_TOOL_NAME]: (state, toolCallId) => {
    for (const [sessionId, pending] of Object.entries(
      state.pendingElicitationBySessionId
    )) {
      if (pending.toolCallId === toolCallId) {
        state.setPendingElicitation(sessionId, null);
      }
    }
  },
  [EXECUTE_UI_TOOL_NAME]: cleanupExecuteUiToolState,
};

/**
 * The subset of registered tools whose pending state is cleaned up when a
 * rewind or branch drops their tool calls from the transcript.
 */
export const REWIND_CLEANUP_TOOL_NAMES: ReadonlySet<string> = new Set([
  BATCH_SPAN_ANNOTATE_TOOL_NAME,
  EXECUTE_UI_TOOL_NAME,
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
