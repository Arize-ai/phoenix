import {
  formatApiError,
  HttpError,
  type componentsV1,
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
  ModelSelection,
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
  "/v1/agent_sessions/{session_id}/chat" satisfies keyof pathsV1;
const AGENT_SESSION_PAGE_LIMIT = 100;
/**
 * The `code` discriminator of every HTTP 409 the agent session routes return.
 */
type AgentSessionConflictCode =
  componentsV1["schemas"]["AgentSessionConflictError"]["code"];

/**
 * Error code the chat endpoint returns (HTTP 409) while another client's turn
 * holds the session lock.
 */
const SESSION_BUSY_ERROR_CODE =
  "agent_session_busy" satisfies AgentSessionConflictCode;

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
const SESSION_MESSAGES_STALE_ERROR_CODE =
  "agent_session_messages_stale" satisfies AgentSessionConflictCode;

/** Whether an error is the chat endpoint's stale-transcript (HTTP 409) rejection. */
export function isSessionMessagesStaleError({
  error,
}: {
  error: unknown;
}): boolean {
  return (
    error instanceof Error &&
    error.message.includes(SESSION_MESSAGES_STALE_ERROR_CODE)
  );
}

/**
 * Error code the chat and compact endpoints return (HTTP 409) when the request
 * asserts a model the session is no longer on — another client moved it. The
 * transcript is unaffected, so this is distinct from
 * {@link SESSION_MESSAGES_STALE_ERROR_CODE}: the user needs to be told their model
 * changed, not that messages were refreshed.
 */
const SESSION_MODEL_STALE_ERROR_CODE =
  "agent_session_model_stale" satisfies AgentSessionConflictCode;

/** Whether an error is the stale-model (HTTP 409) rejection. */
export function isSessionModelStaleError({
  error,
}: {
  error: unknown;
}): boolean {
  return (
    error instanceof Error &&
    error.message.includes(SESSION_MODEL_STALE_ERROR_CODE)
  );
}

/**
 * Error code the compact endpoint returns (HTTP 409) when there are no
 * complete turns to compact — nothing new has finished since the latest
 * checkpoint, or a concurrent request's checkpoint already covers them. A
 * benign no-op, not a failure.
 */
const SESSION_ALREADY_COMPACT_ERROR_CODE =
  "agent_session_already_compact" satisfies AgentSessionConflictCode;

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
    "{session_id}",
    encodeURIComponent(agentSessionId)
  );
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
  model,
  fetchImpl,
}: {
  config: PhoenixConfig;
  temporary: boolean;
  model: ModelSelection;
  fetchImpl?: typeof globalThis.fetch;
}): Promise<PxiSession> {
  const client = createPhoenixClient({ config, fetch: fetchImpl });
  let agentSessionId: string | undefined;
  try {
    const { data: payload } = await client.POST("/v1/agent_sessions", {
      body: { title: "", is_ephemeral: temporary, model },
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
    model,
  };
}

/**
 * Fetch one page of a session's persisted transcript, oldest message first.
 */
async function fetchAgentSessionMessagesPage({
  client,
  sessionId,
  cursor,
}: {
  client: ReturnType<typeof createPhoenixClient>;
  sessionId: string;
  cursor: string | null;
}): Promise<{ messages: PxiMessage[]; nextCursor: string | null }> {
  const { data: payload } = await client.GET(
    "/v1/agent_sessions/{session_id}/messages",
    {
      params: {
        path: { session_id: sessionId },
        query: cursor === null ? {} : { cursor },
      },
    }
  );
  if (!payload) {
    throw new Error(
      "Could not restore the selected PXI session because Phoenix returned no data."
    );
  }
  return {
    messages: payload.data as PxiMessage[],
    nextCursor: payload.next_cursor ?? null,
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
    createSession: ({ temporary, model }) =>
      createAgentSession({ config, temporary, model, fetchImpl }),
    async listSessions() {
      const client = createPhoenixClient({ config, fetch: fetchImpl });
      const sessions: PxiSessionSummary[] = [];
      let cursor: string | undefined;
      do {
        const { data: payload } = await client.GET("/v1/agent_sessions", {
          params: {
            query: { cursor, limit: AGENT_SESSION_PAGE_LIMIT },
          },
        });
        if (!payload) {
          throw new Error(
            "Could not load PXI sessions because Phoenix returned no data."
          );
        }
        sessions.push(
          ...payload.data.map(
            ({ id, title, updated_at, is_ephemeral }): PxiSessionSummary => ({
              id,
              title,
              updatedAt: updated_at,
              isTemporary: is_ephemeral,
            })
          )
        );
        cursor = payload.next_cursor ?? undefined;
      } while (cursor);
      return sessions;
    },
    async getSession({ sessionId }) {
      const client = createPhoenixClient({ config, fetch: fetchImpl });
      const { data: payload } = await client.GET(
        "/v1/agent_sessions/{session_id}",
        {
          params: {
            path: { session_id: sessionId },
          },
        }
      );
      if (!payload) {
        throw new Error(
          "Could not restore the selected PXI session because Phoenix returned no data."
        );
      }
      const session = payload.data;
      const messages: PxiMessage[] = [];
      let cursor: string | null = null;
      do {
        const page = await fetchAgentSessionMessagesPage({
          client,
          sessionId,
          cursor,
        });
        messages.push(...page.messages);
        cursor = page.nextCursor;
      } while (cursor !== null);
      return {
        id: session.id,
        title: session.title,
        updatedAt: session.updated_at,
        isTemporary: session.is_ephemeral,
        isActive: session.is_active === true,
        // Derived from the transcript actually applied, not the metadata
        // response: the two requests aren't atomic, so the transcript can
        // advance in between. The polling loop self-corrects next tick.
        lastMessageId: messages.at(-1)?.id ?? null,
        messages,
        model: session.model,
      };
    },
    async getSessionSyncState({ sessionId }): Promise<PxiSessionSyncState> {
      const client = createPhoenixClient({ config, fetch: fetchImpl });
      const { data: payload } = await client.GET(
        "/v1/agent_sessions/{session_id}",
        {
          params: {
            path: { session_id: sessionId },
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
    async patchSessionModel({ sessionId, model }) {
      const client = createPhoenixClient({ config, fetch: fetchImpl });
      try {
        const { data: payload } = await client.PATCH(
          "/v1/agent_sessions/{session_id}",
          {
            params: {
              path: { session_id: sessionId },
            },
            body: { model },
          }
        );
        if (!payload) {
          throw new Error(
            "Could not change the session's model because Phoenix returned no data."
          );
        }
        return payload.data.model;
      } catch (error) {
        if (error instanceof HttpError) {
          const detail = await readErrorDetail({ response: error.response });
          throw new Error(
            `Could not change the session's model: HTTP ${error.status} ${error.statusText}.${detail ? ` ${detail}` : ""}`
          );
        }
        throw error;
      }
    },
    async compactSession({ sessionId, model }) {
      const client = createPhoenixClient({ config, fetch: fetchImpl });
      try {
        const { data: payload } = await client.POST(
          "/v1/agent_sessions/{session_id}/compact",
          {
            params: {
              path: { session_id: sessionId },
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
          compacted: true,
          compactionMessage: payload.data as PxiMessage,
        };
      } catch (error) {
        if (error instanceof HttpError) {
          const code = await readConflictCode({ response: error.response });
          if (code === SESSION_ALREADY_COMPACT_ERROR_CODE) {
            return { compacted: false, compactionMessage: null };
          }
          throw await buildCompactionHttpError({ error });
        }
        throw error;
      }
    },
  };
}

/**
 * Read the `code` discriminator out of a conflict response body, if any. The
 * response is cloned so the caller can still consume the body.
 */
async function readConflictCode({
  response,
}: {
  response: Response;
}): Promise<string | null> {
  try {
    const body: unknown = await response.clone().json();
    if (body !== null && typeof body === "object") {
      const record = body as { code?: unknown };
      if (typeof record.code === "string") {
        return record.code;
      }
    }
  } catch {
    // Not JSON.
  }
  return null;
}

/**
 * Translate a compaction HTTP failure into a printable error. A 409 whose body
 * carries the session-busy or session-stale code is rethrown with that code in
 * the message so {@link isSessionBusyError} / {@link isSessionMessagesStaleError}
 * recognize it and the UI can enter its busy state or refresh the session.
 */
async function buildCompactionHttpError({
  error,
}: {
  error: HttpError;
}): Promise<Error> {
  const code = await readConflictCode({ response: error.response });
  let detail: string | null = null;
  try {
    detail = formatApiError(await error.response.clone().json());
  } catch {
    // Not JSON: fall through to the status-line message.
  }
  if (code === SESSION_BUSY_ERROR_CODE) {
    return new Error(SESSION_BUSY_ERROR_CODE);
  }
  if (code === SESSION_MESSAGES_STALE_ERROR_CODE) {
    return new Error(SESSION_MESSAGES_STALE_ERROR_CODE);
  }
  if (code === SESSION_MODEL_STALE_ERROR_CODE) {
    return new Error(SESSION_MODEL_STALE_ERROR_CODE);
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
    // The CLI drives the headless agent rather than the browser assistant.
    headless: true,
    recordLocalTraces: options.ingestTraces,
    exportRemoteTraces: options.exportRemoteTraces,
    instrumentUserId: options.attachUserId,
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
  if (message.role !== "user") {
    // The chat contract only accepts user messages; client tool results are
    // submitted as `toolOutputs`, which the CLI never produces because it
    // executes no client tools.
    throw new Error("A chat submit request requires a trailing user message");
  }
  // The send's optimistic-concurrency check: the id of the last transcript
  // message this client believes is persisted. The new user message at the
  // tail is the turn being submitted, so the message before it is the
  // persisted tail. Null while the transcript is empty.
  const lastMessageId = messages.at(-2)?.id ?? null;
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
      model: options.modelSelection,
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
        if (
          isSessionBusyError({ error }) ||
          isSessionMessagesStaleError({ error })
        ) {
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
