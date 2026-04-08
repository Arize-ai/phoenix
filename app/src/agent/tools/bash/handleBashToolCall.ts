import type { Chat } from "@ai-sdk/react";
import type { UIMessage } from "ai";

import type { AgentCapabilities } from "@phoenix/agent/extensions/capabilities";

import { getBashToolInput } from "./bashToolSchema";
import { getOrCreateBashToolRuntime } from "./bashToolSessionRegistry";
import { PHOENIX_GQL_MUTATIONS_ENV_VAR } from "./phoenixGqlCommand";

type AddToolOutput = Chat<UIMessage>["addToolOutput"];

/** Inputs required to execute one bash tool call in the browser runtime. */
type HandleBashToolCallOptions = {
  toolCall: {
    toolCallId: string;
    input: unknown;
  };
  // The active agent session can briefly be null; the bash runtime registry
  // falls back to a shared default session key in that case.
  sessionId: string | null;
  addToolOutput: AddToolOutput;
  capabilities: AgentCapabilities;
};

/** Sets environment variables for the bash runtime based on the current capabilities. */
function buildBashExecutionEnv({
  capabilities,
}: {
  capabilities: AgentCapabilities;
}): Record<string, string> {
  const env: Record<string, string> = {};

  if (capabilities["graphql.mutations"]) {
    env[PHOENIX_GQL_MUTATIONS_ENV_VAR] = "1";
  }

  return env;
}

/**
 * Validates the tool input, applies capability-derived runtime env vars, and
 * then forwards the command to the session-scoped just-bash runtime.
 */
export async function handleBashToolCall({
  toolCall,
  sessionId,
  addToolOutput,
  capabilities,
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
    const bashToolRuntime = await getOrCreateBashToolRuntime(sessionId);
    const result = await bashToolRuntime.executeCommand(bashToolInput.command, {
      env: buildBashExecutionEnv({ capabilities }),
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
