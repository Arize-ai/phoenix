import { describe, expect, it } from "vitest";

import {
  PENDING_TOOL_CALL_NOT_RESTORED_ERROR,
  partitionPendingClientToolCalls,
  resolveStalePendingToolCallParts,
} from "@phoenix/agent/chat/rehydratePendingToolCalls";
import type {
  AgentUIMessage,
  AgentUIMessagePart,
} from "@phoenix/agent/chat/types";

const CLIENT_EXECUTION_METADATA = {
  phoenix: { toolExecutionEnvironment: "client" },
};

const SERVER_EXECUTION_METADATA = {
  phoenix: { toolExecutionEnvironment: "server" },
};

const REHYDRATABLE_TOOL = "create_annotation_config";
const NON_REHYDRATABLE_TOOL = "edit_prompt_instance";

const isRehydratableTool = (toolName: string) => toolName === REHYDRATABLE_TOOL;

const noToolCallsInFlight = () => false;

function pendingClientToolPart({
  toolCallId,
  toolName = REHYDRATABLE_TOOL,
  input = { name: "quality" },
}: {
  toolCallId: string;
  toolName?: string;
  input?: unknown;
}): AgentUIMessagePart {
  return {
    type: `tool-${toolName}`,
    toolCallId,
    state: "input-available",
    input,
    callProviderMetadata: CLIENT_EXECUTION_METADATA,
  } as AgentUIMessagePart;
}

describe("partitionPendingClientToolCalls", () => {
  it("collects pending client calls of rehydratable tools from the trailing assistant message", () => {
    const messages: AgentUIMessage[] = [
      {
        id: "assistant-1",
        role: "assistant",
        parts: [
          pendingClientToolPart({ toolCallId: "tool-call-1" }),
          pendingClientToolPart({
            toolCallId: "tool-call-2",
            input: { name: "relevance" },
          }),
        ],
      },
    ];

    expect(
      partitionPendingClientToolCalls({
        messages,
        isRehydratableTool,
        isToolCallInFlight: noToolCallsInFlight,
      })
    ).toEqual({
      rehydratableToolCalls: [
        {
          toolCallId: "tool-call-1",
          toolName: REHYDRATABLE_TOOL,
          input: { name: "quality" },
          providerMetadata: CLIENT_EXECUTION_METADATA,
        },
        {
          toolCallId: "tool-call-2",
          toolName: REHYDRATABLE_TOOL,
          input: { name: "relevance" },
          providerMetadata: CLIENT_EXECUTION_METADATA,
        },
      ],
      staleToolCalls: [],
    });
  });

  it("partitions pending calls of non-rehydratable tools as stale", () => {
    const messages: AgentUIMessage[] = [
      {
        id: "assistant-1",
        role: "assistant",
        parts: [
          pendingClientToolPart({ toolCallId: "tool-call-1" }),
          pendingClientToolPart({
            toolCallId: "tool-call-2",
            toolName: NON_REHYDRATABLE_TOOL,
            input: { spec: {} },
          }),
        ],
      },
    ];

    const { rehydratableToolCalls, staleToolCalls } =
      partitionPendingClientToolCalls({
        messages,
        isRehydratableTool,
        isToolCallInFlight: noToolCallsInFlight,
      });
    expect(
      rehydratableToolCalls.map((toolCall) => toolCall.toolCallId)
    ).toEqual(["tool-call-1"]);
    expect(staleToolCalls).toEqual([
      {
        toolCallId: "tool-call-2",
        toolName: NON_REHYDRATABLE_TOOL,
        input: { spec: {} },
        providerMetadata: CLIENT_EXECUTION_METADATA,
      },
    ]);
  });

  it("skips resolved calls so accepted work is neither re-staged nor errored", () => {
    const messages: AgentUIMessage[] = [
      {
        id: "assistant-1",
        role: "assistant",
        parts: [
          {
            type: `tool-${REHYDRATABLE_TOOL}`,
            toolCallId: "tool-call-1",
            state: "output-available",
            input: {},
            output: { status: "accepted" },
            callProviderMetadata: CLIENT_EXECUTION_METADATA,
          } as AgentUIMessagePart,
          {
            type: `tool-${NON_REHYDRATABLE_TOOL}`,
            toolCallId: "tool-call-2",
            state: "output-available",
            input: {},
            output: { status: "applied" },
            callProviderMetadata: CLIENT_EXECUTION_METADATA,
          } as AgentUIMessagePart,
          pendingClientToolPart({ toolCallId: "tool-call-3" }),
        ],
      },
    ];

    const { rehydratableToolCalls, staleToolCalls } =
      partitionPendingClientToolCalls({
        messages,
        isRehydratableTool,
        isToolCallInFlight: noToolCallsInFlight,
      });
    expect(
      rehydratableToolCalls.map((toolCall) => toolCall.toolCallId)
    ).toEqual(["tool-call-3"]);
    expect(staleToolCalls).toEqual([]);
  });

  it("skips server-executed and provider-executed calls entirely", () => {
    const messages: AgentUIMessage[] = [
      {
        id: "assistant-1",
        role: "assistant",
        parts: [
          {
            type: `tool-${NON_REHYDRATABLE_TOOL}`,
            toolCallId: "tool-call-1",
            state: "input-available",
            input: {},
            callProviderMetadata: SERVER_EXECUTION_METADATA,
          } as AgentUIMessagePart,
          {
            type: `tool-${NON_REHYDRATABLE_TOOL}`,
            toolCallId: "tool-call-2",
            state: "input-available",
            input: {},
            providerExecuted: true,
            callProviderMetadata: CLIENT_EXECUTION_METADATA,
          } as AgentUIMessagePart,
        ],
      },
    ];

    expect(
      partitionPendingClientToolCalls({
        messages,
        isRehydratableTool,
        isToolCallInFlight: noToolCallsInFlight,
      })
    ).toEqual({ rehydratableToolCalls: [], staleToolCalls: [] });
  });

  it("skips in-flight calls so a live handler keeps ownership of its pending part", () => {
    const messages: AgentUIMessage[] = [
      {
        id: "assistant-1",
        role: "assistant",
        parts: [
          pendingClientToolPart({ toolCallId: "tool-call-1" }),
          pendingClientToolPart({
            toolCallId: "tool-call-2",
            toolName: NON_REHYDRATABLE_TOOL,
          }),
          pendingClientToolPart({ toolCallId: "tool-call-3" }),
        ],
      },
    ];

    const { rehydratableToolCalls, staleToolCalls } =
      partitionPendingClientToolCalls({
        messages,
        isRehydratableTool,
        isToolCallInFlight: (toolCallId) =>
          toolCallId === "tool-call-1" || toolCallId === "tool-call-2",
      });
    expect(
      rehydratableToolCalls.map((toolCall) => toolCall.toolCallId)
    ).toEqual(["tool-call-3"]);
    expect(staleToolCalls).toEqual([]);
  });

  it("ignores pending calls on non-trailing messages", () => {
    const messages: AgentUIMessage[] = [
      {
        id: "assistant-1",
        role: "assistant",
        parts: [pendingClientToolPart({ toolCallId: "tool-call-1" })],
      },
      {
        id: "user-1",
        role: "user",
        parts: [{ type: "text", text: "hello" }],
      },
    ];

    expect(
      partitionPendingClientToolCalls({
        messages,
        isRehydratableTool,
        isToolCallInFlight: noToolCallsInFlight,
      })
    ).toEqual({ rehydratableToolCalls: [], staleToolCalls: [] });
  });

  it("returns nothing for an empty transcript", () => {
    expect(
      partitionPendingClientToolCalls({
        messages: [],
        isRehydratableTool,
        isToolCallInFlight: noToolCallsInFlight,
      })
    ).toEqual({ rehydratableToolCalls: [], staleToolCalls: [] });
  });
});

