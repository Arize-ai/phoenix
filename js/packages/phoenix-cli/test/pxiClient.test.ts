import type { UIMessageChunk } from "ai";
import { describe, expect, it } from "vitest";

import {
  buildAgentChatUrl,
  buildPxiChatRequest,
  buildPxiHeaders,
  buildServerAgentChatUrl,
  createPxiChatClient,
} from "../src/pxi/client";
import { resolvePxiRuntimeOptions } from "../src/pxi/options";
import type { PxiMessage, PxiTransport } from "../src/pxi/types";

function createRuntimeOptions(
  cliOptions: Parameters<typeof resolvePxiRuntimeOptions>[0]["cliOptions"] = {}
) {
  return resolvePxiRuntimeOptions({
    cliOptions: {
      endpoint: "http://localhost:6006",
      ...cliOptions,
    },
    sessionId: "session-1",
  });
}

function userMessage(text: string): PxiMessage {
  return {
    id: "user-1",
    role: "user",
    parts: [{ type: "text", text }],
  };
}

function createChunkStream(
  chunks: UIMessageChunk[]
): ReadableStream<UIMessageChunk> {
  return new ReadableStream({
    start(controller) {
      for (const chunk of chunks) {
        controller.enqueue(chunk);
      }
      controller.close();
    },
  });
}

function createSseResponse(chunks: UIMessageChunk[]): Response {
  return new Response(
    `${chunks.map((chunk) => `data: ${JSON.stringify(chunk)}\n\n`).join("")}data: [DONE]\n\n`,
    {
      status: 200,
      headers: {
        "Content-Type": "text/event-stream",
        "x-vercel-ai-ui-message-stream": "v1",
      },
    }
  );
}

