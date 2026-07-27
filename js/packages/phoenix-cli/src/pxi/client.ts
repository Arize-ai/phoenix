import {
  formatApiError,
  HttpError,
  type pathsV1,
} from "@arizeai/phoenix-client";
import {
  DefaultChatTransport,
  parseJsonEventStream,
  readUIMessageStream,
  type UIMessageChunk,
  uiMessageChunkSchema,
} from "ai";

import { createOAuthFetch, hasOAuthCredentials } from "../authFetch";
import { createPhoenixClient } from "../client";
import type { PhoenixConfig } from "../config";
import { AuthRequiredError } from "../exitCodes";
import { parsePxiBusyError } from "./errors";
import { formatPxiRuntimeError } from "./preflight";
import type {
  PxiChatClient,
  PxiChatRequest,
  PxiContext,
  PxiMessage,
  PxiRuntimeOptions,
  PxiSession,
  PxiSessionClient,
  PxiSessionEventHandlers,
  PxiSessionState,
  PxiSessionSummary,
  PxiStopSessionResult,
  PxiTransport,
  PxiTurnStarted,
} from "./types";

export { PxiBusyError } from "./errors";

const AGENT_SESSION_CHAT_PATH =
  "/agents/{agent_id}/sessions/{session_id}/chat" satisfies keyof pathsV1;
const AGENT_SESSION_EVENTS_PATH =
  "/agents/{agent_id}/sessions/{session_id}/events" satisfies keyof pathsV1;
const AGENT_SESSION_STOP_PATH =
  "/agents/{agent_id}/sessions/{session_id}/stop" satisfies keyof pathsV1;
const SERVER_AGENT_ID = "server";
const PXI_CLIENT_ID = crypto.randomUUID();

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

function buildAgentSessionUrl({
  endpoint,
  agentSessionId,
  path,
}: {
  endpoint: string;
  agentSessionId: string;
  path: string;
}): string {
  const resolvedPath = path
    .replace("{agent_id}", SERVER_AGENT_ID)
    .replace("{session_id}", encodeURIComponent(agentSessionId));
  return `${trimTrailingSlash(endpoint)}${resolvedPath}`;
}

/** Build the agent-session chat URL. */
export function buildAgentSessionChatUrl({
  endpoint,
  agentSessionId,
}: {
  endpoint: string;
  agentSessionId: string;
}): string {
  return buildAgentSessionUrl({
    endpoint,
    agentSessionId,
    path: AGENT_SESSION_CHAT_PATH,
  });
}

