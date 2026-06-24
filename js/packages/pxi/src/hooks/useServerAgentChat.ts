import { readUIMessageStream, type DefaultChatTransport } from "ai";
import { useState } from "react";

import type { AgentUIMessage } from "../chat/types";

export type ChatStatus = "ready" | "streaming" | "error";

export type UseServerAgentChat = {
  /** Full conversation history, including the in-flight assistant reply. */
  messages: AgentUIMessage[];
  status: ChatStatus;
  /** Human-readable error from the most recent failed turn, if any. */
  error: string | null;
  /** Submit a user message and stream the assistant reply. No-op while busy. */
  send: (text: string) => void;
};

/**
 * Headless chat state backed by the AI SDK transport. We deliberately avoid the
 * `Chat` class / `@ai-sdk/react` (which assume a DOM host) and fold the UI
 * message stream into React state ourselves, which keeps this portable to the
 * OpenTUI renderer.
 *
 * `send` is intentionally recreated each render (no `useCallback`) so its
 * closure always captures the current `messages`/`status` — the stream loop
 * then advances state via functional updates.
 */
export function useServerAgentChat({
  transport,
  sessionId,
}: {
  transport: DefaultChatTransport<AgentUIMessage>;
  sessionId: string;
}): UseServerAgentChat {
  const [messages, setMessages] = useState<AgentUIMessage[]>([]);
  const [status, setStatus] = useState<ChatStatus>("ready");
  const [error, setError] = useState<string | null>(null);

  function send(text: string) {
    const trimmed = text.trim();
    if (!trimmed || status === "streaming") {
      return;
    }

    const userMessage: AgentUIMessage = {
      id: crypto.randomUUID(),
      role: "user",
      parts: [{ type: "text", text: trimmed }],
    };
    const history = [...messages, userMessage];
    setMessages(history);
    setStatus("streaming");
    setError(null);

    void (async () => {
      try {
        const stream = await transport.sendMessages({
          chatId: sessionId,
          messages: history,
          trigger: "submit-message",
          messageId: undefined,
          abortSignal: undefined,
        });
        // Each yielded value is the assistant message reconstructed so far, so
        // replacing the trailing entry streams the reply token-by-token.
        for await (const assistantMessage of readUIMessageStream<AgentUIMessage>(
          { stream }
        )) {
          setMessages([...history, assistantMessage]);
        }
        setStatus("ready");
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
        setStatus("error");
      }
    })();
  }

  return { messages, status, error, send };
}
