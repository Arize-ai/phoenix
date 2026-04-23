import { describe, expect, it } from "vitest";

import { createDefaultAgentCapabilities } from "@phoenix/agent/extensions/capabilities";

import { buildAgentChatRequestBody } from "../buildAgentChatRequestBody";

describe("buildAgentChatRequestBody", () => {
  it("includes advertised contexts in the request payload", () => {
    const body = buildAgentChatRequestBody({
      body: undefined,
      id: "session-1",
      messages: [],
      trigger: "submit-message",
      messageId: undefined,
      systemPrompt: "System prompt",
      sessionId: "session-1",
      capabilities: createDefaultAgentCapabilities(),
      observability: {
        storeLocalTraces: true,
        exportRemoteTraces: false,
        hasAcknowledgedConsent: true,
      },
      hasRemoteCollector: false,
      contexts: [
        { type: "project", projectId: "P1" },
        { type: "trace", projectId: "P1", traceId: "T1" },
      ],
    });

    expect(body.contexts).toEqual([
      { type: "project", projectId: "P1" },
      { type: "trace", projectId: "P1", traceId: "T1" },
    ]);
  });
});
