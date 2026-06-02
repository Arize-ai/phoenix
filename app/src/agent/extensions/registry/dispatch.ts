import type { AgentStore } from "@phoenix/store/agentStore";

import {
  type AgentCapabilities,
  type AgentCapabilityKey,
  getAgentCapabilityDefinition,
} from "../capabilities";
import type {
  AddToolOutput,
  AgentToolCall,
  AgentToolDefinition,
  AgentToolUIBehavior,
  AppendMessagePart,
} from "./defineTool";

/** Returns the capability keys a tool requires that are currently disabled. */
function getMissingCapabilities({
  definition,
  capabilities,
}: {
  definition: AgentToolDefinition;
  capabilities: AgentCapabilities;
}): AgentCapabilityKey[] {
  return (
    definition.requiredCapabilities?.filter(
      (capabilityKey) => !capabilities[capabilityKey]
    ) ?? []
  );
}

/** Formats a stable user-facing error for capability-gated tool calls. */
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

/** The runtime surface a tool registry exposes to the chat layer. */
export type AgentToolDispatcher = {
  /**
   * Validate and dispatch one tool call from the AI SDK runtime to the matching
   * frontend tool definition.
   */
  handleRegisteredAgentToolCall: (args: {
    toolCall: AgentToolCall;
    sessionId: string | null;
    addToolOutput: AddToolOutput;
    appendMessagePart?: AppendMessagePart;
    agentStore: AgentStore;
  }) => Promise<void>;
  /** Returns the UI surfacing hints declared by a tool, if any. */
  getAgentToolUIBehavior: (toolName: string) => AgentToolUIBehavior | undefined;
};

/**
 * Build the dispatcher for an ordered list of tool definitions.
 *
 * The kernel is intentionally tiny and tool-agnostic: server-environment guard,
 * name lookup, capability gate, then delegation to the tool's sealed
 * `dispatch` (which owns input parsing and execution).
 *
 * @param definitions - ordered, name-unique tool definitions
 */
export function createAgentToolDispatcher(
  definitions: readonly AgentToolDefinition[]
): AgentToolDispatcher {
  const definitionsByName = new Map<string, AgentToolDefinition>();
  for (const definition of definitions) {
    if (definitionsByName.has(definition.name)) {
      // Fail fast rather than silently shadow the earlier tool: a copied tool
      // module that forgot to swap its `*_TOOL_NAME` constant would otherwise
      // make one tool unreachable with no error.
      throw new Error(
        `Duplicate agent tool name "${definition.name}". Each registered tool must have a unique name.`
      );
    }
    definitionsByName.set(definition.name, definition);
  }

  return {
    getAgentToolUIBehavior: (toolName) =>
      definitionsByName.get(toolName)?.uiBehavior,

    handleRegisteredAgentToolCall: async ({
      toolCall,
      sessionId,
      addToolOutput,
      appendMessagePart,
      agentStore,
    }) => {
      // Server-executed tools (MCP, function tools) run on the Phoenix server;
      // the result streams back as `tool-output-available` and must not be
      // intercepted by the frontend registry.
      if (
        toolCall.providerMetadata?.phoenix?.tool_execution_environment ===
        "server"
      ) {
        return;
      }

      const definition = definitionsByName.get(toolCall.toolName);
      if (!definition) {
        await addToolOutput({
          state: "output-error",
          tool: toolCall.toolName,
          toolCallId: toolCall.toolCallId,
          errorText: `Unknown tool: ${toolCall.toolName}`,
        });
        return;
      }

      const capabilities = agentStore.getState().capabilities;
      const missingCapabilities = getMissingCapabilities({
        definition,
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

      await definition.dispatch({
        toolCall,
        sessionId,
        addToolOutput,
        appendMessagePart: appendMessagePart ?? (() => {}),
        agentStore,
        capabilities,
      });
    },
  };
}
