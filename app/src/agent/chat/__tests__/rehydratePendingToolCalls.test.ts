import { describe, expect, it } from "vitest";

import { collectRehydratableToolCalls } from "@phoenix/agent/chat/rehydratePendingToolCalls";
import type { AgentUIMessage } from "@phoenix/agent/chat/types";

const CLIENT_EXECUTION_METADATA = {
  phoenix: { toolExecutionEnvironment: "client" },
};

const SERVER_EXECUTION_METADATA = {
  phoenix: { toolExecutionEnvironment: "server" },
};

const REHYDRATABLE_TOOL = "create_annotation_config";
const NON_REHYDRATABLE_TOOL = "read_prompt";

const isRehydratableTool = (toolName: string) => toolName === REHYDRATABLE_TOOL;

function createMessage(message: AgentUIMessage): AgentUIMessage {
  return message;
}

function pendingClientToolPart({
  toolCallId,
  toolName = REHYDRATABLE_TOOL,
  input = { name: "quality" },
}: {
  toolCallId: string;
  toolName?: string;
  input?: unknown;
}): AgentUIMessage["parts"][number] {
  return {
    type: `tool-${toolName}`,
    toolCallId,
    state: "input-available",
    input,
    callProviderMetadata: CLIENT_EXECUTION_METADATA,
  } as AgentUIMessage["parts"][number];
}

describe("collectRehydratableToolCalls", () => {
  it("collects pending client calls of rehydratable tools from the trailing assistant message", () => {
    const messages = [
      createMessage({
        id: "assistant-1",
        role: "assistant",
        parts: [
          pendingClientToolPart({ toolCallId: "tool-call-1" }),
          pendingClientToolPart({
            toolCallId: "tool-call-2",
            input: { name: "relevance" },
          }),
        ],
      }),
    ];

    expect(
      collectRehydratableToolCalls({ messages, isRehydratableTool })
    ).toEqual([
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
    ]);
  });

  it("skips resolved calls so accepted work is not re-staged", () => {
    const messages = [
      createMessage({
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
          } as AgentUIMessage["parts"][number],
          pendingClientToolPart({ toolCallId: "tool-call-2" }),
        ],
      }),
    ];

    expect(
      collectRehydratableToolCalls({ messages, isRehydratableTool }).map(
        (toolCall) => toolCall.toolCallId
      )
    ).toEqual(["tool-call-2"]);
  });

  it("skips tools that execute on dispatch instead of staging approval state", () => {
    const messages = [
      createMessage({
        id: "assistant-1",
        role: "assistant",
        parts: [
          pendingClientToolPart({
            toolCallId: "tool-call-1",
            toolName: NON_REHYDRATABLE_TOOL,
          }),
        ],
      }),
    ];

    expect(
      collectRehydratableToolCalls({ messages, isRehydratableTool })
    ).toEqual([]);
  });

  it("skips server-executed and provider-executed calls", () => {
    const messages = [
      createMessage({
        id: "assistant-1",
        role: "assistant",
        parts: [
          {
            type: `tool-${REHYDRATABLE_TOOL}`,
            toolCallId: "tool-call-1",
            state: "input-available",
            input: {},
            callProviderMetadata: SERVER_EXECUTION_METADATA,
          } as AgentUIMessage["parts"][number],
          {
            type: `tool-${REHYDRATABLE_TOOL}`,
            toolCallId: "tool-call-2",
            state: "input-available",
            input: {},
            providerExecuted: true,
            callProviderMetadata: CLIENT_EXECUTION_METADATA,
          } as AgentUIMessage["parts"][number],
        ],
      }),
    ];

    expect(
      collectRehydratableToolCalls({ messages, isRehydratableTool })
    ).toEqual([]);
  });

  it("ignores pending calls on non-trailing messages", () => {
    const messages = [
      createMessage({
        id: "assistant-1",
        role: "assistant",
        parts: [pendingClientToolPart({ toolCallId: "tool-call-1" })],
      }),
      createMessage({
        id: "user-1",
        role: "user",
        parts: [{ type: "text", text: "hello" }],
      }),
    ];

    expect(
      collectRehydratableToolCalls({ messages, isRehydratableTool })
    ).toEqual([]);
  });

  it("returns nothing for an empty transcript", () => {
    expect(
      collectRehydratableToolCalls({ messages: [], isRehydratableTool })
    ).toEqual([]);
  });
});