/** Return the process-stable identity sent with every PXI turn. */
export function getPxiClientId(): string {
  return PXI_CLIENT_ID;
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

function getPxiFetch({
  config,
  fetchImpl,
}: {
  config: PhoenixConfig;
  fetchImpl?: typeof globalThis.fetch;
}): typeof globalThis.fetch {
  return (
    fetchImpl ??
    (hasOAuthCredentials(config)
      ? createOAuthFetch({ config })
      : (input, init) => globalThis.fetch(input, init))
  );
}

function withBusyErrorParsing({
  fetchImpl,
}: {
  fetchImpl: typeof globalThis.fetch;
}): typeof globalThis.fetch {
  return async (input, init) => {
    const response = await fetchImpl(input, init);
    const busyError = await parsePxiBusyError({ response });
    if (busyError) {
      throw busyError;
    }
    return response;
  };
}

function isSessionStateChunk(chunk: UIMessageChunk): chunk is UIMessageChunk & {
  type: "data-session-state";
  data: PxiSessionState;
} {
  if (chunk.type !== "data-session-state") {
    return false;
  }
  const data = chunk.data;
  return (
    data !== null &&
    typeof data === "object" &&
    "state" in data &&
    typeof data.state === "string" &&
    "ownedByThisInstance" in data &&
    typeof data.ownedByThisInstance === "boolean" &&
    "streamAvailable" in data &&
    typeof data.streamAvailable === "boolean"
  );
}

function isTurnStartedChunk(chunk: UIMessageChunk): chunk is UIMessageChunk & {
  type: "data-turn-started";
  data: PxiTurnStarted;
} {
  if (chunk.type !== "data-turn-started") {
    return false;
  }
  const data = chunk.data;
  if (!data || typeof data !== "object") {
    return false;
  }
  const message = "message" in data ? data.message : null;
  return (
    "turnId" in data &&
    typeof data.turnId === "string" &&
    message !== null &&
    typeof message === "object" &&
    "id" in message &&
    typeof message.id === "string" &&
    "role" in message &&
    typeof message.role === "string" &&
    "parts" in message &&
    Array.isArray(message.parts)
  );
}

type SubscribeToSessionEventsOptions = {
  config: PhoenixConfig;
  agentSessionId: string;
  abortSignal?: AbortSignal;
  fetchImpl?: typeof globalThis.fetch;
} & PxiSessionEventHandlers;

const INITIAL_RECONNECT_DELAY_MS = 500;
const MAX_RECONNECT_DELAY_MS = 8_000;
/**
 * HTTP statuses that will not get better by retrying: the endpoint does not
 * exist on this server (pre-event-bus Phoenix), the session is gone, or the
 * caller is not allowed to follow it.
 */
const FATAL_SUBSCRIBE_STATUSES: ReadonlySet<number> = new Set([401, 403, 404]);

/** A non-OK response from the session-events endpoint. */
class SessionEventsRequestError extends Error {
  readonly status: number;

  constructor({ message, status }: { message: string; status: number }) {
    super(message);
    this.name = "SessionEventsRequestError";
    this.status = status;
  }
}

/**
 * Whether a subscription failure is permanent for this session (missing
 * endpoint, deleted session, auth failure) rather than a transient network
 * blip worth reconnecting through.
 */
function isFatalSubscribeError(error: unknown): boolean {
  if (error instanceof AuthRequiredError) {
    return true;
  }
  return (
    error instanceof SessionEventsRequestError &&
    FATAL_SUBSCRIBE_STATUSES.has(error.status)
  );
}

async function subscribeToSessionEventsOnce({
  config,
  agentSessionId,
  abortSignal,
  fetchImpl,
  onSessionState,
  onTurnStarted,
  onAssistantMessage,
  onSessionTitle,
  onError,
  onStreamEstablished,
}: SubscribeToSessionEventsOptions & {
  onStreamEstablished?: () => void;
}): Promise<void> {
  const endpoint = config.endpoint;
  if (!endpoint) {
    throw new Error("Phoenix endpoint not configured.");
  }
  const response = await getPxiFetch({ config, fetchImpl })(
    buildAgentSessionUrl({
      endpoint,
      agentSessionId,
      path: AGENT_SESSION_EVENTS_PATH,
    }),
    {
      method: "GET",
      headers: {
        Accept: "text/event-stream",
        ...buildPxiHeaders({ config }),
      },
      signal: abortSignal,
    }
  );
  if (!response.ok) {
    const detail = await readErrorDetail({ response });
    throw new SessionEventsRequestError({
      message: `Could not follow the PXI session: HTTP ${response.status} ${response.statusText}.${detail ? ` ${detail}` : ""}`,
      status: response.status,
    });
  }
  if (!response.body) {
    throw new Error(
      "Could not follow the PXI session because the response body is empty."
    );
  }

  let currentSessionState: PxiSessionState | undefined;
  let activeTurn:
    | {
        turnId: string;
        writer: WritableStreamDefaultWriter<UIMessageChunk>;
        completion: Promise<void>;
      }
    | undefined;

  const closeActiveTurn = async () => {
    const turn = activeTurn;
    activeTurn = undefined;
    if (!turn) {
      return;
    }
    try {
      await turn.writer.close();
      await turn.completion;
    } catch (error) {
      if (!abortSignal?.aborted) {
        onError?.(error);
      }
    }
  };

  let hasReceivedEvent = false;
  try {
    const parsedEvents = parseJsonEventStream({
      stream: response.body,
      schema: uiMessageChunkSchema,
    });
    for await (const parsedEvent of parsedEvents) {
      if (!parsedEvent.success) {
        throw parsedEvent.error;
      }
      if (!hasReceivedEvent) {
        hasReceivedEvent = true;
        onStreamEstablished?.();
      }
      const chunk = parsedEvent.value;
      if (isSessionStateChunk(chunk)) {
        currentSessionState = chunk.data;
        if (
          chunk.data.state === "idle" ||
          chunk.data.state === "awaiting_client_tool"
        ) {
          await closeActiveTurn();
        }
        onSessionState(chunk.data);
        continue;
      }
      if (isTurnStartedChunk(chunk)) {
        await closeActiveTurn();
        // `awaiting_client_tool` counts as in flight: attaching to a session
        // paused on a client tool replays the partial turn so the pending
        // tool call is visible.
        const isTurnInFlight =
          currentSessionState?.state === "streaming" ||
          currentSessionState?.state === "persisting" ||
          currentSessionState?.state === "awaiting_client_tool";
        if (!isTurnInFlight || currentSessionState?.streamAvailable === false) {
          continue;
        }
        onTurnStarted(chunk.data);
        const turnStream = new TransformStream<
          UIMessageChunk,
          UIMessageChunk
        >();
        const turnId = chunk.data.turnId;
        const completion = streamAssistantMessage({
          stream: turnStream.readable,
          onAssistantMessage: (message) =>
            onAssistantMessage({ turnId, message }),
          onSessionTitle,
        })
          .then(() => undefined)
          .catch((error: unknown) => {
            if (!abortSignal?.aborted) {
              onError?.(error);
            }
          });
        activeTurn = {
          turnId,
          writer: turnStream.writable.getWriter(),
          completion,
        };
        continue;
      }
      if (activeTurn) {
        try {
          await activeTurn.writer.write(chunk);
        } catch {
          // The per-turn consumer failed or was cancelled (its own error is
          // reported through the turn's completion promise). Stop forwarding
          // this turn's chunks but keep the events connection alive.
          const failedTurn = activeTurn;
          activeTurn = undefined;
          void failedTurn.writer.abort().catch(() => undefined);
        }
      }
    }
  } finally {
    await closeActiveTurn();
  }
}

/**
 * Subscribe to current and future turns for a session. Session-control chunks
 * are demultiplexed from the AI SDK protocol, while each turn's content is fed
 * through the same assistant-message accumulator used by the POST response.
 *
 * Transient failures (dropped connections, server restarts, proxy timeouts)
 * reconnect silently with backoff — the server replays the in-flight turn from
 * its start, so blips self-heal without surfacing to the UI. Permanent
 * failures (endpoint missing on an older Phoenix server, deleted session, auth
 * failure) are surfaced once through `onError` and end the subscription; the
 * rest of the CLI keeps working without live following.
 */
export async function subscribeToSessionEvents(
  options: SubscribeToSessionEventsOptions
): Promise<void> {
  let reconnectDelayMs = INITIAL_RECONNECT_DELAY_MS;
  while (!options.abortSignal?.aborted) {
    try {
      await subscribeToSessionEventsOnce({
        ...options,
        onStreamEstablished: () => {
          reconnectDelayMs = INITIAL_RECONNECT_DELAY_MS;
        },
      });
      // The server closed the stream; treat it like any transient drop and
      // reconnect silently.
    } catch (error) {
      if (options.abortSignal?.aborted) {
        return;
      }
      if (isFatalSubscribeError(error)) {
        options.onError?.(error);
        return;
      }
      // Transient failure — reconnect silently.
    }
    if (options.abortSignal?.aborted) {
      return;
    }
    await waitForAbortableDelay({
      delayMs: reconnectDelayMs,
      signal: options.abortSignal,
    });
    reconnectDelayMs = Math.min(reconnectDelayMs * 2, MAX_RECONNECT_DELAY_MS);
  }
}

async function waitForAbortableDelay({
  delayMs,
  signal,
}: {
  delayMs: number;
  signal?: AbortSignal;
}): Promise<void> {
  if (signal?.aborted) {
    return;
  }
  await new Promise<void>((resolve) => {
    const handleAbort = () => {
      clearTimeout(timeoutId);
      resolve();
    };
    const timeoutId = setTimeout(() => {
      signal?.removeEventListener("abort", handleAbort);
      resolve();
    }, delayMs);
    signal?.addEventListener("abort", handleAbort, { once: true });
  });
}

/** Request server-side interruption of a PXI session turn. */
export async function stopSession({
  config,
  agentSessionId,
  turnId,
  fetchImpl,
}: {
  config: PhoenixConfig;
  agentSessionId: string;
  turnId?: string;
  fetchImpl?: typeof globalThis.fetch;
}): Promise<PxiStopSessionResult> {
  const endpoint = config.endpoint;
  if (!endpoint) {
    throw new Error("Phoenix endpoint not configured.");
  }
  const response = await getPxiFetch({ config, fetchImpl })(
    buildAgentSessionUrl({
      endpoint,
      agentSessionId,
      path: AGENT_SESSION_STOP_PATH,
    }),
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...buildPxiHeaders({ config }),
      },
      body: JSON.stringify(turnId ? { turnId } : {}),
    }
  );
  const busyError = await parsePxiBusyError({ response });
  if (busyError) {
    throw busyError;
  }
  if (!response.ok) {
    const detail = await readErrorDetail({ response });
    throw new Error(
      `Could not stop the PXI session: HTTP ${response.status} ${response.statusText}.${detail ? ` ${detail}` : ""}`
    );
  }
  const payload = (await response.json()) as {
    data: PxiStopSessionResult;
  };
  return payload.data;
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
      body: { title: "", temporary },
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
  const fetchImpl = getPxiFetch({ config, fetchImpl: fetchOverride });
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
        ({ id, title, updated_at, is_temporary }): PxiSessionSummary => ({
          id,
          title,
          updatedAt: updated_at,
          isTemporary: is_temporary,
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
        isTemporary: session.is_temporary,
        messages: session.messages as PxiMessage[],
      };
    },
    subscribeToSessionEvents: ({ sessionId, ...handlers }) =>
      subscribeToSessionEvents({
        config,
        agentSessionId: sessionId,
        fetchImpl,
        ...handlers,
      }),
    stopSession: ({ sessionId, turnId }) =>
      stopSession({
        config,
        agentSessionId: sessionId,
        turnId,
        fetchImpl,
      }),
  };
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
    clientId: PXI_CLIENT_ID,
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
  return {
    ...buildPxiRequestBase({ options }),
    message,
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

  const transportFetch = withBusyErrorParsing({
    fetchImpl: getPxiFetch({ config: options.config, fetchImpl: fetch }),
  });

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
