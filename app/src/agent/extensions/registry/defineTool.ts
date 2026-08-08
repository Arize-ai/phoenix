import type { Chat } from "@ai-sdk/react";

import type { AgentUIMessage } from "@phoenix/agent/chat/types";
import type { components } from "@phoenix/api/__generated__/v1";
import type { AgentStore } from "@phoenix/store/agentStore";

import type { AgentCapabilities, AgentCapabilityKey } from "../capabilities";

export type AddToolOutput = Chat<AgentUIMessage>["addToolOutput"];
export type AppendMessagePart = (part: AgentUIMessage["parts"][number]) => void;

type ToolCallProviderMetadata =
  components["schemas"]["ToolCallProviderMetadata"];

/**
 * Minimal tool-call shape produced by the AI SDK runtime.
 */
export type AgentToolCall = {
  toolCallId: string;
  toolName: string;
  input: unknown;
  providerMetadata?: {
    phoenix?: ToolCallProviderMetadata;
  };
};

/**
 * Context handed to the kernel before a tool's input has been parsed. The raw,
 * unparsed input lives on `toolCall.input`.
 */
export type AgentToolDispatchContext = {
  toolCall: AgentToolCall;
  sessionId: string | null;
  addToolOutput: AddToolOutput;
  appendMessagePart: AppendMessagePart;
  agentStore: AgentStore;
  capabilities: AgentCapabilities;
};

/** Execution context handed to a tool's `execute`, with input already parsed. */
export type AgentToolHandlerContext<TInput> = AgentToolDispatchContext & {
  input: TInput;
};

/** Declarative hints the chat UI reads to decide how to surface a tool part. */
export type AgentToolUIBehavior = {
  autoOpen?: boolean;
  scrollIntoViewOnMount?: boolean;
};

/**
 * A sealed, non-generic registry entry. The tool's input type is captured
 * inside `dispatch` by {@link defineTool} and never escapes, so the registry
 * can hold a homogeneous `AgentToolDefinition[]` with no `unknown` casts and no
 * loss of the parser-to-handler type link at the definition site.
 */
export type AgentToolDefinition = {
  /** Server-advertised tool name; the single contract with the backend. */
  name: string;
  uiBehavior?: AgentToolUIBehavior;
  requiredCapabilities?: AgentCapabilityKey[];
  /**
   * Parse the raw tool-call input and execute the handler. Emits an
   * `output-error` itself when the input fails to parse. The kernel calls this
   * only after the server-environment guard and capability gate have passed.
   */
  dispatch: (context: AgentToolDispatchContext) => Promise<void>;
  // TODO(pending-tool-rehydration): a future `rehydration?` field can declare
  // how a pending tool serializes its UI state and rebinds runtime
  // dependencies, replacing each tool's bespoke Zustand + page-level logic.
};

/** Resolves a tool's invalid-input message, which may depend on the input. */
function resolveInvalidInputErrorText(
  invalidInputErrorText: string | ((input: unknown) => string),
  rawInput: unknown
): string {
  return typeof invalidInputErrorText === "function"
    ? invalidInputErrorText(rawInput)
    : invalidInputErrorText;
}

/**
 * Define one frontend-executable tool.
 *
 * The generic `TInput` is inferred from `parseInput` and tied to `execute`, so
 * a mismatched parser/handler pair is a compile error. The returned value is
 * the type-erased {@link AgentToolDefinition}; `TInput` lives only inside the
 * returned `dispatch` closure.
 *
 * @param config - tool definition
 * @param config.name - server-advertised tool name
 * @param config.parseInput - validates raw input, returning `null` when invalid
 * @param config.invalidInputErrorText - message (or builder) for invalid input
 * @param config.requiredCapabilities - capability keys gated by the kernel
 * @param config.uiBehavior - chat UI surfacing hints
 * @param config.execute - handler invoked with parsed input
 */
export function defineTool<TInput>(config: {
  name: string;
  parseInput: (input: unknown) => TInput | null;
  invalidInputErrorText: string | ((input: unknown) => string);
  requiredCapabilities?: AgentCapabilityKey[];
  uiBehavior?: AgentToolUIBehavior;
  execute: (context: AgentToolHandlerContext<TInput>) => Promise<void>;
}): AgentToolDefinition {
  return {
    name: config.name,
    uiBehavior: config.uiBehavior,
    requiredCapabilities: config.requiredCapabilities,
    dispatch: async (context) => {
      const input = config.parseInput(context.toolCall.input);
      if (input == null) {
        await context.addToolOutput({
          state: "output-error",
          tool: config.name,
          toolCallId: context.toolCall.toolCallId,
          errorText: resolveInvalidInputErrorText(
            config.invalidInputErrorText,
            context.toolCall.input
          ),
        });
        return;
      }
      await config.execute({ ...context, input });
    },
  };
}
