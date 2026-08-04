import {
  formatApiError,
  HttpError,
  type pathsV1,
} from "@arizeai/phoenix-client";
import {
  DefaultChatTransport,
  readUIMessageStream,
  type UIMessageChunk,
} from "ai";

import { createOAuthFetch, hasOAuthCredentials } from "../authFetch";
import { createPhoenixClient } from "../client";
import type { PhoenixConfig } from "../config";
import { formatPxiRuntimeError } from "./preflight";
import type {
  PxiChatClient,
  PxiChatRequest,
  PxiContext,
  PxiMessage,
  PxiRuntimeOptions,
  PxiSession,
  PxiSessionClient,
  PxiSessionSummary,
  PxiSessionSyncState,
  PxiTransport,
} from "./types";

const AGENT_SESSION_CHAT_PATH =
  "/agents/{agent_id}/sessions/{session_id}/chat" satisfies keyof pathsV1;
const SERVER_AGENT_ID = "server";
/**
 * Error code the chat endpoint returns (HTTP 409) while another client's turn
 * holds the session lock.
 */
const SESSION_BUSY_ERROR_CODE = "agent_session_busy";

/** Whether an error is the chat endpoint's session-busy (HTTP 409) rejection. */
export function isSessionBusyError({ error }: { error: unknown }): boolean {
  return (
    error instanceof Error && error.message.includes(SESSION_BUSY_ERROR_CODE)
  );
}

/**
 * Error code the chat endpoint returns (HTTP 409) when the send's
 * `lastMessageId` no longer matches the persisted transcript — another client
 * appended to the session and this client is rendering a stale transcript.
 */
const SESSION_STALE_ERROR_CODE = "agent_session_stale";

/** Whether an error is the chat endpoint's stale-transcript (HTTP 409) rejection. */
export function isSessionStaleError({ error }: { error: unknown }): boolean {
  return (
    error instanceof Error && error.message.includes(SESSION_STALE_ERROR_CODE)
  );
}

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

/** Build the agent-session chat URL. */
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

/** Pull a printable error message out of an error response body, if any. */
async function readErrorDetail({
  response,
}: {
  response: Response;
}): Promise<string | null> {
  try {
    return formatApiError(await response.json());
  } catch {
    return null;
  }
}

/** Create an `AgentSession`. */
export async function createAgentSession({
  config,
  temporary,
  fetchImpl,
}: {
  config: PhoenixConfig;
  temporary: boolean;
  fetchImpl?: typeof globalThis.fetch;
}): Promise<PxiSession> {
  const client = createPhoenixClient({ config, fetch: fetchImpl });
  let agentSessionId: string | undefined;
  try {
    const { data: payload } = await client.POST("/agents/{agent_id}/sessions", {
      params: { path: { agent_id: SERVER_AGENT_ID } },
      body: { title: "", is_ephemeral: temporary },
    });
    agentSessionId = payload?.data.id;
  } catch (error) {
    if (error instanceof HttpError) {
      const detail = await readErrorDetail({ response: error.response });
      throw new Error(
        `Could not create a PXI chat session: HTTP ${error.status} ${error.statusText} from ${error.url}.${detail ? ` ${detail}` : ""}`
      );
    }
    throw error;
  }
  if (!agentSessionId) {
    throw new Error(
      "Could not create a PXI chat session because Phoenix returned no session id."
    );
  }
  return {
    id: agentSessionId,
    title: "",
    updatedAt: new Date().toISOString(),
    isTemporary: temporary,
    messages: [],
  };
}

/** Create the session-management client used by the TUI. */
export function createPxiSessionClient({
  config,
  fetch: fetchOverride,
}: {
  config: PhoenixConfig;
  fetch?: typeof globalThis.fetch;
}): PxiSessionClient {
  const fetchImpl =
    fetchOverride ??
    (hasOAuthCredentials(config)
      ? createOAuthFetch({ config })
      : globalThis.fetch);
  return {
    createSession: ({ temporary }) =>
      createAgentSession({ config, temporary, fetchImpl }),
    async listSessions() {
      const client = createPhoenixClient({ config, fetch: fetchImpl });
      const { data: payload } = await client.GET(
        "/agents/{agent_id}/sessions",
        {
          params: {
            path: { agent_id: SERVER_AGENT_ID },
            query: { limit: 20 },
          },
        }
      );
      if (!payload) {
        throw new Error(
          "Could not load PXI sessions because Phoenix returned no data."
        );
      }
      return payload.data.map(
        ({ id, title, updated_at, is_ephemeral }): PxiSessionSummary => ({
          id,
          title,
          updatedAt: updated_at,
          isTemporary: is_ephemeral,
        })
      );
    },
    async getSession({ sessionId }) {
      const client = createPhoenixClient({ config, fetch: fetchImpl });
      const { data: payload } = await client.GET(
        "/agents/{agent_id}/sessions/{session_id}",
        {
          params: {
            path: { agent_id: SERVER_AGENT_ID, session_id: sessionId },
          },
        }
      );
      if (!payload) {
        throw new Error(
          "Could not restore the selected PXI session because Phoenix returned no data."
        );
      }
      const session = payload.data;
      return {
        id: session.id,
        title: session.title,
        updatedAt: session.updated_at,
        isTemporary: session.is_ephemeral,
        isActive: session.is_active === true,
        lastMessageId: session.last_message_id ?? null,
        messages: (session.messages ?? []) as PxiMessage[],
      };
    },
    async getSessionSyncState({ sessionId }): Promise<PxiSessionSyncState> {
      const client = createPhoenixClient({ config, fetch: fetchImpl });
      const { data: payload } = await client.GET(
        "/agents/{agent_id}/sessions/{session_id}",
        {
          params: {
            path: { agent_id: SERVER_AGENT_ID, session_id: sessionId },
            // Cheap synchronization probe: session metadata only, so idle
            // polling doesn't re-download the whole transcript.
            query: { include_messages: false },
          },
        }
      );
      if (!payload) {
        throw new Error(
          "Could not check the PXI session for updates because Phoenix " +
            "returned no data."
        );
      }
      const session = payload.data;
      return {
        isActive: session.is_active === true,
        updatedAt: session.updated_at,
        lastMessageId: session.last_message_id ?? null,
      };
    },
    async compactSession({ sessionId, model }) {
      const client = createPhoenixClient({ config, fetch: fetchImpl });
      try {
        const { data: payload } = await client.POST(
          "/agents/{agent_id}/sessions/{session_id}/compact",
          {
            params: {
              path: { agent_id: SERVER_AGENT_ID, session_id: sessionId },
            },
            body: { model },
          }
        );
        if (!payload) {
          throw new Error(
            "Could not compact the PXI session because Phoenix returned no data."
          );
        }
        return {
          compacted: payload.data.compacted,
          compactionMessage: (payload.data.compaction_message ??
            null) as PxiMessage | null,
        };
      } catch (error) {
        if (error instanceof HttpError) {
          throw await buildCompactionHttpError({ error });
        }
        throw error;
      }
    },
  };
}

