import { useChat } from "@ai-sdk/react";
import { css } from "@emotion/react";
import { DefaultChatTransport } from "ai";
import { useEffect, useRef } from "react";

import { authFetch } from "@phoenix/authFetch";
import { Icon, Icons, View } from "@phoenix/components";
import { Shimmer } from "@phoenix/components/ai/shimmer";
import { MessageBar } from "@phoenix/components/chat";
import type { ModelMenuValue } from "@phoenix/components/generative/ModelMenu";
import { ModelMenu } from "@phoenix/components/generative/ModelMenu";
import { useAgentStore } from "@phoenix/contexts/AgentContext";

import { AssistantMessage, UserMessage } from "./ChatMessage";

const chatCSS = css`
  position: relative;
  flex: 1;
  min-height: 0;
  overflow: hidden;

  .chat__scroll {
    height: 100%;
    overflow-y: auto;
  }

  .chat__messages {
    max-width: 780px;
    margin: 0 auto;
    display: flex;
    flex-direction: column;
    gap: var(--global-dimension-size-100);
    padding: var(--global-dimension-size-200);
    padding-bottom: var(--global-dimension-size-1200);
    font-size: var(--global-font-size-s);
    line-height: var(--global-line-height-s);
  }

  .chat__input {
    position: absolute;
    bottom: 0;
    left: 0;
    right: 0;
    max-width: 900px;
    margin: 0 auto;
    width: 100%;
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

  // LOAD: read stored messages for this session
  const initialMessages = sessionId
    ? store.getState().sessionMap[sessionId]?.messages
    : undefined;

  // INIT: seed useChat with stored messages and session ID
  const { messages, sendMessage, status, error } = useChat({
    id: sessionId ?? undefined,
    messages: initialMessages,
    transport: new DefaultChatTransport({ api: chatApiUrl, fetch: authFetch }),
    // SAVE: persist after each assistant response completes
    onFinish: ({ messages: finalMessages }) => {
      if (sessionId && finalMessages) {
        store.getState().setSessionMessages(sessionId, finalMessages);
      }
    },
  });

  // Keep a ref to messages for the unmount cleanup (avoids stale closure)
  const messagesRef = useRef(messages);
  messagesRef.current = messages;

  // SAVE on unmount (covers model change remount, tab close)
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