describe("resolveStalePendingToolCallParts", () => {
  it("errors the named pending calls on the trailing assistant message, preserving input and metadata", () => {
    const messages: AgentUIMessage[] = [
      {
        id: "assistant-1",
        role: "assistant",
        parts: [
          pendingClientToolPart({
            toolCallId: "tool-call-1",
            toolName: NON_REHYDRATABLE_TOOL,
            input: { spec: {} },
          }),
          pendingClientToolPart({ toolCallId: "tool-call-2" }),
        ],
      },
    ];

    const resolved = resolveStalePendingToolCallParts({
      messages,
      staleToolCallIds: new Set(["tool-call-1"]),
    });

    expect(resolved[0]?.parts[0]).toMatchObject({
      state: "output-error",
      errorText: PENDING_TOOL_CALL_NOT_RESTORED_ERROR,
      toolCallId: "tool-call-1",
      input: { spec: {} },
      callProviderMetadata: CLIENT_EXECUTION_METADATA,
    });
    // The sibling pending call and the original transcript are untouched.
    expect(resolved[0]?.parts[1]).toMatchObject({ state: "input-available" });
    expect(messages[0]?.parts[0]).toMatchObject({ state: "input-available" });
  });

  it("returns the transcript unchanged when there are no stale calls", () => {
    const messages: AgentUIMessage[] = [
      {
        id: "assistant-1",
        role: "assistant",
        parts: [pendingClientToolPart({ toolCallId: "tool-call-1" })],
      },
    ];

    expect(
      resolveStalePendingToolCallParts({
        messages,
        staleToolCallIds: new Set(),
      })
    ).toBe(messages);
  });
});
