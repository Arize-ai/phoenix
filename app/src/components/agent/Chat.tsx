import { useChat } from "@ai-sdk/react";
import { css } from "@emotion/react";
import type { UIMessage } from "ai";
import {
  DefaultChatTransport,
  lastAssistantMessageIsCompleteWithToolCalls,
} from "ai";
import { useEffect, useRef } from "react";

import { buildAgentChatRequestBody } from "@phoenix/agent/chat/buildAgentChatRequestBody";
import { handleAgentToolCall } from "@phoenix/agent/chat/handleAgentToolCall";
import { authFetch } from "@phoenix/authFetch";
import { Icon, Icons, View } from "@phoenix/components";
import { Shimmer } from "@phoenix/components/ai/shimmer";
import { MessageBar } from "@phoenix/components/chat";
import type { ModelMenuValue } from "@phoenix/components/generative/ModelMenu";
import { ModelMenu } from "@phoenix/components/generative/ModelMenu";
import { useAgentStore } from "@phoenix/contexts/AgentContext";

import { AssistantMessage, UserMessage } from "./ChatMessage";

const chatCSS = css`
  display: flex;
  flex-direction: column;
  flex: 1;
  min-height: 0;
  overflow: hidden;

  .chat__scroll {
    flex: 1;
    min-height: 0;
    overflow-y: auto;
  }

  .chat__messages {
    max-width: 780px;
    margin: 0 auto;
    display: flex;
    flex-direction: column;
    gap: var(--global-dimension-size-100);
    padding: var(--global-dimension-size-200);
    padding-bottom: var(--global-dimension-size-200);
    font-size: var(--global-font-size-s);
    line-height: var(--global-line-height-s);
  }

  .chat__input {
    flex-shrink: 0;
    max-width: 900px;
    margin: 0 auto;
    width: 100%;
    padding-top: var(--global-dimension-size-100);
    padding-bottom: var(--global-dimension-size-200);
    background-color: var(--global-color-gray-75);
  }

  .chat__input-container {
    border: 1px solid var(--global-color-gray-300);
    border-radius: var(--global-rounding-medium);
    background-color: var(--global-color-gray-100);
    overflow: hidden;
  }

  .chat__input-toolbar {
    display: flex;
    align-items: center;
    padding: var(--global-dimension-size-100) var(--global-dimension-size-100);
    border-top: 1px solid var(--global-color-gray-200);
  }

  .chat__empty {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: var(--global-dimension-size-100);
    margin-top: var(--global-dimension-size-400);
    color: var(--global-text-color-300);
  }

  .chat__loading {
    color: var(--global-text-color-300);
  }

  .chat__error {
    align-self: flex-start;
    color: var(--global-color-danger);
    font-size: var(--global-font-size-s);
  }
`;

/**
 * Core chat UI for a single agent conversation.
 *
 * Wraps the AI SDK `useChat` hook with Phoenix-specific configuration:
 * - Sends tool definitions and system prompt via {@link buildAgentChatRequestBody}
 * - Dispatches client-side tool calls through {@link handleAgentToolCall}
 * - Persists messages to the Zustand agent store on completion and unmount
 *
 * The parent component keys this on `sessionId + chatApiUrl`, so it fully
 * remounts when **either** the session or the model changes. This is
 * intentional: `chatApiUrl` encodes model params, and the AI SDK transport
 * captures the URL at construction time, so a model switch requires a fresh
 * `useChat` instance. Messages are persisted to the store before unmount so
 * the conversation survives the remount.
 */
export function Chat({
  sessionId,
  chatApiUrl,
  modelMenuValue,
  onModelChange,
}: {
  sessionId: string | null;
  chatApiUrl: string;
  modelMenuValue: ModelMenuValue;
  onModelChange: (model: ModelMenuValue) => void;
}) {
  const store = useAgentStore();

  // read stored messages for this session
  const initialMessages = sessionId
    ? store.getState().sessionMap[sessionId]?.messages
    : undefined;

  const chat = useChat<UIMessage>({
    id: sessionId ?? undefined,
    // seed useChat with stored messages and session ID
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
        }),
      }),
    }),
    onToolCall: ({ toolCall }) => {
      // AI SDK docs recommend not awaiting `addToolOutput` inside `onToolCall`
      // when using `sendAutomaticallyWhen`, because it can deadlock the chat
      // update loop. We follow that guidance here by kicking off tool handling
      // without awaiting it and letting the helper manage tool output updates.
      // See: ai/docs/04-ai-sdk-ui/03-chatbot-tool-usage.mdx and
      // ai/docs/08-migration-guides/26-migration-guide-5-0.mdx in this repo's
      // installed AI SDK package.
      void handleAgentToolCall({ toolCall, sessionId, addToolOutput });
    },
    sendAutomaticallyWhen: lastAssistantMessageIsCompleteWithToolCalls,
    onFinish: ({ messages: finalMessages }) => {
      if (sessionId && finalMessages) {
        // persist after each assistant response completes
        store.getState().setSessionMessages(sessionId, finalMessages);
      }
    },
  });
  const { messages, sendMessage, status, error, addToolOutput } = chat;

  // Keep a ref to messages for the unmount cleanup (avoids stale closure)
  const messagesRef = useRef(messages);
  messagesRef.current = messages;

  // persist messages on unmount (covers model change remount, tab close)
  useEffect(() => {
    return () => {
      if (sessionId && messagesRef.current.length > 0) {
        store.getState().setSessionMessages(sessionId, messagesRef.current);
      }
    };
  }, [sessionId, store]);

  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, status]);

  return (
    <div css={chatCSS}>
      <div className="chat__scroll">
        <div className="chat__messages">
          {messages.length === 0 && <EmptyState />}
          {messages.map((m) =>
            m.role === "user" ? (
              <UserMessage key={m.id} parts={m.parts} />
            ) : (
              <AssistantMessage key={m.id} parts={m.parts} />
            )
          )}
          {status === "submitted" && <Loading />}
          {error && <ErrorMessage error={error} />}
          <div ref={bottomRef} />
        </div>
      </div>
      <div className="chat__input">
        <View paddingX="size-100">
          <div className="chat__input-container">
            <MessageBar
              onSendMessage={(text) => sendMessage({ text })}
              isSending={status === "submitted" || status === "streaming"}
              placeholder="Send a message…"
              icon={<Icon svg={<Icons.ArrowUpwardOutline />} />}
            />
            <div className="chat__input-toolbar">
              <ModelMenu
                value={modelMenuValue}
                onChange={onModelChange}
                placement="top start"
                shouldFlip
              />
            </div>
          </div>
        </View>
      </div>
    </div>
  );
}

function EmptyState() {
  return (
    <div className="chat__empty">
      <Icon
        svg={<Icons.Robot />}
        css={css`
          font-size: 48px;
        `}
      />
      <p>Send a message to chat with PXI</p>
    </div>
  );
}

function Loading() {
  return <Shimmer size="M">Thinking...</Shimmer>;
}

function ErrorMessage({ error }: { error: Error }) {
  return <p className="chat__error">{error.message}</p>;
}
