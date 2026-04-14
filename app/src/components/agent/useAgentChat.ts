import { Chat, useChat } from "@ai-sdk/react";
import type { ChatStatus } from "ai";
import {
  DefaultChatTransport,
  lastAssistantMessageIsCompleteWithToolCalls,
} from "ai";
import { useEffect, useRef } from "react";

import { buildAgentChatRequestBody } from "@phoenix/agent/chat/buildAgentChatRequestBody";
import { handleAgentToolCall } from "@phoenix/agent/chat/handleAgentToolCall";
import {
  assistantMessageMetadataSchema,
  type AgentUIMessage,
} from "@phoenix/agent/chat/types";
import type {
  ElicitToolOutput,
  PendingElicitation,
} from "@phoenix/agent/tools/elicit";
import { authFetch } from "@phoenix/authFetch";
import { useAgentChatRuntime } from "@phoenix/contexts/AgentChatRuntimeContext";
import { useAgentContext, useAgentStore } from "@phoenix/contexts/AgentContext";

import { useGenerateSessionSummary } from "./useGenerateSessionSummary";

/**
 * Subscribes the current render surface to the persistent AI SDK chat runtime
 * for a single agent session/model pair.
 *
 * `useChat` alone is tied to the current mounted component, which is too short-
 * lived for this agent UX: the visible chat surface can move between the docked
 * panel and the trace slideover, and model changes intentionally replace the
 * underlying transport. This hook keeps the imperative AI SDK `Chat` instance
 * in the app-level runtime registry, then binds the current React surface to
 * whichever runtime instance should own the session right now.
 *
 * Durable state still lives in the agent store:
 * - messages are mirrored into Zustand so an idle chat can be reconstructed
 * - pending elicitation is store-backed and survives remounts
 * - summaries are generated from finalized message history, not transient UI
 *   component state
 */
export function useAgentChat({
  sessionId,
  chatApiUrl,
}: {
  sessionId: string | null;
  chatApiUrl: string;
}) {
  const store = useAgentStore();
  const runtime = useAgentChatRuntime();
  const { generateSummary } = useGenerateSessionSummary({ chatApiUrl });
  const pendingElicitation = useAgentContext((state) =>
    sessionId ? (state.pendingElicitationBySessionId[sessionId] ?? null) : null
  );

  // Resolve the imperative runtime instance for this session/model pair. The
  // runtime owns replacement semantics when the transport changes, while the
  // hook simply binds the current render surface to the selected instance.
  const chatInstance =
    sessionId === null
      ? null
      : runtime.getOrCreateChat({
          sessionId,
          chatApiUrl,
          createChat: () => {
            // Rehydrate from store-backed messages so evicted idle runtimes can
            // be recreated without losing visible conversation history.
            const initialMessages =
              store.getState().sessionMap[sessionId]?.messages ?? [];
            const chat = new Chat<AgentUIMessage>({
              id: sessionId,
              messages: initialMessages,
              messageMetadataSchema: assistantMessageMetadataSchema,
              transport: new DefaultChatTransport({
                api: chatApiUrl,
                fetch: authFetch,
                prepareSendMessagesRequest: ({
                  body,
                  id,
                  messages,
                  trigger,
                  messageId,
                }) => ({
                  body: buildAgentChatRequestBody({
                    body,
                    id,
                    messages,
                    trigger,
                    messageId,
                    systemPrompt: store.getState().systemPrompt,
                    sessionId,
                    capabilities: store.getState().capabilities,
                  }),
                }),
              }),
              // Tool execution must target the runtime-owned chat instance so
              // tool outputs continue to attach to the correct conversation
              // even if the visible React surface remounts during the request.
              onToolCall: ({ toolCall }) => {
                void handleAgentToolCall({
                  toolCall,
                  sessionId,
                  addToolOutput: chat.addToolOutput,
                  agentStore: store,
                });
              },
              sendAutomaticallyWhen:
                lastAssistantMessageIsCompleteWithToolCalls,
              onFinish: ({ messages: finalMessages }) => {
                // Finalized history is mirrored into the durable store so idle
                // runtimes can be reclaimed and later reconstructed from state.
                if (finalMessages) {
                  store.getState().setSessionMessages(sessionId, finalMessages);
                  generateSummary({ sessionId });
                }
              },
            });
            return chat;
          },
        });

  // `useChat` subscribes the current React tree to the already-created runtime
  // instance. When `sessionId` is null we intentionally expose an inert chat
  // shape rather than creating a shared fallback runtime through this hook.
  const chat = useChat<AgentUIMessage>(
    chatInstance ? { chat: chatInstance } : { id: undefined, messages: [] }
  );
  const { messages, sendMessage, status, error, addToolOutput, stop } = chat;

  const messagesRef = useRef(messages);
  messagesRef.current = messages;

  // Persist the latest in-memory transcript when this binding unmounts because
  // the visible surface moved, the active session changed, or the model swap
  // caused the runtime instance to be replaced.
  useEffect(() => {
    return () => {
      if (sessionId && messagesRef.current.length > 0) {
        store.getState().setSessionMessages(sessionId, messagesRef.current);
      }
    };
  }, [sessionId, store]);

  // Elicitation responses are written back through the runtime-owned chat so
  // the pending tool call resolves against the correct assistant turn.
  const handleElicitationSubmit = (output: ElicitToolOutput) => {
    if (!pendingElicitation || !sessionId) {
      return;
    }
    void addToolOutput({
      tool: "ask_user",
      toolCallId: pendingElicitation.toolCallId,
      output,
    });
    store.getState().setPendingElicitation(sessionId, null);
  };

  const handleElicitationCancel = () => {
    if (!pendingElicitation || !sessionId) {
      return;
    }
    void addToolOutput({
      state: "output-error",
      tool: "ask_user",
      toolCallId: pendingElicitation.toolCallId,
      errorText: "User cancelled the question.",
    });
    store.getState().setPendingElicitation(sessionId, null);
  };

  return {
    messages,
    sendMessage,
    stop,
    status,
    error,
    pendingElicitation,
    handleElicitationSubmit,
    handleElicitationCancel,
  } as {
    messages: AgentUIMessage[];
    sendMessage: (message: { text: string }) => void;
    stop: () => Promise<void>;
    status: ChatStatus;
    error: Error | undefined;
    pendingElicitation: PendingElicitation | null;
    handleElicitationSubmit: (output: ElicitToolOutput) => void;
    handleElicitationCancel: () => void;
  };
}