describe("PXI client", () => {
  it("builds a built-in model request with context and observability flags", () => {
    const options = createRuntimeOptions({
      provider: "OPENAI",
      model: "gpt-5.4",
      enableWebAccess: true,
      enableSubagents: true,
      enableGraphqlMutations: true,
      bypassEdits: true,
      ingestTraces: true,
      exportRemoteTraces: true,
      attachUserId: true,
    });

    const request = buildPxiChatRequest({
      messages: [userMessage("hello")],
      options,
    });

    expect(request).toMatchObject({
      id: "session-1",
      trigger: "submit-message",
      ingestTraces: true,
      exportRemoteTraces: true,
      attachUserId: true,
      editPermission: "bypass",
      model: {
        providerType: "builtin",
        provider: "OPENAI",
        modelName: "gpt-5.4",
      },
    });
    expect(request.contexts).toEqual(
      expect.arrayContaining([
        { type: "graphql", mutationsEnabled: true },
        { type: "web_access", enabled: true },
        { type: "subagents", enabled: true },
      ])
    );
  });

  it("builds a custom provider model request", () => {
    const options = createRuntimeOptions({
      customProviderId: "provider-1",
      model: "custom-model",
    });

    const request = buildPxiChatRequest({
      messages: [userMessage("hello")],
      options,
    });

    expect(request.model).toEqual({
      providerType: "custom",
      providerId: "provider-1",
      modelName: "custom-model",
    });
  });

  it("propagates configured headers and auth", () => {
    const headers = buildPxiHeaders({
      config: {
        endpoint: "http://localhost:6006",
        apiKey: "secret",
        headers: { "X-Phoenix": "pxi" },
      },
    });

    expect(headers).toEqual({
      "X-Phoenix": "pxi",
      Authorization: "Bearer secret",
    });
  });

  it("builds the server-agent chat URL", () => {
    expect(
      buildServerAgentChatUrl({
        endpoint: "http://localhost:6006/",
        sessionId: "session with spaces",
      })
    ).toBe(
      "http://localhost:6006/agents/server/sessions/session%20with%20spaces/chat"
    );
  });

  it("builds the persisted server-agent chat URL", () => {
    expect(buildAgentChatUrl({ endpoint: "http://localhost:6006/" })).toBe(
      "http://localhost:6006/agents/server/chat"
    );
  });

  it("includes a persisted session id only after one is assigned", () => {
    const options = createRuntimeOptions();
    const firstRequest = buildPxiChatRequest({
      messages: [userMessage("first")],
      options,
    });
    const resumedRequest = buildPxiChatRequest({
      messages: [userMessage("second")],
      options,
      agentSessionId: "QWdlbnRTZXNzaW9uOjE=",
    });

    expect(firstRequest).not.toHaveProperty("agentSessionId");
    expect(resumedRequest.agentSessionId).toBe("QWdlbnRTZXNzaW9uOjE=");
  });

  it("captures transient session chunks and resumes the next turn", async () => {
    const options = createRuntimeOptions();
    options.chatRoute = "persisted";
    const requestBodies: unknown[] = [];
    const fetchImpl: typeof globalThis.fetch = async (_input, init) => {
      requestBodies.push(JSON.parse(String(init?.body)));
      return createSseResponse([
        { type: "start", messageId: "assistant-1" },
        {
          type: "data-session-created",
          data: {
            id: "QWdlbnRTZXNzaW9uOjE=",
            title: "",
            createdAt: "2026-07-16T12:00:00Z",
            updatedAt: "2026-07-16T12:00:00Z",
          },
          transient: true,
        },
        {
          type: "data-session-summary",
          data: "Project investigation",
          transient: true,
        },
        { type: "text-start", id: "text-1" },
        { type: "text-delta", id: "text-1", delta: "Done" },
        { type: "text-end", id: "text-1" },
        { type: "finish", finishReason: "stop" },
      ]);
    };
    const titles: string[] = [];
    const client = createPxiChatClient({ options, fetch: fetchImpl });

    await client.sendMessage({
      messages: [userMessage("first")],
      onAssistantMessage: () => undefined,
      onSessionTitle: (title) => titles.push(title),
    });
    await client.sendMessage({
      messages: [userMessage("second")],
      onAssistantMessage: () => undefined,
      onSessionTitle: (title) => titles.push(title),
    });

    expect(requestBodies[0]).not.toHaveProperty("agentSessionId");
    expect(requestBodies[1]).toMatchObject({
      agentSessionId: "QWdlbnRTZXNzaW9uOjE=",
    });
    expect(titles).toContain("Project investigation");
  });

  it("retries a missing persisted route once with the legacy URL", async () => {
    const options = createRuntimeOptions({ noProgress: true });
    options.chatRoute = "persisted";
    const requestUrls: string[] = [];
    const fetchImpl: typeof globalThis.fetch = async (input) => {
      requestUrls.push(String(input));
      if (requestUrls.length === 1) {
        return new Response("Not found", { status: 404 });
      }
      return createSseResponse([
        { type: "start", messageId: "assistant-1" },
        { type: "text-start", id: "text-1" },
        { type: "text-delta", id: "text-1", delta: "Done" },
        { type: "text-end", id: "text-1" },
        { type: "finish", finishReason: "stop" },
      ]);
    };
    const client = createPxiChatClient({ options, fetch: fetchImpl });

    await client.sendMessage({
      messages: [userMessage("hello")],
      onAssistantMessage: () => undefined,
    });

    expect(requestUrls).toEqual([
      "http://localhost:6006/agents/server/chat",
      "http://localhost:6006/agents/server/sessions/session-1/chat",
    ]);
  });

  it("streams assistant text updates", async () => {
    const options = createRuntimeOptions();
    const transport: PxiTransport = {
      sendMessages: async () =>
        createChunkStream([
          { type: "start", messageId: "assistant-1" },
          { type: "text-start", id: "text-1" },
          { type: "text-delta", id: "text-1", delta: "Hello" },
          { type: "text-end", id: "text-1" },
          { type: "finish", finishReason: "stop" },
        ]),
      reconnectToStream: async () => null,
    };
    const updates: PxiMessage[] = [];
    const client = createPxiChatClient({ options, transport });

    const finalMessage = await client.sendMessage({
      messages: [userMessage("hello")],
      onAssistantMessage: (message) => updates.push(message),
    });

    expect(finalMessage?.parts).toEqual([
      {
        type: "text",
        text: "Hello",
        state: "done",
        providerMetadata: undefined,
      },
    ]);
    expect(updates.at(-1)).toEqual(finalMessage);
  });

  it("streams tool progress into assistant message parts", async () => {
    const options = createRuntimeOptions();
    const transport: PxiTransport = {
      sendMessages: async () =>
        createChunkStream([
          { type: "start", messageId: "assistant-1" },
          {
            type: "tool-input-start",
            toolCallId: "tool-1",
            toolName: "phoenix_graphql",
            dynamic: true,
          },
          {
            type: "tool-input-available",
            toolCallId: "tool-1",
            toolName: "phoenix_graphql",
            input: { query: "{ projects { id } }" },
            dynamic: true,
          },
          {
            type: "tool-output-available",
            toolCallId: "tool-1",
            output: { ok: true },
            dynamic: true,
          },
          { type: "finish", finishReason: "stop" },
        ]),
      reconnectToStream: async () => null,
    };
    const updates: PxiMessage[] = [];
    const client = createPxiChatClient({ options, transport });

    await client.sendMessage({
      messages: [userMessage("hello")],
      onAssistantMessage: (message) => updates.push(message),
    });

    expect(updates.at(-1)?.parts).toContainEqual(
      expect.objectContaining({
        type: "dynamic-tool",
        toolCallId: "tool-1",
        toolName: "phoenix_graphql",
        state: "output-available",
        output: { ok: true },
      })
    );
  });

  it("formats runtime provider errors with the selected model", async () => {
    const options = createRuntimeOptions({
      provider: "ANTHROPIC",
      model: "claude-opus-4-6",
    });
    const transport: PxiTransport = {
      sendMessages: async () => {
        throw new Error("ProviderCredentialsError: missing ANTHROPIC_API_KEY");
      },
      reconnectToStream: async () => null,
    };
    const client = createPxiChatClient({ options, transport });

    await expect(
      client.sendMessage({
        messages: [userMessage("hello")],
        onAssistantMessage: () => undefined,
      })
    ).rejects.toThrow(
      "PXI request failed for ANTHROPIC/claude-opus-4-6: ProviderCredentialsError: missing ANTHROPIC_API_KEY"
    );
  });
});
