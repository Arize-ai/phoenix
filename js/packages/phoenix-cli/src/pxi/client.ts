import {
  DefaultChatTransport,
  readUIMessageStream,
  type UIMessageChunk,
} from "ai";

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

function trimTrailingSlash(value: string): string {
  return value.replace(/\/+$/, "");
}

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

export function buildPxiHeaders({
  config,
}: {
  config: PhoenixConfig;
}): Record<string, string> {
  return {
    ...(config.headers ?? {}),
    ...(config.apiKey ? { Authorization: `Bearer ${config.apiKey}` } : {}),
  };
}

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

  return new DefaultChatTransport<PxiMessage>({
    api: buildServerAgentChatUrl({
      endpoint: options.config.endpoint,
      sessionId: options.sessionId,
    }),
    headers: buildPxiHeaders({ config: options.config }),
    fetch,
    prepareSendMessagesRequest: ({ messages }) => ({
      body: buildPxiChatRequest({ messages, options }),
    }),
  });
}

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

export function createUserMessage({ text }: { text: string }): PxiMessage {
  return {
    id: crypto.randomUUID(),
    role: "user",
    parts: [{ type: "text", text }],
  };
}
