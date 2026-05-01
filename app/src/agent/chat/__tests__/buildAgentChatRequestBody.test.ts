import { describe, expect, it } from "vitest";

import { createDefaultAgentCapabilities } from "@phoenix/agent/extensions/capabilities";

import { buildAgentChatRequestBody } from "../buildAgentChatRequestBody";
import type { AgentUIMessage } from "../types";

describe("buildAgentChatRequestBody", () => {
  it("sends only user-editable instructions for server prompt insertion", () => {
    const body = buildAgentChatRequestBody({
      body: { existing: true },
      id: "session-1",
      messages: [] as AgentUIMessage[],
      trigger: "submit-message",
      messageId: undefined,
      systemPrompt: "Prefer concise answers.",
      sessionId: "session-1",
      capabilities: createDefaultAgentCapabilities(),
      observability: {
        storeLocalTraces: true,
        exportRemoteTraces: false,
        hasAcknowledgedConsent: false,
      },
      hasRemoteCollector: false,
      contexts: [],
    });

    expect(body).toMatchObject({
      existing: true,
      userInstructions: "Prefer concise answers.",
      traceNameSuffix: "Turn",
    });
    expect(body).not.toHaveProperty("system");
  });
});
