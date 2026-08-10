import { getToolOrDynamicToolName } from "ai";

import type { AgentToolCall } from "@phoenix/agent/extensions/toolRegistry";

import { isPendingClientToolCallPart } from "./chatUtils";
import type { AgentUIMessage } from "./types";

/**
 * Collect the tool calls a freshly seeded chat should re-dispatch to restore
 * pending approval state after a page load.
 *
 * Pending approval affordances (inline Accept/Reject cards, elicitation
 * prompts) live in in-memory store state created when the tool call was
 * dispatched during a live stream, so a refresh loses them even though the
 * unresolved call — id, name, and full input — is persisted in the
 * transcript. Re-dispatching those calls through the normal tool-call path
 * re-stages that state.
 *
 * Only the trailing assistant message is scanned (`addToolOutput` can only
 * resolve calls there, and older pending calls are repaired server-side), and
 * only tools whose registry definition declares `rehydratable` are returned —
 * re-dispatching a tool that executes on dispatch would re-run it on every
 * reload.
 */
export function collectRehydratableToolCalls({
  messages,
  isRehydratableTool,
}: {
  messages: AgentUIMessage[];
  /** Whether the named tool's dispatch is a pure approval-staging step. */
  isRehydratableTool: (toolName: string) => boolean;
}): AgentToolCall[] {
  const message = messages[messages.length - 1];
  if (!message || message.role !== "assistant") {
    return [];
  }
  return message.parts
    .filter((part) => isPendingClientToolCallPart(part))
    .filter((part) => isRehydratableTool(getToolOrDynamicToolName(part)))
    .map((part) => ({
      toolCallId: part.toolCallId,
      toolName: getToolOrDynamicToolName(part),
      input: part.input,
      // Validated structurally by isPendingClientToolCallPart; the SDK's
      // ProviderMetadata and the registry's phoenix namespace spell the same
      // wire shape.
      providerMetadata:
        part.callProviderMetadata as AgentToolCall["providerMetadata"],
    }));
}
