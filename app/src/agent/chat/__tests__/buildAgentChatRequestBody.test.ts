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
      capabilities: createDefaultAgentCapabilities(),
      observability: {
        storeLocalTraces: true,
        exportRemoteTraces: false,
        hasAcknowledgedConsent: false,
      },
      hasRemoteCollector: false,
      isWebAccessEnabled: true,
      contexts: [],
      modelSelection: {
        providerType: "builtin",
        provider: "OPENAI",
        modelName: "gpt-4o-mini",
      },
    });

    expect(body).toMatchObject({
      existing: true,
      trigger: "submit-message",
      model: {
        providerType: "builtin",
        provider: "OPENAI",
        modelName: "gpt-4o-mini",
      },
    });
    expect(body.contexts?.[0]).toMatchObject({
      type: "app",
      currentDateTime: expect.any(String),
      timeZone: expect.any(String),
    });
    expect(body).not.toHaveProperty("system");
  });

  it("only requests web access when both the user and server allow it", () => {
    const capabilities = createDefaultAgentCapabilities();
    capabilities["web.access"] = true;

    const body = buildAgentChatRequestBody({
      body: undefined,
      id: "session-1",
      messages: [] as AgentUIMessage[],
      trigger: "submit-message",
      messageId: undefined,
      capabilities,
      observability: {
        storeLocalTraces: false,
        exportRemoteTraces: false,
        hasAcknowledgedConsent: false,
      },
      hasRemoteCollector: false,
      isWebAccessEnabled: false,
      contexts: [],
      modelSelection: {
        providerType: "builtin",
        provider: "OPENAI",
        modelName: "gpt-4o-mini",
      },
    });

    expect(body.capabilities).toEqual({ webAccess: false });
  });
});
