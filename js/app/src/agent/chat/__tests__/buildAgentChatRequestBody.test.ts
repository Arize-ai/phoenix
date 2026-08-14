import { describe, expect, it } from "vitest";

import {
  createDefaultAgentCapabilities,
  type AgentCapabilities,
} from "@phoenix/agent/extensions/capabilities";

import {
  buildAgentChatRequestBody,
  enrichMessageWithClientToolMetadata,
} from "../buildAgentChatRequestBody";
import { createClientToolTimingRecorder } from "../clientToolTimings";
import type { AgentUIMessage } from "../types";

const userMessage: AgentUIMessage = {
  id: "user-1",
  role: "user",
  parts: [{ type: "text", text: "hello" }],
};

const agentsConfig = {
  collectorEndpoint: null,
  assistantProjectName: "assistant_agent",
  forceTracing: false,
  webAccessEnabled: false,
  assistantEnabled: true,
  allowLocalTraces: false,
  allowRemoteExport: false,
  sessionRetentionMaxIdleDays: 30,
  sessionRetentionMaxCountPerUser: null,
};

describe("buildAgentChatRequestBody", () => {
  it("merges the transport body with PXI chat metadata and omits client-supplied prompt overrides", () => {
    const body = buildAgentChatRequestBody({
      body: { requestedSkills: ["debug-trace"] },
      id: "session-1",
      messages: [userMessage],
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
      requestedSkills: ["debug-trace"],
      trigger: "submit-message",
      instrumentUserId: false,
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
      messages: [userMessage],
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
      messages: [userMessage],
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
      messages: [userMessage],
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

    expect(body.recordLocalTraces).toBe(false);
    expect(body.exportRemoteTraces).toBe(true);
  });

  it("propagates the attach-user-id opt-in to the request body as instrumentUserId", () => {
    const body = buildAgentChatRequestBody({
      body: undefined,
      id: "session-1",
      messages: [userMessage],
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

    expect(body.instrumentUserId).toBe(true);
    expect(body.recordLocalTraces).toBe(true);
  });

  it("forces attachUserId when agent debugging is enabled", () => {
    const body = buildAgentChatRequestBody({
      body: undefined,
      id: "session-1",
      messages: [userMessage],
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

    expect(body.instrumentUserId).toBe(true);
  });

  it("sends only the trailing message; the server owns the transcript", () => {
    const earlierAssistant: AgentUIMessage = {
      id: "assistant-1",
      role: "assistant",
      parts: [{ type: "text", text: "earlier reply" }],
    };
    const newUserMessage: AgentUIMessage = {
      id: "user-2",
      role: "user",
      parts: [{ type: "text", text: "follow-up" }],
    };

    const body = buildAgentChatRequestBody({
      body: undefined,
      id: "session-1",
      messages: [userMessage, earlierAssistant, newUserMessage],
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
    });

    expect(body.trigger).toBe("submit-message");
    expect(body).not.toHaveProperty("messages");
    expect(body.message?.id).toBe("user-2");
    // The message before the submitted one is the transcript's persisted
    // tail — the send's optimistic-concurrency check.
    expect(body.lastMessageId).toBe("assistant-1");
  });

  it("omits lastMessageId on a session's first message", () => {
    const body = buildAgentChatRequestBody({
      body: undefined,
      id: "session-1",
      messages: [userMessage],
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
    });

    expect(body.lastMessageId).toBeUndefined();
  });

  it("treats a compaction checkpoint as the persisted tail for lastMessageId", () => {
    const compactionMessage: AgentUIMessage = {
      id: "compaction-1",
      role: "user",
      metadata: {
        phoenix: {
          type: "user",
          currentDateTime: "2026-01-01T00:00:00Z",
          timeZone: "UTC",
          isCompactionMessage: true,
        },
      },
      parts: [{ type: "text", text: "Summary of the conversation so far." }],
    };
    const newUserMessage: AgentUIMessage = {
      id: "user-2",
      role: "user",
      parts: [{ type: "text", text: "follow-up after compaction" }],
    };

    const body = buildAgentChatRequestBody({
      body: undefined,
      id: "session-1",
      messages: [userMessage, compactionMessage, newUserMessage],
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
    });

    // Compaction checkpoints are persisted transcript messages and valid
    // follow-up points — never skipped when computing the tail.
    expect(body.lastMessageId).toBe("compaction-1");
  });

  it("sends resolved client tool outputs instead of the assistant message on continuations", () => {
    const continuationAssistant: AgentUIMessage = {
      id: "assistant-1",
      role: "assistant",
      parts: [
        { type: "text", text: "working on it" },
        {
          type: "tool-read_prompt",
          toolCallId: "call-1",
          state: "output-available",
          input: {},
          output: { ok: true },
          callProviderMetadata: {
            phoenix: {
              toolExecutionEnvironment: "client",
              toolInputEmittedAt: "2026-07-10T12:00:00Z",
            },
          },
        },
        {
          type: "tool-load_skill",
          toolCallId: "call-2",
          state: "output-available",
          input: {},
          output: "<skill/>",
          callProviderMetadata: {
            phoenix: { toolExecutionEnvironment: "server" },
          },
        },
      ],
    };

    const body = buildAgentChatRequestBody({
      body: undefined,
      id: "session-1",
      messages: [userMessage, continuationAssistant],
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
    });

    // The server owns the assistant message; only the client-executed tool
    // outputs travel, and the message field is omitted entirely.
    expect(body.message).toBeUndefined();
    expect(body.toolOutputs?.map((part) => part.toolCallId)).toEqual([
      "call-1",
    ]);
    // The continued assistant message is itself the persisted transcript tail.
    expect(body.lastMessageId).toBe("assistant-1");
  });

  it("attaches interrupted client tool outputs to a superseding user message", () => {
    const interruptedAssistant: AgentUIMessage = {
      id: "assistant-1",
      role: "assistant",
      parts: [
        {
          type: "tool-edit_prompt",
          toolCallId: "call-1",
          state: "output-error",
          input: {},
          errorText: "The user has interrupted this tool call.",
          callProviderMetadata: {
            phoenix: {
              toolExecutionEnvironment: "client",
              toolInputEmittedAt: "2026-07-10T12:00:00Z",
            },
          },
        },
      ],
    };
    const newUserMessage: AgentUIMessage = {
      id: "user-2",
      role: "user",
      parts: [{ type: "text", text: "never mind" }],
    };

    const body = buildAgentChatRequestBody({
      body: undefined,
      id: "session-1",
      messages: [userMessage, interruptedAssistant, newUserMessage],
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
    });

    expect(body.message?.id).toBe("user-2");
    expect(body.toolOutputs?.map((part) => part.toolCallId)).toEqual([
      "call-1",
    ]);
    expect(body.lastMessageId).toBe("assistant-1");
  });
});

describe("enrichMessageWithClientToolMetadata", () => {
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
    const message: AgentUIMessage = {
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
              toolExecutionEnvironment: "client",
              toolInputEmittedAt: "2026-07-10T11:59:59Z",
            },
            provider: { retained: true },
          },
        },
      ],
    };
    const original = structuredClone(message);

    const enriched = enrichMessageWithClientToolMetadata({
      message,
      toolTimings,
    });

    expect(enriched).not.toBe(message);
    expect(enriched.parts[0]).not.toBe(message.parts[0]);
    expect(enriched.parts[0]).toMatchObject({
      callProviderMetadata: {
        provider: { retained: true },
        phoenix: {
          toolExecutionEnvironment: "client",
          toolInputEmittedAt: "2026-07-10T11:59:59Z",
          clientStartedAt: "2026-07-10T12:00:00.000Z",
          clientEndedAt: "2026-07-10T12:00:01.000Z",
        },
      },
    });
    expect(message).toEqual(original);
  });

  it("leaves parts without complete timings untouched", () => {
    const toolTimings = createClientToolTimingRecorder();
    toolTimings.recordStart("call-1");
    const message: AgentUIMessage = {
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
    };

    const enriched = enrichMessageWithClientToolMetadata({
      message,
      toolTimings,
    });

    expect(enriched).toBe(message);
    expect(enriched.parts[0]).toBe(message.parts[0]);
  });

  it("stamps the interrupted outcome on marked resolved parts", () => {
    const message: AgentUIMessage = {
      id: "assistant-1",
      role: "assistant",
      parts: [
        {
          type: "tool-edit_prompt_instance",
          toolCallId: "call-1",
          state: "output-error",
          input: {},
          errorText: "The user has interrupted this tool call.",
          callProviderMetadata: {
            phoenix: {
              toolExecutionEnvironment: "client",
              toolInputEmittedAt: "2026-07-10T11:59:59Z",
            },
          },
        },
        {
          type: "tool-read_prompt",
          toolCallId: "call-2",
          state: "output-available",
          input: {},
          output: "done",
          callProviderMetadata: {
            phoenix: { toolExecutionEnvironment: "client" },
          },
        },
      ],
    };

    const enriched = enrichMessageWithClientToolMetadata({
      message,
      toolTimings: null,
      locallyInterruptedToolCallIds: { "call-1": true },
    });

    expect(enriched.parts[0]).toMatchObject({
      callProviderMetadata: {
        phoenix: {
          toolExecutionEnvironment: "client",
          toolInputEmittedAt: "2026-07-10T11:59:59Z",
          outcome: "interrupted",
        },
      },
    });
    // Unmarked parts are untouched.
    expect(enriched.parts[1]).toBe(message.parts[1]);
  });
});
