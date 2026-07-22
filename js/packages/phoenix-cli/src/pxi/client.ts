import type { pathsV1 } from "@arizeai/phoenix-client";
import {
  DefaultChatTransport,
  readUIMessageStream,
  type UIMessageChunk,
} from "ai";

import { createOAuthFetch, hasOAuthCredentials } from "../authFetch";
import { buildGraphqlRequest } from "../commands/api";
import type { PhoenixConfig } from "../config";
import { formatPxiRuntimeError } from "./preflight";
import type {
  PxiChatClient,
  PxiChatRequest,
  PxiContext,
  PxiMessage,
  PxiRuntimeOptions,
  PxiTransport,
} from "./types";

/**
 * Chat client for the Phoenix agent chat endpoint.
 *
 * This wires the Vercel AI SDK's {@link DefaultChatTransport} to Phoenix's
 * agent-session chat route: a temporary `AgentSession` is created via GraphQL
 * on the first send, and each turn POSTs only its trailing message to
 * `/agents/server/sessions/{id}/chat` — the server agent pxi has always used,
 * now running through the server-owned session pipeline. The assistant reply
 * streams back as a series of {@link PxiMessage} snapshots.
 */

// Pinning the template against the generated OpenAPI `paths` makes a future
// server-side route removal a typecheck failure here instead of a runtime 404.
const AGENT_SESSION_CHAT_PATH =
  "/agents/{agent_id}/sessions/{session_id}/chat" satisfies keyof pathsV1;

/**
 * The agent the CLI runs against: the fully server-side agent (bash + GraphQL
 * toolsets), not the web app's `assistant` agent, whose toolset includes
 * client-executed tools a terminal cannot run.
 */
const SERVER_AGENT_ID = "server";

function trimTrailingSlash(value: string): string {
  return value.replace(/\/+$/, "");
}

/**
 * Format a date as a local ISO-8601 timestamp with an explicit UTC offset
 * (e.g. `2026-06-25T13:45:00.000+02:00`). Unlike `Date#toISOString`, which
 * always emits UTC, this preserves the caller's wall-clock time and zone so the
 * agent reasons about "now" the way the user experiences it.
 */
function toLocalISOWithOffset(date: Date): string {
  const offsetMinutes = -date.getTimezoneOffset();
  const sign = offsetMinutes >= 0 ? "+" : "-";
  const absoluteOffsetMinutes = Math.abs(offsetMinutes);
  const offsetHours = String(Math.floor(absoluteOffsetMinutes / 60)).padStart(
    2,
    "0"
  );
  const offsetRemainderMinutes = String(absoluteOffsetMinutes % 60).padStart(
    2,
    "0"
  );
  const localDate = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
  const localIso = localDate.toISOString().slice(0, -1);
  return `${localIso}${sign}${offsetHours}:${offsetRemainderMinutes}`;
}

/**
 * Build the agent-session chat URL for a server-created `AgentSession`,
 * tolerating a trailing slash on the configured endpoint and URL-encoding the
 * session's GlobalID.
 */
export function buildAgentSessionChatUrl({
  endpoint,
  agentSessionId,
}: {
  endpoint: string;
  agentSessionId: string;
}): string {
  const path = AGENT_SESSION_CHAT_PATH.replace(
    "{agent_id}",
    SERVER_AGENT_ID
  ).replace("{session_id}", encodeURIComponent(agentSessionId));
  return `${trimTrailingSlash(endpoint)}${path}`;
}

/**
 * GraphQL mutation creating the server-side session a PXI chat runs in.
 * `temporary: true` fits the CLI's ephemeral UX: the session expires after a
 * period of inactivity (its TTL refreshes every turn) and stays hidden from
 * the web app's session lists.
 */
export const PXI_CREATE_AGENT_SESSION_MUTATION = /* GraphQL */ `
  mutation PxiCreateAgentSessionMutation {
    createAgentSession(input: { title: "", temporary: true }) {
      agentSession {
        id
      }
    }
  }
`;

type CreateAgentSessionData = {
  createAgentSession?: {
    agentSession?: {
      id?: string;
    };
  };
};

type GraphqlResponse<Data> = {
  data?: Data;
  errors?: Array<{ message?: string }>;
};

