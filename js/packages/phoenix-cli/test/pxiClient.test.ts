import type { UIMessageChunk } from "ai";
import { describe, expect, it, vi } from "vitest";

import {
  buildAgentSessionChatUrl,
  buildPxiChatRequest,
  buildPxiHeaders,
  createPxiChatClient,
  createPxiSessionClient,
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

  it("sends only the trailing message on the agent-session contract", () => {
    const options = createRuntimeOptions();
    const trailingMessage = userMessage("second question");

    const request = buildPxiChatRequest({
      messages: [userMessage("first question"), trailingMessage],
      options,
    });

    expect(request.message).toEqual(trailingMessage);
    expect(request).not.toHaveProperty("messages");
  });

  it("rejects an agent-session request without a message", () => {
    const options = createRuntimeOptions();

    expect(() => buildPxiChatRequest({ messages: [], options })).toThrow(
      "A chat submit request requires a message to send"
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

  it("uses OAuth access tokens when no API key is configured", () => {
    const headers = buildPxiHeaders({
      config: {
        endpoint: "http://localhost:6006",
        oauthTokens: {
          accessToken: "oauth-access",
          refreshToken: "oauth-refresh",
          expiresAt: "2999-01-01T00:00:00.000Z",
          scope: "",
        },
      },
    });

    expect(headers.Authorization).toBe("Bearer oauth-access");
  });

  it("builds the agent-session chat URL", () => {
    expect(
      buildAgentSessionChatUrl({
        endpoint: "http://localhost:6006/",
        agentSessionId: "QWdlbnRTZXNzaW9uOjE=",
      })
    ).toBe(
      "http://localhost:6006/agents/server/sessions/QWdlbnRTZXNzaW9uOjE%3D/chat"
    );
  });

  it("creates persisted and temporary sessions with the requested lifetime", async () => {
    const fetchImpl = vi.fn(
      async (_input: string | URL | Request, init?: RequestInit) => {
        const request =
          _input instanceof Request ? _input : new Request(_input, init);
        const body = (await request.json()) as { temporary: boolean };
        return new Response(
          JSON.stringify({
            data: {
              id: body.temporary ? "temporary-session" : "persisted-session",
            },
          }),
          { status: 201, headers: { "Content-Type": "application/json" } }
        );
      }
    ) as typeof fetch;
    const sessionClient = createPxiSessionClient({
      config: { endpoint: "http://localhost:6006" },
      fetch: fetchImpl,
    });

    const persisted = await sessionClient.createSession({ temporary: false });
    const temporary = await sessionClient.createSession({ temporary: true });

    expect(persisted).toMatchObject({
      id: "persisted-session",
      isTemporary: false,
    });
    expect(temporary).toMatchObject({
      id: "temporary-session",
      isTemporary: true,
    });
  });

  it("lists persisted sessions and restores their messages", async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            data: [
              {
                id: "session-1",
                title: "Investigate traces",
                created_at: "2026-07-24T11:00:00Z",
                updated_at: "2026-07-24T12:00:00Z",
                is_temporary: false,
              },
            ],
            next_cursor: null,
          }),
          { status: 200, headers: { "Content-Type": "application/json" } }
        )
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            data: {
              id: "session-1",
              title: "Investigate traces",
              created_at: "2026-07-24T11:00:00Z",
              updated_at: "2026-07-24T12:00:00Z",
              is_temporary: false,
              messages: [
                {
                  id: "user-1",
                  role: "user",
                  parts: [{ type: "text", text: "What failed?" }],
                },
              ],
            },
          }),
          { status: 200, headers: { "Content-Type": "application/json" } }
        )
      ) as typeof fetch;
    const sessionClient = createPxiSessionClient({
      config: { endpoint: "http://localhost:6006" },
      fetch: fetchImpl,
    });

    const sessions = await sessionClient.listSessions();
    const session = await sessionClient.getSession({ sessionId: "session-1" });

    expect(sessions).toEqual([
      {
        id: "session-1",
        title: "Investigate traces",
        updatedAt: "2026-07-24T12:00:00Z",
        isTemporary: false,
      },
    ]);
    expect(session.messages).toEqual([
      {
        id: "user-1",
        role: "user",
        parts: [{ type: "text", text: "What failed?" }],
      },
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

  it("reports transient session summary chunks", async () => {
    const options = createRuntimeOptions();
    const transport: PxiTransport = {
      sendMessages: async () =>
        createChunkStream([
          { type: "start", messageId: "assistant-1" },
          {
            type: "data-session-summary",
            data: "Investigate missing spans",
            transient: true,
          },
          { type: "text-start", id: "text-1" },
          { type: "text-delta", id: "text-1", delta: "Hello" },
          { type: "text-end", id: "text-1" },
          { type: "finish", finishReason: "stop" },
        ]),
      reconnectToStream: async () => null,
    };
    const sessionTitles: string[] = [];
    const client = createPxiChatClient({ options, transport });

    await client.sendMessage({
      messages: [userMessage("hello")],
      onAssistantMessage: () => undefined,
      onSessionTitle: (title) => sessionTitles.push(title),
    });

    expect(sessionTitles).toEqual(["Investigate missing spans"]);
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
