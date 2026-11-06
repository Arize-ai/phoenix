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
      phoenix: {
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
    },
  };
}

describe("getConversationUsage", () => {
  it("uses the latest assistant turn's token counts", () => {
    const messages: AgentUIMessage[] = [
      {
        id: "older-compaction-boundary",
        role: "user",
        metadata: {
          phoenix: {
            type: "user",
            currentDateTime: "2026-01-01T00:00:00Z",
            timeZone: "UTC",
            isCompactionMessage: true,
          },
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

  it("omits cache details when the latest turn reports none", () => {
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
        prompt: 200,
        completion: 30,
        total: 230,
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

  it("uses the latest usage after a compaction boundary", () => {
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
          phoenix: {
            type: "user",
            currentDateTime: "2026-01-01T00:00:00Z",
            timeZone: "UTC",
            isCompactionMessage: true,
          },
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

  it("falls back to the pre-compaction usage until the next turn reports", () => {
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
          phoenix: {
            type: "user",
            currentDateTime: "2026-01-01T00:00:00Z",
            timeZone: "UTC",
            isCompactionMessage: true,
          },
        },
        parts: [{ type: "text", text: "summary" }],
      },
    ];

    expect(
      getConversationUsage({
        messages,
      })
    ).toEqual({
      tokenCount: {
        prompt: 1_000,
        completion: 100,
        total: 1_100,
      },
    });
  });
});