/**
 * Create a temporary `AgentSession` on the Phoenix server and return its
 * GlobalID — the session id the agent-session chat route expects. Throws a
 * descriptive error when the endpoint is missing, the request fails, or the
 * server returns GraphQL errors. `fetchImpl` is injectable for testing.
 */
export async function createTemporaryAgentSession({
  config,
  fetchImpl = globalThis.fetch,
}: {
  config: PhoenixConfig;
  fetchImpl?: typeof globalThis.fetch;
}): Promise<string> {
  if (!config.endpoint) {
    throw new Error("Phoenix endpoint not configured.");
  }
  const request = buildGraphqlRequest({
    query: PXI_CREATE_AGENT_SESSION_MUTATION,
    config,
  });
  const response = await fetchImpl(request.url, {
    method: request.method,
    headers: request.headers,
    body: request.body,
  });
  if (!response.ok) {
    throw new Error(
      `Could not create a PXI chat session: HTTP ${response.status} ${response.statusText} from ${request.url}.`
    );
  }
  const payload =
    (await response.json()) as GraphqlResponse<CreateAgentSessionData>;
  const errors = payload.errors
    ?.map((error) => error.message)
    .filter((message): message is string => Boolean(message));
  if (errors && errors.length > 0) {
    throw new Error(
      `Could not create a PXI chat session because Phoenix returned GraphQL errors: ${errors.join("; ")}.`
    );
  }
  const agentSessionId = payload.data?.createAgentSession?.agentSession?.id;
  if (!agentSessionId) {
    throw new Error(
      "Could not create a PXI chat session because Phoenix returned no session id."
    );
  }
  return agentSessionId;
}

/**
 * Assemble request headers from the config: any custom headers first, then a
 * bearer `Authorization` header when an API key is set (so the key takes
 * precedence over a manually supplied auth header).
 */
export function buildPxiHeaders({
  config,
}: {
  config: PhoenixConfig;
}): Record<string, string> {
  return {
    ...(config.headers ?? {}),
    ...(config.apiKey
      ? { Authorization: `Bearer ${config.apiKey}` }
      : config.oauthTokens
        ? { Authorization: `Bearer ${config.oauthTokens.accessToken}` }
        : {}),
  };
}

/**
 * Build the {@link PxiContext} list sent with every request, telling the server
 * agent the current local time and zone and which capabilities (GraphQL
 * mutations, web access, subagents) are enabled for the run. `now` and
 * `timeZone` default to the live clock/zone but are injectable for testing.
 */
export function buildPxiContexts({
  enableWebAccess,
  enableSubagents,
  enableGraphqlMutations,
  now = new Date(),
  timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone,
}: {
  enableWebAccess: boolean;
  enableSubagents: boolean;
  enableGraphqlMutations: boolean;
  now?: Date;
  timeZone?: string;
}): PxiContext[] {
  return [
    {
      type: "app",
      currentDateTime: toLocalISOWithOffset(now),
      timeZone,
    },
    {
      type: "graphql",
      mutationsEnabled: enableGraphqlMutations,
    },
    {
      type: "web_access",
      enabled: enableWebAccess,
    },
    {
      type: "subagents",
      enabled: enableSubagents,
    },
  ];
}

/**
 * Shared request fields derived from the resolved runtime options — trace
 * settings, edit permission, capability contexts, and model selection.
 */
function buildPxiRequestBase({ options }: { options: PxiRuntimeOptions }) {
  return {
    id: options.sessionId,
    trigger: "submit-message" as const,
    ingestTraces: options.ingestTraces,
    exportRemoteTraces: options.exportRemoteTraces,
    attachUserId: options.attachUserId,
    editPermission: options.editPermission,
    contexts: buildPxiContexts({
      enableWebAccess: options.enableWebAccess,
      enableSubagents: options.enableSubagents,
      enableGraphqlMutations: options.enableGraphqlMutations,
    }),
    model: options.modelSelection,
  };
}

/**
 * Assemble an agent-session chat request from the conversation so far. The
 * server owns the session transcript, so only the trailing message — the
 * turn's new user message — is sent.
 */
export function buildPxiChatRequest({
  messages,
  options,
}: {
  messages: PxiMessage[];
  options: PxiRuntimeOptions;
}): PxiChatRequest {
  const message = messages.at(-1);
  if (!message) {
    throw new Error("A chat submit request requires a message to send");
  }
  return {
    ...buildPxiRequestBase({ options }),
    message,
  };
}

