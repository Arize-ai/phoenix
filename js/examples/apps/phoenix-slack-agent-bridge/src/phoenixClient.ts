import type { Message } from "chat";

import type { BridgeConfig } from "./config.js";

interface PhoenixTextPart {
  text: string;
  type: "text";
}

interface PhoenixUIMessage {
  id: string;
  parts: PhoenixTextPart[];
  role: "assistant" | "user";
}

interface PhoenixChatRequestBody {
  contexts: Array<
    | {
        currentDateTime: string;
        timeZone: string;
        type: "app";
      }
    | {
        mutationsEnabled: boolean;
        type: "graphql";
      }
    | {
        enabled: boolean;
        type: "web_access";
      }
    | {
        enabled: boolean;
        type: "subagents";
      }
  >;
  editPermission: "manual";
  exportRemoteTraces: boolean;
  id: string;
  ingestTraces: boolean;
  messages: PhoenixUIMessage[];
  model: {
    modelName: string;
    provider: string;
    providerType: "builtin";
  };
  trigger: "submit-message";
}

interface PhoenixStreamChunk {
  delta?: unknown;
  type?: unknown;
}

function getLocalTimeZone(): string {
  return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
}

function getPhoenixRole(message: Message): PhoenixUIMessage["role"] {
  const isAssistantMessage =
    message.author.isMe || message.author.isBot === true;
  return isAssistantMessage ? "assistant" : "user";
}

function getSlackTextWithoutBotMention(text: string): string {
  return text.replace(/<@[A-Z0-9]+>\s*/g, "").trim();
}

function toPhoenixMessage(message: Message): PhoenixUIMessage | null {
  const text = getSlackTextWithoutBotMention(message.text);
  if (text.length === 0) {
    return null;
  }
  return {
    id: `slack-${message.id}`,
    parts: [{ type: "text", text }],
    role: getPhoenixRole(message),
  };
}

export function buildPhoenixRequestBody({
  config,
  messages,
  sessionId,
}: {
  config: BridgeConfig;
  messages: Message[];
  sessionId: string;
}): PhoenixChatRequestBody {
  const phoenixMessages = messages.flatMap((message) => {
    const phoenixMessage = toPhoenixMessage(message);
    return phoenixMessage == null ? [] : [phoenixMessage];
  });

  return {
    contexts: [
      {
        currentDateTime: new Date().toISOString(),
        timeZone: getLocalTimeZone(),
        type: "app",
      },
      {
        mutationsEnabled: false,
        type: "graphql",
      },
      {
        enabled: false,
        type: "web_access",
      },
      {
        enabled: false,
        type: "subagents",
      },
    ],
    editPermission: "manual",
    exportRemoteTraces: false,
    id: sessionId,
    ingestTraces: false,
    messages: phoenixMessages,
    model: {
      modelName: config.phoenixModelName,
      provider: config.phoenixModelProvider,
      providerType: "builtin",
    },
    trigger: "submit-message",
  };
}

function parseSseData(frame: string): string | null {
  const dataLines = frame
    .split("\n")
    .filter((line) => line.startsWith("data:"))
    .map((line) => line.slice("data:".length).trimStart());
  if (dataLines.length === 0) {
    return null;
  }
  return dataLines.join("\n");
}

function getTextDelta(data: string): string | null {
  if (data === "[DONE]") {
    return null;
  }

  let chunk: PhoenixStreamChunk;
  try {
    chunk = JSON.parse(data) as PhoenixStreamChunk;
  } catch (error) {
    console.warn("Skipping non-JSON Phoenix stream chunk", { data, error });
    return null;
  }

  if (chunk.type === "text-delta" && typeof chunk.delta === "string") {
    return chunk.delta;
  }
  return null;
}

function buildPhoenixChatUrl({
  config,
  sessionId,
}: {
  config: BridgeConfig;
  sessionId: string;
}): string {
  const baseUrl = config.phoenixBaseUrl.replace(/\/+$/, "");
  return `${baseUrl}/agents/server/sessions/${encodeURIComponent(sessionId)}/chat`;
}

async function* iterResponseFrames(
  body: ReadableStream<Uint8Array>
): AsyncIterable<string> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) {
        break;
      }

      buffer += decoder.decode(value, { stream: true });
      buffer = buffer.replace(/\r\n/g, "\n");

      let separatorIndex = buffer.indexOf("\n\n");
      while (separatorIndex !== -1) {
        const frame = buffer.slice(0, separatorIndex);
        buffer = buffer.slice(separatorIndex + 2);
        if (frame.trim() !== "") {
          yield frame;
        }
        separatorIndex = buffer.indexOf("\n\n");
      }
    }

    buffer += decoder.decode();
    if (buffer.trim() !== "") {
      yield buffer;
    }
  } finally {
    reader.releaseLock();
  }
}

export async function* streamPhoenixText({
  config,
  messages,
  sessionId,
}: {
  config: BridgeConfig;
  messages: Message[];
  sessionId: string;
}): AsyncIterable<string> {
  const url = buildPhoenixChatUrl({ config, sessionId });
  const headers: Record<string, string> = {
    accept: "text/event-stream",
    "content-type": "application/json",
  };
  if (config.phoenixAuthToken != null) {
    headers.authorization = `Bearer ${config.phoenixAuthToken}`;
  }

  const response = await fetch(url, {
    body: JSON.stringify(
      buildPhoenixRequestBody({ config, messages, sessionId })
    ),
    headers,
    method: "POST",
  });

  if (!response.ok) {
    const responseText = await response.text();
    throw new Error(
      `Phoenix chat request failed with ${response.status}: ${responseText.slice(0, 1000)}`
    );
  }
  if (response.body == null) {
    throw new Error("Phoenix chat response did not include a response body");
  }

  for await (const frame of iterResponseFrames(response.body)) {
    const data = parseSseData(frame);
    if (data == null) {
      continue;
    }
    const delta = getTextDelta(data);
    if (delta != null) {
      yield delta;
    }
  }
}
