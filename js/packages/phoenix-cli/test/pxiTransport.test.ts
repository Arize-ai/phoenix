import { HttpResponse, http as mswHttp } from "@arizeai/phoenix-testing";
import { describe, expect, it } from "vitest";

import {
  createPxiChatClient,
  createServerAgentTransport,
} from "../src/pxi/client";
import { resolvePxiRuntimeOptions } from "../src/pxi/options";
import { setupMockPhoenixServer } from "./mockServer";

const ENDPOINT = "http://localhost:6006";
const CREATE_SESSION_URL = `${ENDPOINT}/agents/server/sessions`;
const AGENT_SESSION_ID = "QWdlbnRTZXNzaW9uOjE=";
const SERVER_AGENT_CHAT_URL = `${ENDPOINT}/agents/server/sessions/:sessionId/chat`;

const mock = setupMockPhoenixServer();

function createRuntimeOptions() {
  return resolvePxiRuntimeOptions({
    cliOptions: { endpoint: ENDPOINT },
    sessionId: "3f9a1c7e-0000-4000-8000-000000000000",
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
    const createSessionBodies: unknown[] = [];
    const chatRequests: Array<{ url: string; body: Record<string, unknown> }> =
      [];
    mock.server.use(
      mswHttp.post(CREATE_SESSION_URL, async ({ request }) => {
        createSessionBodies.push(await request.json());
        return HttpResponse.json({ data: { id: AGENT_SESSION_ID } }, { status: 201 });
      }),
      mswHttp.post(SERVER_AGENT_CHAT_URL, async ({ request }) => {
        chatRequests.push({
          url: request.url,
          body: (await request.json()) as Record<string, unknown>,
        });
        return assistantSseResponse("Hello from the session");
      })
    );
    const options = createRuntimeOptions();
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
    expect(createSessionBodies).toEqual([{ title: "", temporary: true }]);
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
    expect(createSessionBodies).toHaveLength(1);
    expect(chatRequests).toHaveLength(2);
    expect(chatRequests[1].body.message).toMatchObject({ id: "user-2" });
  });

  it("surfaces a session-creation failure and retries it on the next send", async () => {
    let createSessionCalls = 0;
    mock.server.use(
      mswHttp.post(CREATE_SESSION_URL, () => {
        createSessionCalls += 1;
        if (createSessionCalls === 1) {
          return HttpResponse.json(
            { detail: "Agents are disabled" },
            { status: 403 }
          );
        }
        return HttpResponse.json({ data: { id: AGENT_SESSION_ID } }, { status: 201 });
      }),
      mswHttp.post(SERVER_AGENT_CHAT_URL, () =>
        assistantSseResponse("recovered")
      )
    );
    const options = createRuntimeOptions();
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
    ).rejects.toThrow("Agents are disabled");

    const reply = await client.sendMessage({
      messages: [message],
      onAssistantMessage: () => undefined,
    });
    expect(reply?.parts).toContainEqual(
      expect.objectContaining({ type: "text", text: "recovered" })
    );
    expect(createSessionCalls).toBe(2);
  });
});
