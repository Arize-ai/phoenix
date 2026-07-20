import { describe, expect, it } from "vitest";

import type { AgentUIMessage } from "@phoenix/agent/chat/types";

import { getConversationUsage } from "../ChatSessionUsage";

function createAssistantMessage({
  id,
  prompt,
  completion,
  cacheRead,
  cacheWrite,
}: {
  id: string;
  prompt: number;
  completion: number;
  cacheRead?: number;
  cacheWrite?: number;
}): AgentUIMessage {
  const hasPromptDetails = cacheRead != null && cacheWrite != null;
  return {
    id,
    role: "assistant",
    parts: [{ type: "text", text: "response" }],
    metadata: {
      type: "assistant",
      sessionId: "session-1",
      usage: {
        tokens: {
          prompt,
          completion,
          total: prompt + completion,
        },
        ...(hasPromptDetails
          ? { promptDetails: { cacheRead, cacheWrite } }
          : {}),
      },
    },
  };
}

describe("getConversationUsage", () => {
  it("accumulates token counts across assistant turns", () => {
    const messages: AgentUIMessage[] = [
      createAssistantMessage({
        id: "assistant-1",
        prompt: 100,
        completion: 20,
        cacheRead: 40,
        cacheWrite: 10,
      }),
      {
        id: "user-2",
        role: "user",
        parts: [{ type: "text", text: "follow-up" }],
      },
      createAssistantMessage({
        id: "assistant-2",
        prompt: 200,
        completion: 30,
        cacheRead: 150,
        cacheWrite: 5,
      }),
    ];

    expect(getConversationUsage(messages)).toEqual({
      tokenCount: {
        prompt: 300,
        completion: 50,
        total: 350,
        promptDetails: {
          cacheRead: 150,
          cacheWrite: 5,
        },
      },
    });
  });

  it("uses cache details from only the latest turn", () => {
    const messages = [
      createAssistantMessage({
        id: "assistant-1",
        prompt: 100,
        completion: 20,
        cacheRead: 40,
        cacheWrite: 10,
      }),
      createAssistantMessage({
        id: "assistant-2",
        prompt: 200,
        completion: 30,
      }),
    ];

    expect(getConversationUsage(messages)).toEqual({
      tokenCount: {
        prompt: 300,
        completion: 50,
        total: 350,
      },
    });
  });

  it("returns null when no assistant turn reports usage", () => {
    expect(
      getConversationUsage([
        {
          id: "assistant-1",
          role: "assistant",
          parts: [{ type: "text", text: "response" }],
        },
      ])
    ).toBeNull();
  });
});
