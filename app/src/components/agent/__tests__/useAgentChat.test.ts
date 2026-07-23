import { describe, expect, it } from "vitest";

import type { AgentUIMessage } from "@phoenix/agent/chat/types";

import { getRemovedUserMessageText } from "../useAgentChat";

describe("getRemovedUserMessageText", () => {
  it("does not restore a compaction checkpoint into the composer", () => {
    const compactionMessage = {
      id: "compaction-message",
      role: "user",
      metadata: {
        type: "user",
        currentDateTime: "2026-01-01T00:00:00Z",
        timeZone: "UTC",
        isCompactionMessage: true,
      },
      parts: [{ type: "text", text: '{"objectives":["Understand traces"]}' }],
    } as AgentUIMessage;

    expect(
      getRemovedUserMessageText([compactionMessage], compactionMessage.id)
    ).toBeNull();
  });

  it("continues to restore ordinary user messages", () => {
    const userMessage = {
      id: "user-message",
      role: "user",
      parts: [{ type: "text", text: "What is a trace?" }],
    } as AgentUIMessage;

    expect(getRemovedUserMessageText([userMessage], userMessage.id)).toBe(
      "What is a trace?"
    );
  });
});
