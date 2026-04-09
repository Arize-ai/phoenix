import type { Chat } from "@ai-sdk/react";
import type { UIMessage } from "ai";

import {
  bashToolDefinition,
  getBashToolInput,
} from "@phoenix/agent/tools/bash";
import type { BashToolInput } from "@phoenix/agent/tools/bash";
/**
 * For the workflow to add, edit, or remove a frontend tool, see
 * `.agents/skills/phoenix-pxi/rules/extending-frontend-tool-registry.md`.
 */
import { handleBashToolCall } from "@phoenix/agent/tools/bash/handleBashToolCall";
import {
  elicitToolDefinition,
  parseElicitToolInput,
} from "@phoenix/agent/tools/elicit";
import type { ElicitToolInput } from "@phoenix/agent/tools/elicit";
import type { FrontendToolDefinition } from "@phoenix/agent/tools/types";
import type { AgentStore } from "@phoenix/store/agentStore";

import {
  getAgentCapabilityDefinition,
  type AgentCapabilities,
  type AgentCapabilityKey,
} from "./capabilities";

type AddToolOutput = Chat<UIMessage>["addToolOutput"];

/** Minimal tool-call shape produced by the AI SDK runtime. */
export type AgentToolCall = {
  toolCallId: string;
  toolName: string;
  input: unknown;
};

/** Shared execution context passed to each registered tool handler. */
type AgentToolHandlerContext<TInput> = {
  toolCall: AgentToolCall;
  input: TInput;
  sessionId: string | null;
  addToolOutput: AddToolOutput;
  agentStore: AgentStore;
  capabilities: AgentCapabilities;
};

/**
 * One frontend tool entry: schema exposed to the model, parser for raw input,
 * optional capability gates, and the implementation that handles the call.
 */
type RegisteredAgentTool<TInput> = {
  definition: FrontendToolDefinition;
  parseInput: (input: unknown) => TInput | null;
  invalidInputErrorText: string;
  requiredCapabilities?: AgentCapabilityKey[];
  execute: (context: AgentToolHandlerContext<TInput>) => Promise<void>;
};

/** Helps TypeScript preserve the input type for each tool definition. */
function createRegisteredAgentTool<TInput>(
  tool: RegisteredAgentTool<TInput>
): RegisteredAgentTool<TInput> {
  return tool;
}

/** Bash runs in the browser sandbox and is gated by runtime capabilities. */
const bashAgentTool = createRegisteredAgentTool<BashToolInput>({
  definition: bashToolDefinition,
  parseInput: getBashToolInput,
  invalidInputErrorText: "Invalid bash tool input",
  execute: async ({
    toolCall,
    input,
    sessionId,
    addToolOutput,
    capabilities,
  }) => {
    await handleBashToolCall({
      toolCallId: toolCall.toolCallId,
      input,
      sessionId,
      addToolOutput,
      capabilities,
    });
  },
});

/** ask_user pauses tool execution until the user answers in the UI. */
const askUserAgentTool = createRegisteredAgentTool<ElicitToolInput>({
  definition: elicitToolDefinition,
  parseInput: parseElicitToolInput,
  invalidInputErrorText:
    "Invalid ask_user tool input. Expected { questions: ElicitationQuestion[] }.",
  execute: async ({
    toolCall,
    input,
    sessionId,
    addToolOutput,
    agentStore,
  }) => {
    if (!sessionId) {
      await addToolOutput({
        state: "output-error",
        tool: "ask_user",
        toolCallId: toolCall.toolCallId,
        errorText: "Cannot ask user questions without an active session.",
      });
      return;
    }

    agentStore.getState().setPendingElicitation(sessionId, {
      toolCallId: toolCall.toolCallId,
      questions: input.questions,
    });
  },
});

/** Ordered registry of all frontend-executable tools. */
const agentToolRegistry: RegisteredAgentTool<unknown>[] = [
  bashAgentTool as RegisteredAgentTool<unknown>,
  askUserAgentTool as RegisteredAgentTool<unknown>,
];

/** Fast lookup map for runtime tool dispatch by name. */
const agentToolRegistryByName = new Map<string, RegisteredAgentTool<unknown>>(
  agentToolRegistry.map((tool) => [tool.definition.name, tool])
);

function getMissingCapabilities({
  registeredTool,
  capabilities,
}: {
  registeredTool: RegisteredAgentTool<unknown>;
  capabilities: AgentCapabilities;
}): AgentCapabilityKey[] {
  return (
    registeredTool.requiredCapabilities?.filter(
      (capabilityKey: AgentCapabilityKey) => !capabilities[capabilityKey]
    ) ?? []
  );
}

function buildMissingCapabilitiesErrorText(
  missingCapabilities: AgentCapabilityKey[]
): string {
  return [
    "This tool call requires capabilities that are currently disabled:",
    ...missingCapabilities.map(
      (capabilityKey) =>
        `- ${getAgentCapabilityDefinition(capabilityKey).label}`
    ),
  ].join("\n");
}

/** Tool schemas sent with every chat request. */
export const agentToolDefinitions = agentToolRegistry.map(
  (tool) => tool.definition
);

/**
 * Validates and dispatches one tool call from the AI SDK runtime to the
 * matching frontend tool implementation.
 */
export async function handleRegisteredAgentToolCall({
  toolCall,
  sessionId,
  addToolOutput,
  agentStore,
}: {
  toolCall: AgentToolCall;
  sessionId: string | null;
  addToolOutput: AddToolOutput;
  agentStore: AgentStore;
}) {
  const registeredTool = agentToolRegistryByName.get(toolCall.toolName);

  if (!registeredTool) {
    await addToolOutput({
      state: "output-error",
      tool: toolCall.toolName,
      toolCallId: toolCall.toolCallId,
      errorText: `Unknown tool: ${toolCall.toolName}`,
    });
    return;
  }

  const input = registeredTool.parseInput(toolCall.input);

  if (input == null) {
    await addToolOutput({
      state: "output-error",
      tool: toolCall.toolName,
      toolCallId: toolCall.toolCallId,
      errorText: registeredTool.invalidInputErrorText,
    });
    return;
  }

  const capabilities = agentStore.getState().capabilities;
  const missingCapabilities = getMissingCapabilities({
    registeredTool,
    capabilities,
  });

  if (missingCapabilities.length > 0) {
    await addToolOutput({
      state: "output-error",
      tool: toolCall.toolName,
      toolCallId: toolCall.toolCallId,
      errorText: buildMissingCapabilitiesErrorText(missingCapabilities),
    });
    return;
  }

  await registeredTool.execute({
    toolCall,
    input,
    sessionId,
    addToolOutput,
    agentStore,
    capabilities,
  });
}
