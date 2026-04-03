import type { Chat } from "@ai-sdk/react";
import type { UIMessage } from "ai";

import type { AgentStore } from "@phoenix/store/agentStore";

import { getBashToolInput } from "./bashToolSchema";
import { getOrCreateBashToolRuntime } from "./bashToolSessionRegistry";
import { PHOENIX_GQL_MUTATIONS_ENV_VAR } from "./phoenixGqlCommand";

type AddToolOutput = Chat<UIMessage>["addToolOutput"];

type HandleBashToolCallOptions = {
  toolCall: {
    toolCallId: string;
    input: unknown;
  };
  // The active agent session can briefly be null; the bash runtime registry
  // falls back to a shared default session key in that case.
  sessionId: string | null;
  addToolOutput: AddToolOutput;
  agentStore: AgentStore;
};

export async function handleBashToolCall({
  toolCall,
  sessionId,
  addToolOutput,
  agentStore,
}: HandleBashToolCallOptions) {
  const bashToolInput = getBashToolInput(toolCall.input);

  if (!bashToolInput) {
    await addToolOutput({
      state: "output-error",
      tool: "bash",
      toolCallId: toolCall.toolCallId,
      errorText: "Invalid bash tool input",
    });
    return;
  }

  try {
    const { debug } = agentStore.getState();
    const env: Record<string, string> = {};

    if (debug.dangerouslyEnableMutations) {
      env[PHOENIX_GQL_MUTATIONS_ENV_VAR] = "1";
    }

    const bashToolRuntime = await getOrCreateBashToolRuntime(sessionId);
    const result = await bashToolRuntime.executeCommand(bashToolInput.command, {
      env,
    });

    await addToolOutput({
      tool: "bash",
      toolCallId: toolCall.toolCallId,
      output: result,
    });
  } catch (error) {
    await addToolOutput({
      state: "output-error",
      tool: "bash",
      toolCallId: toolCall.toolCallId,
      errorText:
        error instanceof Error
          ? error.message
          : "Failed to execute bash command",
    });
  }
}
