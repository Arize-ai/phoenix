import { describe, expect, it } from "vitest";

import {
  formatCacheSummary,
  formatTokenCount,
  formatTokenUsageLine,
  getLatestAssistantUsage,
} from "../src/pxi/tokenUsage";
import type { PxiMessage } from "../src/pxi/types";

function assistantMessage(
  id: string,
  usage?: PxiMessage["metadata"]
): PxiMessage {
  return {
    id,
    role: "assistant",
    parts: [{ type: "text", text: "hi", state: "done" }],
    ...(usage ? { metadata: usage } : {}),
  };
}

describe("getLatestAssistantUsage", () => {
  it("returns null when no assistant message carries usage", () => {
    const messages: PxiMessage[] = [
      { id: "user-1", role: "user", parts: [{ type: "text", text: "hi" }] },
      assistantMessage("assistant-1"),
    ];
    expect(getLatestAssistantUsage(messages)).toBeNull();
  });

  it("returns the usage from the most recent assistant message that has it", () => {
    const messages: PxiMessage[] = [
      assistantMessage("assistant-1", {
        sessionId: "s",
        usage: { tokens: { prompt: 1, completion: 1, total: 2 } },
      }),
      assistantMessage("assistant-2", {
        sessionId: "s",
        usage: { tokens: { prompt: 10, completion: 5, total: 15 } },
      }),
    ];
    expect(getLatestAssistantUsage(messages)?.tokens.total).toBe(15);
  });

  it("skips a trailing assistant message without usage and falls back to an earlier one", () => {
    const messages: PxiMessage[] = [
      assistantMessage("assistant-1", {
        sessionId: "s",
        usage: { tokens: { prompt: 10, completion: 5, total: 15 } },
      }),
      assistantMessage("assistant-2"),
    ];
    expect(getLatestAssistantUsage(messages)?.tokens.total).toBe(15);
  });
});

describe("formatTokenCount", () => {
  it("formats with thousands separators", () => {
    expect(formatTokenCount(1234567)).toBe("1,234,567");
    expect(formatTokenCount(42)).toBe("42");
  });
});

describe("formatCacheSummary", () => {
  it("returns null when there is no cache activity", () => {
    expect(formatCacheSummary(null)).toBeNull();
    expect(formatCacheSummary({ cacheRead: 0, cacheWrite: 0 })).toBeNull();
  });

  it("shows cache read only when there is no cache write", () => {
    expect(formatCacheSummary({ cacheRead: 1234, cacheWrite: 0 })).toBe(
      "cache read 1,234"
    );
  });

  it("shows both cache read and write when present", () => {
    expect(formatCacheSummary({ cacheRead: 1234, cacheWrite: 56 })).toBe(
      "cache read 1,234 / cache write 56"
    );
  });
});

describe("formatTokenUsageLine", () => {
  it("returns null when there is no usage", () => {
    expect(formatTokenUsageLine(null)).toBeNull();
  });

  it("shows the total token count", () => {
    expect(
      formatTokenUsageLine({
        tokens: { prompt: 100, completion: 23, total: 123 },
      })
    ).toBe("123 tokens");
  });

  it("prefixes the cache summary before the total", () => {
    expect(
      formatTokenUsageLine({
        tokens: { prompt: 1000, completion: 234, total: 1234 },
        promptDetails: { cacheRead: 800, cacheWrite: 200 },
      })
    ).toBe("cache read 800 / cache write 200  ·  1,234 tokens");
  });
});
