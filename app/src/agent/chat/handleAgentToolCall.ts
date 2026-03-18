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
