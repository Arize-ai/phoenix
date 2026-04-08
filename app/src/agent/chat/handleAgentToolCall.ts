import type { Chat } from "@ai-sdk/react";
import type { UIMessage } from "ai";

/**
 * For the workflow to add, edit, or remove a frontend tool, see
 * `.agents/skills/phoenix-pxi/rules/extending-frontend-tool-registry.md`.
 */
import {
  handleRegisteredAgentToolCall,
  type AgentToolCall,
} from "@phoenix/agent/extensions/toolRegistry";
import type { AgentStore } from "@phoenix/store/agentStore";

type AddToolOutput = Chat<UIMessage>["addToolOutput"];

/** Arguments needed to forward one tool call into the frontend registry. */
type HandleAgentToolCallOptions = {
  toolCall: AgentToolCall;
  sessionId: string | null;
  addToolOutput: AddToolOutput;
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
  agentStore,
}: HandleAgentToolCallOptions) {
  await handleRegisteredAgentToolCall({
    toolCall,
    sessionId,
    addToolOutput,
    agentStore,
  });
}
