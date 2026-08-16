import { getToolName, isToolUIPart, type UIMessage } from "ai";

import { BATCH_SPAN_ANNOTATE_TOOL_NAME } from "@phoenix/agent/tools/batchSpanAnnotate";
import { EDIT_CODE_EVALUATOR_DRAFT_TOOL_NAME } from "@phoenix/agent/tools/codeEvaluatorDraft";
import { ASK_USER_TOOL_NAME } from "@phoenix/agent/tools/elicit";
import { EDIT_LLM_EVALUATOR_DRAFT_TOOL_NAME } from "@phoenix/agent/tools/llmEvaluatorDraft";
import { LOAD_DATASET_TOOL_NAME } from "@phoenix/agent/tools/playgroundLoadDataset";
import {
  EDIT_PROMPT_TOOL_NAME,
  REMOVE_PROMPT_INSTANCE_TOOL_NAME,
} from "@phoenix/agent/tools/playgroundPrompt";
import { WRITE_PROMPT_TOOLS_TOOL_NAME } from "@phoenix/agent/tools/playgroundPromptTools";
import { SAVE_PROMPT_TOOL_NAME } from "@phoenix/agent/tools/playgroundSavePrompt";
import type { AgentState } from "@phoenix/store/agentStore";

type PendingToolStateCleanup = (state: AgentState, toolCallId: string) => void;

/**
 * Registry mapping tool names to the store action that cleans up the pending
 * approval/edit state their tool call owns. Tools that stage approval state
 * in the agent store must register a cleanup here so interrupted or dropped
 * tool calls don't leave dangling Accept/Reject affordances.
 */
const PENDING_TOOL_STATE_CLEANUP: Readonly<
  Record<string, PendingToolStateCleanup>
> = {
  [EDIT_PROMPT_TOOL_NAME]: (state, toolCallId) =>
    state.setPendingPromptEdit(toolCallId, null),
  [REMOVE_PROMPT_INSTANCE_TOOL_NAME]: (state, toolCallId) =>
    state.setPendingPromptInstanceRemoval(toolCallId, null),
  [BATCH_SPAN_ANNOTATE_TOOL_NAME]: (state, toolCallId) =>
    state.setPendingBatchSpanAnnotate(toolCallId, null),
  [WRITE_PROMPT_TOOLS_TOOL_NAME]: (state, toolCallId) =>
    state.setPendingPromptToolWrite(toolCallId, null),
  [SAVE_PROMPT_TOOL_NAME]: (state, toolCallId) =>
    state.setPendingSavePrompt(toolCallId, null),
  [EDIT_CODE_EVALUATOR_DRAFT_TOOL_NAME]: (state, toolCallId) =>
    state.setPendingCodeEvaluatorEdit(toolCallId, null),
  [EDIT_LLM_EVALUATOR_DRAFT_TOOL_NAME]: (state, toolCallId) =>
    state.setPendingLlmEvaluatorEdit(toolCallId, null),
  [LOAD_DATASET_TOOL_NAME]: (state, toolCallId) =>
    state.setPendingLoadDataset(toolCallId, null),
  [ASK_USER_TOOL_NAME]: (state, toolCallId) => {
    for (const [sessionId, pending] of Object.entries(
      state.pendingElicitationBySessionId
    )) {
      if (pending.toolCallId === toolCallId) {
        state.setPendingElicitation(sessionId, null);
      }
    }
  },
};

/**
 * The subset of registered tools whose pending state is cleaned up when a
 * rewind or branch drops their tool calls from the transcript.
 *
 * Note: this is intentionally narrower than the interrupt path (which cleans
 * up every registered tool) to preserve pre-refactor behavior — save-prompt,
 * evaluator-draft, and load-dataset pending state was never cleaned up on
 * rewind/branch, only on interrupt.
 */
export const REWIND_CLEANUP_TOOL_NAMES: ReadonlySet<string> = new Set([
  EDIT_PROMPT_TOOL_NAME,
  REMOVE_PROMPT_INSTANCE_TOOL_NAME,
  BATCH_SPAN_ANNOTATE_TOOL_NAME,
  WRITE_PROMPT_TOOLS_TOOL_NAME,
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