/**
 * Create the AI SDK transport pointed at the configured Phoenix endpoint.
 *
 * A temporary `AgentSession` is created via GraphQL on the first send — its
 * GlobalID becomes the chat URL's session id — and each turn POSTs only its
 * trailing message.
 *
 * Each outgoing turn is rebuilt through the request builders, so per-request
 * context (like the current time) stays fresh. Throws if no endpoint is
 * configured. `fetch` is injectable for testing.
 */
export function createServerAgentTransport({
  options,
  fetch,
}: {
  options: PxiRuntimeOptions;
  fetch?: typeof globalThis.fetch;
}): PxiTransport {
  const endpoint = options.config.endpoint;
  if (!endpoint) {
    throw new Error("Phoenix endpoint not configured.");
  }

  const transportFetch =
    fetch ??
    (hasOAuthCredentials(options.config)
      ? createOAuthFetch({ config: options.config })
      : undefined);

  // The server session is created lazily on the first send and reused for the
  // rest of the chat. A failed creation clears the cached promise so the next
  // send can retry instead of being stuck on the rejection.
  let agentSessionIdPromise: Promise<string> | null = null;
  const getAgentSessionId = (): Promise<string> => {
    agentSessionIdPromise ??= createTemporaryAgentSession({
      config: options.config,
      fetchImpl: transportFetch,
    }).catch((error: unknown) => {
      agentSessionIdPromise = null;
      throw error;
    });
    return agentSessionIdPromise;
  };

  return new DefaultChatTransport<PxiMessage>({
    api: buildAgentSessionChatUrl({
      endpoint,
      // Placeholder only: prepareSendMessagesRequest overrides the URL with
      // the server-created session id on every send.
      agentSessionId: options.sessionId,
    }),
    headers: buildPxiHeaders({ config: options.config }),
    fetch: transportFetch,
    prepareSendMessagesRequest: async ({ messages }) => ({
      api: buildAgentSessionChatUrl({
        endpoint,
        agentSessionId: await getAgentSessionId(),
      }),
      body: buildPxiChatRequest({ messages, options }),
    }),
  });
}

/**
 * Consume a UI-message chunk stream, invoking `onAssistantMessage` with each
 * progressively-accumulated snapshot so the UI can render the reply as it
 * arrives. Resolves with the final, complete message (or `null` if the stream
 * produced nothing).
 */
export async function streamAssistantMessage({
  stream,
  onAssistantMessage,
}: {
  stream: ReadableStream<UIMessageChunk>;
  onAssistantMessage: (message: PxiMessage) => void;
}): Promise<PxiMessage | null> {
  let finalMessage: PxiMessage | null = null;
  for await (const message of readUIMessageStream<PxiMessage>({ stream })) {
    finalMessage = message;
    onAssistantMessage(message);
  }
  return finalMessage;
}

/**
 * Create the {@link PxiChatClient} the UI talks to. It sends the conversation
 * over the transport, streams the assistant reply back, and on failure wraps
 * the error via {@link formatPxiRuntimeError} so the user sees an actionable
 * message (e.g. how to fix missing credentials). The transport defaults to a
 * real server-agent transport but is injectable for testing.
 */
export function createPxiChatClient({
  options,
  transport = createServerAgentTransport({ options }),
}: {
  options: PxiRuntimeOptions;
  transport?: PxiTransport;
}): PxiChatClient {
  return {
    async sendMessage({ messages, abortSignal, onAssistantMessage }) {
      try {
        const stream = await transport.sendMessages({
          trigger: "submit-message",
          chatId: options.sessionId,
          messageId: undefined,
          messages,
          abortSignal,
        });
        return await streamAssistantMessage({ stream, onAssistantMessage });
      } catch (error) {
        throw formatPxiRuntimeError({
          error,
          modelSelection: options.modelSelection,
        });
      }
    },
  };
}

/** Wrap raw user input in a {@link PxiMessage} with a fresh id. */
export function createUserMessage({ text }: { text: string }): PxiMessage {
  return {
    id: crypto.randomUUID(),
    role: "user",
    parts: [{ type: "text", text }],
  };
}
