import type { Chat } from "@ai-sdk/react";
import type { UIMessage } from "ai";

import { handleBashToolCall } from "@phoenix/agent/tools/bash/handleBashToolCall";

type AddToolOutput = Chat<UIMessage>["addToolOutput"];

type HandleAgentToolCallOptions = {
  toolCall: {
    toolCallId: string;
    toolName: string;
    input: unknown;
  };
  sessionId: string | null;
  addToolOutput: AddToolOutput;
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
}: HandleAgentToolCallOptions) {
  switch (toolCall.toolName) {
    case "bash":
      await handleBashToolCall({
        toolCall,
        sessionId,
        addToolOutput,
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
