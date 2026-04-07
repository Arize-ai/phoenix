import { useChat } from "@ai-sdk/react";
import type { ChatStatus, UIMessage } from "ai";
import {
  DefaultChatTransport,
  lastAssistantMessageIsCompleteWithToolCalls,
} from "ai";
import { useEffect, useRef } from "react";

import { buildAgentChatRequestBody } from "@phoenix/agent/chat/buildAgentChatRequestBody";
import { handleAgentToolCall } from "@phoenix/agent/chat/handleAgentToolCall";
import type {
  ElicitToolOutput,
  PendingElicitation,
} from "@phoenix/agent/tools/elicit";
import { authFetch } from "@phoenix/authFetch";
import { useAgentContext, useAgentStore } from "@phoenix/contexts/AgentContext";

import { useGenerateSessionSummary } from "./useGenerateSessionSummary";

/**
 * Owns the AI SDK chat instance for a single agent session/model pair.
 *
 * This hook is mounted by a headless controller so request streaming can
 * continue even while the visible panel UI is closed.
 */
export function useAgentChat({
  sessionId,
  chatApiUrl,
}: {
  sessionId: string | null;
  chatApiUrl: string;
}) {
  const store = useAgentStore();
  const { generateSummary } = useGenerateSessionSummary({ chatApiUrl });
  const pendingElicitation = useAgentContext((state) =>
    sessionId ? (state.pendingElicitationBySessionId[sessionId] ?? null) : null
  );

  const initialMessages = sessionId
    ? store.getState().sessionMap[sessionId]?.messages
    : undefined;

  const chat = useChat<UIMessage>({
    id: sessionId ?? undefined,
    messages: initialMessages,
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
          sessionId,
        }),
      }),
    }),
    onToolCall: ({ toolCall }) => {
      void handleAgentToolCall({
        toolCall,
        sessionId,
        addToolOutput,
        agentStore: store,
      });
    },
    sendAutomaticallyWhen: lastAssistantMessageIsCompleteWithToolCalls,
    onFinish: ({ messages: finalMessages }) => {
      if (sessionId && finalMessages) {
        store.getState().setSessionMessages(sessionId, finalMessages);
        generateSummary({ sessionId });
      }
    },
  });
  const { messages, sendMessage, status, error, addToolOutput, stop } = chat;

  const messagesRef = useRef(messages);
  messagesRef.current = messages;

  // Persist the latest messages if the chat controller remounts because the
  // active session or model changed.
  useEffect(() => {
    return () => {
      if (sessionId && messagesRef.current.length > 0) {
        store.getState().setSessionMessages(sessionId, messagesRef.current);
      }
    };
  }, [sessionId, store]);

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
    messages: UIMessage[];
    sendMessage: (message: { text: string }) => void;
    stop: () => Promise<void>;
    status: ChatStatus;
    error: Error | undefined;
    pendingElicitation: PendingElicitation | null;
    handleElicitationSubmit: (output: ElicitToolOutput) => void;
    handleElicitationCancel: () => void;
  };
}
