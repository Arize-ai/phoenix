import { describe, expect, it } from "vitest";

import { createDefaultAgentCapabilities } from "@phoenix/agent/extensions/capabilities";

import { buildAgentChatRequestBody } from "../buildAgentChatRequestBody";
import type { AgentUIMessage } from "../types";

describe("buildAgentChatRequestBody", () => {
  it("merges the transport body with PXI chat metadata and omits client-supplied prompt overrides", () => {
    const body = buildAgentChatRequestBody({
      body: { existing: true },
      id: "session-1",
      messages: [] as AgentUIMessage[],
      trigger: "submit-message",
      messageId: undefined,
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
      traceNameSuffix: "Turn",
    });
    expect(body.contexts[0]).toMatchObject({
      type: "app",
      currentDateTime: expect.any(String),
      timeZone: expect.any(String),
    });
    expect(body).not.toHaveProperty("system");
  });
});
