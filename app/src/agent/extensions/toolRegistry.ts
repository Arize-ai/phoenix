import type { Chat } from "@ai-sdk/react";
import type { UIMessage } from "ai";

/**
 * Frontend registry for executing PXI tools whose model-facing definitions are
 * advertised by the server.
 */
import { getBashToolInput } from "@phoenix/agent/tools/bash";
import type { BashToolInput } from "@phoenix/agent/tools/bash";
import { handleBashToolCall } from "@phoenix/agent/tools/bash/handleBashToolCall";
import { parseElicitToolInput } from "@phoenix/agent/tools/elicit";
import type { ElicitToolInput } from "@phoenix/agent/tools/elicit";
import type { TimeRangeKey } from "@phoenix/components/datetime/types";
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
 * One frontend tool entry: server-advertised name, parser for raw input,
 * optional capability gates, and the implementation that handles the call.
 */
type RegisteredAgentTool<TInput> = {
  name: string;
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
  name: "bash",
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
  name: "ask_user",
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

/**
 * Server-advertised, client-executed: the server owns the canonical schema
 * and description (see agents/tools/set_spans_filter.py); this name is the
 * single source of truth for routing the call to the matching client action
 * registered by SpanFilterConditionField. The tool consolidates control over
 * both the freeform filter condition and the root-vs-all-spans toggle.
 */
export const SET_SPANS_FILTER_TOOL_NAME = "set_spans_filter";

export type SetSpansFilterInput = {
  condition: string;
  rootSpansOnly: boolean;
};

export const SET_TIME_RANGE_TOOL_NAME = "set_time_range";

export type SetTimeRangeInput = {
  timeRangeKey: TimeRangeKey;
  startTime?: string;
  endTime?: string;
};

function parseSetSpansFilterInput(input: unknown): SetSpansFilterInput | null {
  if (typeof input !== "object" || input === null) return null;
  const candidate = input as {
    condition?: unknown;
    rootSpansOnly?: unknown;
  };
  if (typeof candidate.condition !== "string") return null;
  if (typeof candidate.rootSpansOnly !== "boolean") return null;
  return {
    condition: candidate.condition,
    rootSpansOnly: candidate.rootSpansOnly,
  };
}

const setSpansFilterAgentTool = createRegisteredAgentTool<SetSpansFilterInput>({
  name: SET_SPANS_FILTER_TOOL_NAME,
  parseInput: parseSetSpansFilterInput,
  invalidInputErrorText: `Invalid ${SET_SPANS_FILTER_TOOL_NAME} input. Expected { condition: string, rootSpansOnly: boolean }.`,
  execute: async ({ toolCall, input, addToolOutput, agentStore }) => {
    const action =
      agentStore.getState().registeredClientActions[SET_SPANS_FILTER_TOOL_NAME];
    if (!action) {
      await addToolOutput({
        state: "output-error",
        tool: SET_SPANS_FILTER_TOOL_NAME,
        toolCallId: toolCall.toolCallId,
        errorText:
          "The span filter field is not mounted on this page; cannot update the spans filter.",
      });
      return;
    }
    const result = await action(input);
    if (result.ok) {
      await addToolOutput({
        state: "output-available",
        tool: SET_SPANS_FILTER_TOOL_NAME,
        toolCallId: toolCall.toolCallId,
        output: result.output ?? "Spans filter updated.",
      });
    } else {
      await addToolOutput({
        state: "output-error",
        tool: SET_SPANS_FILTER_TOOL_NAME,
        toolCallId: toolCall.toolCallId,
        errorText: result.error,
      });
    }
  },
});

/**
 * Parse and validate the set_time_range tool input.
 *
 * **Drift warning:** The allowed `timeRangeKey` values here must stay in sync
 * with the server-side enum in
 * `src/phoenix/server/agents/tools/external/set_time_range.py`
 * (`_SET_TIME_RANGE_PARAMETERS["properties"]["timeRangeKey"]["enum"]`)
 * and the shared TypeScript type `TimeRangeKey` in
 * `app/src/components/datetime/types.ts`. If the allowed presets change,
 * all three locations need updating.
 */
function parseSetTimeRangeInput(input: unknown): SetTimeRangeInput | null {
  if (typeof input !== "object" || input === null) return null;
  const candidate = input as {
    timeRangeKey?: unknown;
    startTime?: unknown;
    endTime?: unknown;
  };
  if (
    candidate.timeRangeKey !== "15m" &&
    candidate.timeRangeKey !== "1h" &&
    candidate.timeRangeKey !== "12h" &&
    candidate.timeRangeKey !== "1d" &&
    candidate.timeRangeKey !== "7d" &&
    candidate.timeRangeKey !== "30d" &&
    candidate.timeRangeKey !== "custom"
  ) {
    return null;
  }
  if (
    candidate.startTime !== undefined &&
    typeof candidate.startTime !== "string"
  ) {
    return null;
  }
  if (
    candidate.endTime !== undefined &&
    typeof candidate.endTime !== "string"
  ) {
    return null;
  }
  return {
    timeRangeKey: candidate.timeRangeKey,
    ...(candidate.startTime !== undefined
      ? { startTime: candidate.startTime }
      : {}),
    ...(candidate.endTime !== undefined ? { endTime: candidate.endTime } : {}),
  };
}

const setTimeRangeAgentTool = createRegisteredAgentTool<SetTimeRangeInput>({
  name: SET_TIME_RANGE_TOOL_NAME,
  parseInput: parseSetTimeRangeInput,
  invalidInputErrorText: `Invalid ${SET_TIME_RANGE_TOOL_NAME} input. Expected { timeRangeKey: "15m" | "1h" | "12h" | "1d" | "7d" | "30d" | "custom", startTime?: string, endTime?: string }.`,
  execute: async ({ toolCall, input, addToolOutput, agentStore }) => {
    const action =
      agentStore.getState().registeredClientActions[SET_TIME_RANGE_TOOL_NAME];
    if (!action) {
      await addToolOutput({
        state: "output-error",
        tool: SET_TIME_RANGE_TOOL_NAME,
        toolCallId: toolCall.toolCallId,
        errorText:
          "The app time range selector is not mounted on this page; cannot update the time range.",
      });
      return;
    }
    const result = await action(input);
    if (result.ok) {
      await addToolOutput({
        state: "output-available",
        tool: SET_TIME_RANGE_TOOL_NAME,
        toolCallId: toolCall.toolCallId,
        output: result.output ?? "Time range updated.",
      });
    } else {
      await addToolOutput({
        state: "output-error",
        tool: SET_TIME_RANGE_TOOL_NAME,
        toolCallId: toolCall.toolCallId,
        errorText: result.error,
      });
    }
  },
});

/** Ordered registry of all frontend-executable tools. */
const agentToolRegistry: RegisteredAgentTool<unknown>[] = [
  bashAgentTool as RegisteredAgentTool<unknown>,
  askUserAgentTool as RegisteredAgentTool<unknown>,
  setTimeRangeAgentTool as RegisteredAgentTool<unknown>,
  setSpansFilterAgentTool as RegisteredAgentTool<unknown>,
];

/** Fast lookup map for runtime tool dispatch by name. */
const agentToolRegistryByName = new Map<string, RegisteredAgentTool<unknown>>(
  agentToolRegistry.map((tool) => [tool.name, tool])
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
