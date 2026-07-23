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
      {
        id: "older-compaction-boundary",
        role: "user",
        metadata: {
          type: "user",
          currentDateTime: "2026-01-01T00:00:00Z",
          timeZone: "UTC",
          isCompactionMessage: true,
        },
        parts: [{ type: "text", text: "older summary" }],
      },
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

    expect(getConversationUsage({ messages })).toEqual({
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

    expect(getConversationUsage({ messages })).toEqual({
      tokenCount: {
        prompt: 300,
        completion: 50,
        total: 350,
      },
    });
  });

  it("returns null when no assistant turn reports usage", () => {
    expect(
      getConversationUsage({
        messages: [
          {
            id: "assistant-1",
            role: "assistant",
            parts: [{ type: "text", text: "response" }],
          },
        ],
      })
    ).toBeNull();
  });

  it("accumulates only usage after the compaction boundary", () => {
    const messages: AgentUIMessage[] = [
      createAssistantMessage({
        id: "assistant-before-compaction",
        prompt: 1_000,
        completion: 100,
      }),
      {
        id: "compaction-boundary",
        role: "user",
        metadata: {
          type: "user",
          currentDateTime: "2026-01-01T00:00:00Z",
          timeZone: "UTC",
          isCompactionMessage: true,
        },
        parts: [{ type: "text", text: "summary" }],
      },
      createAssistantMessage({
        id: "assistant-after-compaction",
        prompt: 200,
        completion: 30,
        cacheRead: 150,
        cacheWrite: 5,
      }),
    ];

    expect(
      getConversationUsage({
        messages,
      })
    ).toEqual({
      tokenCount: {
        prompt: 200,
        completion: 30,
        total: 230,
        promptDetails: {
          cacheRead: 150,
          cacheWrite: 5,
        },
      },
    });
  });

  it("returns null immediately after compaction", () => {
    const messages: AgentUIMessage[] = [
      createAssistantMessage({
        id: "assistant-before-compaction",
        prompt: 1_000,
        completion: 100,
      }),
      {
        id: "compaction-boundary",
        role: "user",
        metadata: {
          type: "user",
          currentDateTime: "2026-01-01T00:00:00Z",
          timeZone: "UTC",
          isCompactionMessage: true,
        },
        parts: [{ type: "text", text: "summary" }],
      },
    ];

    expect(
      getConversationUsage({
        messages,
      })
    ).toBeNull();
  });
});
