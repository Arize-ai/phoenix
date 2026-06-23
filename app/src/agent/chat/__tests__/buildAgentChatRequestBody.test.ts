import { describe, expect, it } from "vitest";

import {
  createDefaultAgentCapabilities,
  type AgentCapabilities,
} from "@phoenix/agent/extensions/capabilities";

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
        attachUserId: false,
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
      attachUserId: false,
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
        attachUserId: false,
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

  it("defaults missing capability flags before serializing contexts", () => {
    const body = buildAgentChatRequestBody({
      body: undefined,
      id: "session-1",
      messages: [] as AgentUIMessage[],
      trigger: "submit-message",
      messageId: undefined,
      capabilities: {} as AgentCapabilities,
      observability: {
        storeLocalTraces: false,
        exportRemoteTraces: false,
        attachUserId: false,
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
      type: "graphql",
      mutationsEnabled: false,
    });
    expect(body.contexts).toContainEqual({
      type: "web_access",
      enabled: false,
    });
    expect(body.contexts).toContainEqual({
      type: "subagents",
      enabled: false,
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
        attachUserId: false,
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

  it("propagates attachUserId opt-in to the request body", () => {
    const body = buildAgentChatRequestBody({
      body: undefined,
      id: "session-1",
      messages: [] as AgentUIMessage[],
      trigger: "submit-message",
      messageId: undefined,
      capabilities: createDefaultAgentCapabilities(),
      observability: {
        storeLocalTraces: true,
        exportRemoteTraces: false,
        attachUserId: true,
        acknowledgedTraceConsent: {
          allowLocalTraces: true,
          allowRemoteExport: false,
        },
      },
      agentsConfig: { ...agentsConfig, allowLocalTraces: true },
      permissions: { edits: "manual" },
      contexts: [],
      modelSelection: {
        providerType: "builtin",
        provider: "OPENAI",
        modelName: "gpt-4o-mini",
      },
    });

    expect(body.attachUserId).toBe(true);
    expect(body.ingestTraces).toBe(true);
  });
});
