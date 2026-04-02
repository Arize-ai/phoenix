import type { Chat } from "@ai-sdk/react";
import type { UIMessage } from "ai";

import { handleBashToolCall } from "@phoenix/agent/tools/bash/handleBashToolCall";
import { parseElicitToolInput } from "@phoenix/agent/tools/elicit";
import type { AgentStore } from "@phoenix/store/agentStore";

type AddToolOutput = Chat<UIMessage>["addToolOutput"];

type HandleAgentToolCallOptions = {
  toolCall: {
    toolCallId: string;
    toolName: string;
    input: unknown;
  };
  sessionId: string | null;
  addToolOutput: AddToolOutput;
  /**
   * The agent store instance, needed by tools that interact with shared UI
   * state (e.g. the elicit tool sets a pending elicitation).
   */
  agentStore: AgentStore;
};

/**
 * Dispatches an AI-SDK tool call to the appropriate client-side handler.
 *
 * Each tool registered in {@link agentToolDefinitions} must have a
 * corresponding case here. Unrecognised tool names produce an error
 * output so the model can self-correct.
 */
export async function handleAgentToolCall({
  toolCall,
  sessionId,
  addToolOutput,
  agentStore,
}: HandleAgentToolCallOptions) {
  switch (toolCall.toolName) {
    case "bash":
      await handleBashToolCall({
        toolCall,
        sessionId,
        addToolOutput,
      });
      return;
    case "ask_user":
      await handleAskUserToolCall({
        toolCall,
        sessionId,
        addToolOutput,
        agentStore,
      });
      return;
    default:
      await addToolOutput({
        state: "output-error",
        tool: toolCall.toolName,
        toolCallId: toolCall.toolCallId,
        errorText: `Unknown tool: ${toolCall.toolName}`,
      });
      return;
  }
}

/**
 * Handles the `ask_user` tool call by validating the input and storing the
 * pending elicitation in the agent store. The actual tool output is NOT
 * provided here — it is deferred until the user submits answers in the
 * {@link ElicitationCarousel} UI, which calls `addToolOutput` directly.
 */
async function handleAskUserToolCall({
  toolCall,
  sessionId,
  addToolOutput,
  agentStore,
}: {
  toolCall: HandleAgentToolCallOptions["toolCall"];
  sessionId: string | null;
  addToolOutput: AddToolOutput;
  agentStore: AgentStore;
}) {
  const input = parseElicitToolInput(toolCall.input);

  if (!input) {
    await addToolOutput({
      state: "output-error",
      tool: "ask_user",
      toolCallId: toolCall.toolCallId,
      errorText:
        "Invalid ask_user tool input. Expected { questions: ElicitationQuestion[] }.",
    });
    return;
  }

  if (!sessionId) {
    await addToolOutput({
      state: "output-error",
      tool: "ask_user",
      toolCallId: toolCall.toolCallId,
      errorText: "Cannot ask user questions without an active session.",
    });
    return;
  }

  // Store the pending elicitation keyed by session ID so the Chat UI can
  // render the carousel. The tool output is deferred until the user submits.
  agentStore.getState().setPendingElicitation(sessionId, {
    toolCallId: toolCall.toolCallId,
    questions: input.questions,
  });
}
