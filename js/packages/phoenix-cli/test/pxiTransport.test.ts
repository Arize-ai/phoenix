import { HttpResponse, http as mswHttp } from "@arizeai/phoenix-testing";
import { describe, expect, it } from "vitest";

import {
  createPxiChatClient,
  createServerAgentTransport,
  PXI_CREATE_AGENT_SESSION_MUTATION,
} from "../src/pxi/client";
import { resolvePxiRuntimeOptions } from "../src/pxi/options";
import { resolvePxiTransportMode } from "../src/pxi/preflight";
import type { PxiTransportMode } from "../src/pxi/types";
import { setupMockPhoenixServer } from "./mockServer";

const ENDPOINT = "http://localhost:6006";
const GRAPHQL_URL = `${ENDPOINT}/graphql`;
const VERSION_URL = `${ENDPOINT}/arize_phoenix_version`;
const AGENT_SESSION_ID = "QWdlbnRTZXNzaW9uOjE=";
// Both wire contracts share the server agent's URL; the server tells them
// apart by body shape (single `message` vs. full `messages` transcript).
const SERVER_AGENT_CHAT_URL = `${ENDPOINT}/agents/server/sessions/:sessionId/chat`;

const mock = setupMockPhoenixServer();

function createRuntimeOptions({
  transportMode,
}: {
  transportMode: PxiTransportMode;
}) {
  return resolvePxiRuntimeOptions({
    cliOptions: { endpoint: ENDPOINT },
    sessionId: "3f9a1c7e-0000-4000-8000-000000000000",
    transportMode,
  });
}

/** A minimal Vercel-AI UI message stream: one assistant text reply. */
function assistantSseResponse(text: string): HttpResponse {
  const chunks = [
    { type: "start", messageId: "assistant-1" },
    { type: "text-start", id: "text-1" },
    { type: "text-delta", id: "text-1", delta: text },
    { type: "text-end", id: "text-1" },
    { type: "finish" },
  ];
  const body = [
    ...chunks.map((chunk) => `data: ${JSON.stringify(chunk)}`),
    "data: [DONE]",
    "",
  ].join("\n\n");
  return new HttpResponse(body, {
    headers: { "Content-Type": "text/event-stream" },
  });
}

describe("PXI transport (agent-session contract)", () => {
  it("creates a temporary session once and posts single-message turns to it", async () => {
    const graphqlBodies: unknown[] = [];
    const chatRequests: Array<{ url: string; body: Record<string, unknown> }> =
      [];
    mock.server.use(
      mswHttp.post(GRAPHQL_URL, async ({ request }) => {
        graphqlBodies.push(await request.json());
        return HttpResponse.json({
          data: {
            createAgentSession: { agentSession: { id: AGENT_SESSION_ID } },
          },
        });
      }),
      mswHttp.post(SERVER_AGENT_CHAT_URL, async ({ request }) => {
        chatRequests.push({
          url: request.url,
          body: (await request.json()) as Record<string, unknown>,
        });
        return assistantSseResponse("Hello from the session");
      })
    );
    const options = createRuntimeOptions({ transportMode: "agent-session" });
    const client = createPxiChatClient({
      options,
      transport: createServerAgentTransport({ options }),
    });
    const firstUserMessage = {
      id: "user-1",
      role: "user" as const,
      parts: [{ type: "text" as const, text: "first question" }],
    };

    const reply = await client.sendMessage({
      messages: [firstUserMessage],
      onAssistantMessage: () => undefined,
    });

    expect(reply?.parts).toContainEqual(
      expect.objectContaining({ type: "text", text: "Hello from the session" })
    );
    expect(graphqlBodies).toEqual([
      { query: PXI_CREATE_AGENT_SESSION_MUTATION },
    ]);
    expect(chatRequests).toHaveLength(1);
    expect(chatRequests[0].url).toBe(
      `${ENDPOINT}/agents/server/sessions/${encodeURIComponent(AGENT_SESSION_ID)}/chat`
    );
    // The server owns the transcript: the body carries only the trailing
    // message, never a messages array.
    expect(chatRequests[0].body.message).toMatchObject({ id: "user-1" });
    expect(chatRequests[0].body).not.toHaveProperty("messages");
    expect(chatRequests[0].body).toMatchObject({
      trigger: "submit-message",
      editPermission: "manual",
      model: {
        providerType: "builtin",
        provider: "ANTHROPIC",
      },
    });

    // A second turn reuses the created session instead of minting another.
    const secondUserMessage = {
      id: "user-2",
      role: "user" as const,
      parts: [{ type: "text" as const, text: "second question" }],
    };
    await client.sendMessage({
      messages: [firstUserMessage, secondUserMessage],
      onAssistantMessage: () => undefined,
    });
    expect(graphqlBodies).toHaveLength(1);
    expect(chatRequests).toHaveLength(2);
    expect(chatRequests[1].body.message).toMatchObject({ id: "user-2" });
  });

  it("surfaces a session-creation failure and retries it on the next send", async () => {
    let graphqlCalls = 0;
    mock.server.use(
      mswHttp.post(GRAPHQL_URL, () => {
        graphqlCalls += 1;
        if (graphqlCalls === 1) {
          return HttpResponse.json({
            errors: [{ message: "agents are disabled" }],
          });
        }
        return HttpResponse.json({
          data: {
            createAgentSession: { agentSession: { id: AGENT_SESSION_ID } },
          },
        });
      }),
      mswHttp.post(SERVER_AGENT_CHAT_URL, () =>
        assistantSseResponse("recovered")
      )
    );
    const options = createRuntimeOptions({ transportMode: "agent-session" });
    const client = createPxiChatClient({
      options,
      transport: createServerAgentTransport({ options }),
    });
    const message = {
      id: "user-1",
      role: "user" as const,
      parts: [{ type: "text" as const, text: "hello" }],
    };

    await expect(
      client.sendMessage({
        messages: [message],
        onAssistantMessage: () => undefined,
      })
    ).rejects.toThrow("agents are disabled");

    const reply = await client.sendMessage({
      messages: [message],
      onAssistantMessage: () => undefined,
    });
    expect(reply?.parts).toContainEqual(
      expect.objectContaining({ type: "text", text: "recovered" })
    );
    expect(graphqlCalls).toBe(2);
  });
});

