import { describe, expect, it } from "vitest";

import {
  createDefaultAgentCapabilities,
  type AgentCapabilities,
} from "@phoenix/agent/extensions/capabilities";

import {
  buildAgentChatRequestBody,
  enrichMessagesWithClientToolTimings,
} from "../buildAgentChatRequestBody";
import { createClientToolTimingRecorder } from "../clientToolTimings";
import type { AgentUIMessage } from "../types";

const agentsConfig = {
  collectorEndpoint: null,
  assistantProjectName: "assistant_agent",
  forceTracing: false,
  webAccessEnabled: false,
  assistantEnabled: true,
  allowLocalTraces: false,
  allowRemoteExport: false,
};

describe("buildAgentChatRequestBody", () => {
  it("echoes the active turn trace context", () => {
    const turnTraceContext = {
      traceId: "1".repeat(32),
      rootSpanId: "2".repeat(16),
      startedAt: "2026-07-10T12:00:00Z",
    };
    const body = buildAgentChatRequestBody({
      body: undefined,
      id: "session-1",
      messages: [],
      trigger: "submit-message",
      messageId: undefined,
      capabilities: createDefaultAgentCapabilities(),
      observability: {
        storeLocalTraces: false,
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
      turnTraceContext,
    });

    expect(body.turnTraceContext).toEqual(turnTraceContext);
  });

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
      // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- deliberately incomplete to exercise runtime defaulting of missing flags
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

  it("forces attachUserId when agent debugging is enabled", () => {
    const body = buildAgentChatRequestBody({
      body: undefined,
      id: "session-1",
      messages: [] as AgentUIMessage[],
      trigger: "submit-message",
      messageId: undefined,
      capabilities: createDefaultAgentCapabilities(),
      observability: {
        storeLocalTraces: false,
        exportRemoteTraces: false,
        attachUserId: false,
        acknowledgedTraceConsent: null,
      },
      agentsConfig: { ...agentsConfig, forceTracing: true },
      permissions: { edits: "manual" },
      contexts: [],
      modelSelection: {
        providerType: "builtin",
        provider: "OPENAI",
        modelName: "gpt-4o-mini",
      },
    });

    expect(body.attachUserId).toBe(true);
  });
});

describe("enrichMessagesWithClientToolTimings", () => {
  it("copies completed tool parts and preserves provider metadata", () => {
    const times = [
      new Date("2026-07-10T12:00:00Z"),
      new Date("2026-07-10T12:00:01Z"),
    ];
    const toolTimings = createClientToolTimingRecorder({
      getCurrentTime: () => times.shift() ?? new Date(0),
    });
    toolTimings.recordStart("call-1");
    toolTimings.recordEnd("call-1");
    const messages: AgentUIMessage[] = [
      {
        id: "assistant-1",
        role: "assistant",
        parts: [
          {
            type: "tool-read_prompt",
            toolCallId: "call-1",
            state: "output-available",
            input: { id: 1 },
            output: { name: "prompt" },
            callProviderMetadata: {
              phoenix: {
                tool_execution_environment: "client",
                tool_input_emitted_at: "2026-07-10T11:59:59Z",
              },
              provider: { retained: true },
            },
          },
        ],
      },
    ];
    const original = structuredClone(messages);

    const enriched = enrichMessagesWithClientToolTimings({
      messages,
      toolTimings,
    });

    expect(enriched).not.toBe(messages);
    expect(enriched[0]).not.toBe(messages[0]);
    expect(enriched[0]?.parts[0]).not.toBe(messages[0]?.parts[0]);
    expect(enriched[0]?.parts[0]).toMatchObject({
      callProviderMetadata: {
        provider: { retained: true },
        phoenix: {
          tool_execution_environment: "client",
          tool_input_emitted_at: "2026-07-10T11:59:59Z",
          client_started_at: "2026-07-10T12:00:00.000Z",
          client_ended_at: "2026-07-10T12:00:01.000Z",
        },
      },
    });
    expect(messages).toEqual(original);
  });

  it("leaves parts without complete timings untouched", () => {
    const toolTimings = createClientToolTimingRecorder();
    toolTimings.recordStart("call-1");
    const messages: AgentUIMessage[] = [
      {
        id: "assistant-1",
        role: "assistant",
        parts: [
          {
            type: "tool-read_prompt",
            toolCallId: "call-1",
            state: "output-available",
            input: {},
            output: "done",
          },
        ],
      },
    ];

    const enriched = enrichMessagesWithClientToolTimings({
      messages,
      toolTimings,
    });

    expect(enriched[0]).toBe(messages[0]);
    expect(enriched[0]?.parts[0]).toBe(messages[0]?.parts[0]);
  });
});
