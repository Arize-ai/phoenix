import {
  DefaultChatTransport,
  readUIMessageStream,
  type UIMessageChunk,
} from "ai";

import { createOAuthFetch, hasOAuthCredentials } from "../authFetch";
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
 * Chat client for the Phoenix server-agent endpoint.
 *
 * This wires the Vercel AI SDK's {@link DefaultChatTransport} to Phoenix's
 * `/agents/server/sessions/{id}/chat` route: it builds the request URL, auth
 * headers, and request body, then streams the assistant reply back as a series
 * of {@link PxiMessage} snapshots.
 */

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
 * Build the chat URL for a session, tolerating a trailing slash on the
 * configured endpoint and URL-encoding the session id.
 */
export function buildServerAgentChatUrl({
  endpoint,
  sessionId,
}: {
  endpoint: string;
  sessionId: string;
}): string {
  return `${trimTrailingSlash(endpoint)}/agents/server/sessions/${encodeURIComponent(
    sessionId
  )}/chat`;
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
 * Assemble the full chat request body from the conversation so far and the
 * resolved runtime options — session id, trace settings, edit permission,
 * capability contexts, and model selection.
 */
export function buildPxiChatRequest({
  messages,
  options,
}: {
  messages: PxiMessage[];
  options: PxiRuntimeOptions;
}): PxiChatRequest {
  return {
    id: options.sessionId,
    messages,
    trigger: "submit-message",
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
 * Create the AI SDK transport pointed at the configured Phoenix server-agent
 * endpoint. Each outgoing turn is rebuilt through {@link buildPxiChatRequest},
 * so per-request context (like the current time) stays fresh. Throws if no
 * endpoint is configured. `fetch` is injectable for testing.
 */
export function createServerAgentTransport({
  options,
  fetch,
}: {
  options: PxiRuntimeOptions;
  fetch?: typeof globalThis.fetch;
}): PxiTransport {
  if (!options.config.endpoint) {
    throw new Error("Phoenix endpoint not configured.");
  }

  const transportFetch =
    fetch ??
    (hasOAuthCredentials(options.config)
      ? createOAuthFetch({ config: options.config })
      : undefined);

  return new DefaultChatTransport<PxiMessage>({
    api: buildServerAgentChatUrl({
      endpoint: options.config.endpoint,
      sessionId: options.sessionId,
    }),
    headers: buildPxiHeaders({ config: options.config }),
    fetch: transportFetch,
    prepareSendMessagesRequest: ({ messages }) => ({
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