describe("PXI transport (legacy server-agent fallback)", () => {
  it("posts the full transcript to the legacy route under the client-minted id", async () => {
    const chatRequests: Array<{ url: string; body: Record<string, unknown> }> =
      [];
    mock.server.use(
      mswHttp.post(SERVER_AGENT_CHAT_URL, async ({ request }) => {
        chatRequests.push({
          url: request.url,
          body: (await request.json()) as Record<string, unknown>,
        });
        return assistantSseResponse("Hello from the legacy route");
      })
    );
    const options = createRuntimeOptions({
      transportMode: "legacy-server-agent",
    });
    const client = createPxiChatClient({
      options,
      transport: createServerAgentTransport({ options }),
    });

    const reply = await client.sendMessage({
      messages: [
        {
          id: "user-1",
          role: "user" as const,
          parts: [{ type: "text" as const, text: "hello" }],
        },
      ],
      onAssistantMessage: () => undefined,
    });

    expect(reply?.parts).toContainEqual(
      expect.objectContaining({
        type: "text",
        text: "Hello from the legacy route",
      })
    );
    expect(chatRequests).toHaveLength(1);
    expect(chatRequests[0].url).toBe(
      `${ENDPOINT}/agents/server/sessions/${options.sessionId}/chat`
    );
    const messages = chatRequests[0].body.messages as Array<{ id: string }>;
    expect(messages.map((message) => message.id)).toEqual(["user-1"]);
    expect(chatRequests[0].body).not.toHaveProperty("message");
  });
});

describe("resolvePxiTransportMode", () => {
  it.each([
    { version: "19.3.0", expected: "agent-session" as const },
    { version: "20.0.0", expected: "agent-session" as const },
    { version: "19.2.0", expected: "legacy-server-agent" as const },
  ])(
    "picks $expected for server version $version",
    async ({ version, expected }) => {
      mock.server.use(
        mswHttp.get(VERSION_URL, () => HttpResponse.text(version))
      );

      await expect(
        resolvePxiTransportMode({
          config: { endpoint: ENDPOINT },
        })
      ).resolves.toBe(expected);
    }
  );

  it("falls back to the legacy transport when the version is undetectable", async () => {
    mock.server.use(mswHttp.get(VERSION_URL, () => HttpResponse.error()));

    await expect(
      resolvePxiTransportMode({
        config: { endpoint: ENDPOINT },
      })
    ).resolves.toBe("legacy-server-agent");
  });
});
