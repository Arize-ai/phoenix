import type { ChatStatus, ModelMessage } from "ai";
import { streamText } from "ai";
import { useRef, useState } from "react";

import type { ModelMenuValue } from "@phoenix/components/generative/ModelMenu";

import { createChatModel } from "./chatModel";

export type DirectChatMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
};

function toModelMessages(messages: DirectChatMessage[]): ModelMessage[] {
  return messages.map((message) =>
    message.role === "user"
      ? { role: "user" as const, content: message.content }
      : { role: "assistant" as const, content: message.content }
  );
}

/**
 * Extracts a human-readable message from a failed completion. The server
 * proxies provider failures in OpenAI's error envelope
 * (`{"error": {"message": ...}}`), so surface the provider's own words when
 * they're present rather than the SDK's generic status-code message.
 */
function getChatErrorMessage(error: unknown): string {
  if (
    error != null &&
    typeof error === "object" &&
    "responseBody" in error &&
    typeof error.responseBody === "string"
  ) {
    try {
      const parsed: unknown = JSON.parse(error.responseBody);
      if (
        parsed != null &&
        typeof parsed === "object" &&
        "error" in parsed &&
        parsed.error != null &&
        typeof parsed.error === "object" &&
        "message" in parsed.error &&
        typeof parsed.error.message === "string" &&
        parsed.error.message !== ""
      ) {
        return parsed.error.message;
      }
    } catch {
      // Not a JSON body — fall through to the error's own message.
    }
  }
  if (error instanceof Error && error.message) {
    return error.message;
  }
  return "Something went wrong while contacting the model.";
}

/**
 * A minimal chat loop over the Phoenix server's OpenAI-compatible
 * `/v1/chat/completions` proxy. The whole conversation lives in memory —
 * nothing is persisted — and each send streams the assistant reply token by
 * token into the last message.
 *
 * Statuses mirror the AI SDK's `ChatStatus` so the shared prompt-input
 * components read them natively: `submitted` while waiting for the first
 * token, `streaming` while tokens arrive, then `ready` or `error`.
 */
export function useDirectChat() {
  const [messages, setMessages] = useState<DirectChatMessage[]>([]);
  const [status, setStatus] = useState<ChatStatus>("ready");
  const [error, setError] = useState<string | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  const run = async (history: DirectChatMessage[], model: ModelMenuValue) => {
    abortControllerRef.current?.abort();
    const controller = new AbortController();
    abortControllerRef.current = controller;
    setMessages(history);
    setStatus("submitted");
    setError(null);
    /** True while this run still owns the chat state — a newer run or a reset supersedes it. */
    const ownsChatState = () => abortControllerRef.current === controller;
    try {
      const chatModel = await createChatModel(model);
      const result = streamText({
        model: chatModel,
        messages: toModelMessages(history),
        abortSignal: controller.signal,
      });
      const assistantId = crypto.randomUUID();
      let hasStartedStreaming = false;
      for await (const delta of result.textStream) {
        if (controller.signal.aborted) {
          break;
        }
        if (!hasStartedStreaming) {
          hasStartedStreaming = true;
          setStatus("streaming");
          setMessages((previous) => [
            ...previous,
            { id: assistantId, role: "assistant", content: delta },
          ]);
        } else {
          setMessages((previous) =>
            previous.map((message) =>
              message.id === assistantId
                ? { ...message, content: message.content + delta }
                : message
            )
          );
        }
      }
      if (ownsChatState()) {
        setStatus("ready");
      }
    } catch (streamError) {
      if (!ownsChatState()) {
        return;
      }
      if (controller.signal.aborted) {
        // Stopped by the user — keep whatever streamed in and settle.
        setStatus("ready");
        return;
      }
      setError(getChatErrorMessage(streamError));
      setStatus("error");
    } finally {
      if (ownsChatState()) {
        abortControllerRef.current = null;
      }
    }
  };

  const isBusy = status === "submitted" || status === "streaming";

  /** Sends a user message and streams the assistant reply. */
  const sendMessage = (text: string, model: ModelMenuValue) => {
    const trimmed = text.trim();
    if (!trimmed || isBusy) {
      return;
    }
    void run(
      [
        ...messages,
        { id: crypto.randomUUID(), role: "user", content: trimmed },
      ],
      model
    );
  };

  /** Re-sends the conversation from the latest user message after an error. */
  const retry = (model: ModelMenuValue) => {
    if (isBusy) {
      return;
    }
    const lastUserIndex = messages.findLastIndex(
      (message) => message.role === "user"
    );
    if (lastUserIndex === -1) {
      return;
    }
    void run(messages.slice(0, lastUserIndex + 1), model);
  };

  /** Aborts the in-flight completion, keeping any partial response. */
  const stop = () => {
    abortControllerRef.current?.abort();
  };

  /** Discards the conversation and settles back to an empty, ready chat. */
  const clear = () => {
    abortControllerRef.current?.abort();
    abortControllerRef.current = null;
    setMessages([]);
    setStatus("ready");
    setError(null);
  };

  return { messages, status, error, sendMessage, retry, stop, clear };
}
