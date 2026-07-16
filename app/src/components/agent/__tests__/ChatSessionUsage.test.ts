import { describe, expect, it } from "vitest";

import type { AgentUIMessage } from "@phoenix/agent/chat/types";

import {
  getCacheUsageDisplay,
  getLatestAssistantMessageUsage,
} from "../ChatSessionUsage";

describe("getLatestAssistantMessageUsage", () => {
  it("reads usage from the latest assistant message", () => {
    const messages: AgentUIMessage[] = [
      { id: "user-1", role: "user", parts: [] },
      {
        id: "assistant-1",
        role: "assistant",
        metadata: {
          type: "assistant",
          sessionId: "session-1",
          usage: {
            tokens: { prompt: 10, completion: 5, total: 15 },
          },
        },
        parts: [],
      },
    ];

    expect(getLatestAssistantMessageUsage(messages)).toEqual({
      tokenCount: { prompt: 10, completion: 5, total: 15 },
    });
  });
});

describe("getCacheUsageDisplay", () => {
  it("renders only cache read when cache write is zero", () => {
    expect(
      getCacheUsageDisplay({
        promptDetails: {
          cacheRead: 71168,
          cacheWrite: 0,
        },
      })
    ).toEqual({
      summaryText: "latest cache read 71,168",
      promptDetails: {
        "cache read": 71168,
      },
    });
  });

  it("renders both cache read and write when both are positive", () => {
    expect(
      getCacheUsageDisplay({
        promptDetails: {
          cacheRead: 71168,
          cacheWrite: 98229,
        },
      })
    ).toEqual({
      summaryText: "latest cache read 71,168 / cache write 98,229",
      promptDetails: {
        "cache read": 71168,
        "cache write": 98229,
      },
    });
  });

  it("keeps cache read visible when it is zero", () => {
    expect(
      getCacheUsageDisplay({
        promptDetails: {
          cacheRead: 0,
          cacheWrite: 98229,
        },
      })
    ).toEqual({
      summaryText: "latest cache read 0 / cache write 98,229",
      promptDetails: {
        "cache read": 0,
        "cache write": 98229,
      },
    });
  });

  it("omits cache usage when both cache counts are zero", () => {
    expect(
      getCacheUsageDisplay({
        promptDetails: {
          cacheRead: 0,
          cacheWrite: 0,
        },
      })
    ).toEqual({
      summaryText: null,
      promptDetails: undefined,
    });
  });

  it("omits cache usage when cache details are missing", () => {
    expect(getCacheUsageDisplay({ promptDetails: undefined })).toEqual({
      summaryText: null,
      promptDetails: undefined,
    });
  });
});
