import { describe, expect, it } from "vitest";

import type { AgentUIMessage } from "@phoenix/agent/chat/types";

import {
  getAgentCompactErrorMessage,
  getRemovedUserMessageText,
} from "../useAgentChat";

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

describe("getAgentCompactErrorMessage", () => {
  it("uses the detail of a JSON error body", () => {
    const body = { detail: "Conversation compaction failed: upstream refused" };
    expect(getAgentCompactErrorMessage(body, JSON.stringify(body), 502)).toBe(
      "Conversation compaction failed: upstream refused"
    );
  });

  it("uses a plain-text body, which is how the server sends HTTPException details", () => {
    // `plain_text_http_exception_handler` returns text/plain, so the 507 raised
    // when storage is locked has no JSON to parse. Falling through to the
    // status would have thrown the server's guidance away.
    const rawBody =
      "Database operations are disabled due to insufficient storage. " +
      "Please delete old data or increase storage.";

    expect(getAgentCompactErrorMessage(null, rawBody, 507)).toBe(rawBody);
  });

  it("trims surrounding whitespace from a plain-text body", () => {
    expect(
      getAgentCompactErrorMessage(null, "  Agents are disabled\n", 403)
    ).toBe("Agents are disabled");
  });

  it("falls back to the status only when the response had no body", () => {
    expect(getAgentCompactErrorMessage(null, "", 507)).toBe(
      "Compaction failed with status 507."
    );
  });
});