/**
 * Translate a compaction HTTP failure into a printable error. A 409 whose body
 * carries the session-busy code is rethrown with that code in the message so
 * {@link isSessionBusyError} recognizes it and the UI can enter its busy state.
 */
async function buildCompactionHttpError({
  error,
}: {
  error: HttpError;
}): Promise<Error> {
  let code: string | null = null;
  let detail: string | null = null;
  try {
    const body: unknown = await error.response.clone().json();
    if (body !== null && typeof body === "object") {
      const record = body as { code?: unknown };
      if (typeof record.code === "string") {
        code = record.code;
      }
    }
    detail = formatApiError(body);
  } catch {
    // Not JSON: fall through to the status-line message.
  }
  if (code === SESSION_BUSY_ERROR_CODE) {
    return new Error(SESSION_BUSY_ERROR_CODE);
  }
  return new Error(
    `Could not compact the conversation: HTTP ${error.status} ${error.statusText}.${detail ? ` ${detail}` : ""}`
  );
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

/** Shared request fields derived from the resolved runtime options. */
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

/** Assemble the chat request. */
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
  // The send's optimistic-concurrency check: the id of the last transcript
  // message this client believes is persisted. A new user message at the tail
  // is the turn being submitted, so the message before it is the persisted
  // tail; a trailing assistant message (client-tool continuation) is itself
  // the persisted tail. Null while the transcript is empty.
  const lastMessageId =
    (message.role === "assistant" ? message.id : messages.at(-2)?.id) ?? null;
  return {
    ...buildPxiRequestBase({ options }),
    message,
    lastMessageId,
  };
}

/** Create the AI SDK transport pointed at the configured Phoenix endpoint. */
export function createServerAgentTransport({
  options,
  agentSessionId,
  fetch,
}: {
  options: PxiRuntimeOptions;
  agentSessionId?: string;
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
  let agentSessionIdPromise: Promise<string> | null = agentSessionId
    ? Promise.resolve(agentSessionId)
    : null;
  const getAgentSessionId = (): Promise<string> => {
    agentSessionIdPromise ??= createAgentSession({
      config: options.config,
      temporary: false,
      fetchImpl: transportFetch,
    })
      .then((session) => session.id)
      .catch((error: unknown) => {
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
      agentSessionId: "placeholder",
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
  onSessionTitle,
}: {
  stream: ReadableStream<UIMessageChunk>;
  onAssistantMessage: (message: PxiMessage) => void;
  onSessionTitle?: (title: string) => void;
}): Promise<PxiMessage | null> {
  let finalMessage: PxiMessage | null = null;
  const observedStream = stream.pipeThrough(
    new TransformStream<UIMessageChunk, UIMessageChunk>({
      transform(chunk, controller) {
        if (
          chunk.type === "data-session-summary" &&
          typeof chunk.data === "string"
        ) {
          onSessionTitle?.(chunk.data);
        }
        controller.enqueue(chunk);
      },
    })
  );
  for await (const message of readUIMessageStream<PxiMessage>({
    stream: observedStream,
  })) {
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
  agentSessionId,
  transport = createServerAgentTransport({ options, agentSessionId }),
}: {
  options: PxiRuntimeOptions;
  agentSessionId?: string;
  transport?: PxiTransport;
}): PxiChatClient {
  return {
    async sendMessage({
      messages,
      abortSignal,
      onAssistantMessage,
      onSessionTitle,
    }) {
      try {
        const stream = await transport.sendMessages({
          trigger: "submit-message",
          chatId: options.sessionId,
          messageId: undefined,
          messages,
          abortSignal,
        });
        return await streamAssistantMessage({
          stream,
          onAssistantMessage,
          onSessionTitle,
        });
      } catch (error) {
        // Session-conflict rejections (HTTP 409: another client's turn holds
        // the lock, or this client's transcript went stale) are not
        // model/provider failures: rethrow them unwrapped so the UI can enter
        // its busy state or refresh the transcript.
        if (isSessionBusyError({ error }) || isSessionStaleError({ error })) {
          throw error;
        }
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
