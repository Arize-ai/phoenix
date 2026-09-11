import type { AgentUIMessagePart } from "@phoenix/agent/chat/types";
import type { AddToolOutput } from "@phoenix/agent/extensions/registry/defineTool";
/**
 * For the workflow to add, edit, or remove a PXI tool, see the `defineTool`
 * helper in
 * `@phoenix/agent/extensions/registry` and the registry aggregator in
 * `@phoenix/agent/extensions/toolRegistry`.
 */
import {
  handleRegisteredAgentToolCall,
  type AgentToolCall,
} from "@phoenix/agent/extensions/toolRegistry";
import type { AgentStore } from "@phoenix/store/agentStore";

type AppendMessagePart = (part: AgentUIMessagePart) => void;

/** Arguments needed to forward one tool call into the frontend registry. */
type HandleAgentToolCallOptions = {
  toolCall: AgentToolCall;
  sessionId: string | null;
  addToolOutput: AddToolOutput;
  appendMessagePart: AppendMessagePart;
  /**
   * The agent store instance, needed by tools that interact with shared UI
   * state (e.g. the elicit tool sets a pending elicitation).
   */
  agentStore: AgentStore;
};

/**
 * Thin adapter between the AI SDK runtime and the registry-backed tool layer.
 */
export async function handleAgentToolCall({
  toolCall,
  sessionId,
  addToolOutput,
  appendMessagePart,
  agentStore,
}: HandleAgentToolCallOptions) {
  await handleRegisteredAgentToolCall({
    toolCall,
    sessionId,
    addToolOutput,
    appendMessagePart,
    agentStore,
  });
}
