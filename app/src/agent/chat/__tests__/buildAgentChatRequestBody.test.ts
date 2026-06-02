import { describe, expect, it } from "vitest";

import { createDefaultAgentCapabilities } from "@phoenix/agent/extensions/capabilities";

import { buildAgentChatRequestBody } from "../buildAgentChatRequestBody";
import type { AgentUIMessage } from "../types";

const agentsConfig = {
  collectorEndpoint: null,
  assistantProjectName: "assistant_agent",
  webAccessEnabled: false,
  assistantEnabled: true,
  allowLocalTraces: false,
  allowRemoteExport: false,
};

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
        acknowledgedTraceConsent: null,
      },
      agentsConfig,
      permissions: { edits: "manual" },
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
      editPermission: "manual",
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
    expect(body.contexts?.[0]).not.toHaveProperty("editPermission");
    expect(body).not.toHaveProperty("system");
  });

  it("forwards the user's web access toggle as a context entry", () => {
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
        acknowledgedTraceConsent: null,
      },
      agentsConfig,
      permissions: { edits: "bypass" },
      contexts: [],
      modelSelection: {
        providerType: "builtin",
        provider: "OPENAI",
        modelName: "gpt-4o-mini",
      },
    });

    expect(body.contexts).toContainEqual({
      type: "web_access",
      enabled: true,
    });
  });

  it("applies server trace ceilings to trace request flags", () => {
    const body = buildAgentChatRequestBody({
      body: undefined,
      id: "session-1",
      messages: [] as AgentUIMessage[],
      trigger: "submit-message",
      messageId: undefined,
      capabilities: createDefaultAgentCapabilities(),
      observability: {
        storeLocalTraces: true,
        exportRemoteTraces: true,
        acknowledgedTraceConsent: {
          allowLocalTraces: true,
          allowRemoteExport: true,
        },
      },
      agentsConfig: {
        ...agentsConfig,
        collectorEndpoint: "https://collector.example.com",
        allowLocalTraces: false,
        allowRemoteExport: true,
      },
      permissions: { edits: "manual" },
      contexts: [],
      modelSelection: {
        providerType: "builtin",
        provider: "OPENAI",
        modelName: "gpt-4o-mini",
      },
    });

    expect(body.ingestTraces).toBe(false);
    expect(body.exportRemoteTraces).toBe(true);
  });
});
