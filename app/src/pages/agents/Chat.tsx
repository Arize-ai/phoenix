import { useChat } from "@ai-sdk/react";
import { css } from "@emotion/react";
import { DefaultChatTransport } from "ai";
import { useEffect, useRef } from "react";

import { authFetch } from "@phoenix/authFetch";
import { View } from "@phoenix/components";
import { MessageBar } from "@phoenix/components/chat";

import { AssistantMessage, UserMessage } from "./ChatMessage";

const chatCSS = css`
  position: relative;
  flex: 1;
  min-height: 0;

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
    background-color: var(--global-color-gray-75);
  }

  .chat__user-message {
    align-self: flex-end;
    background-color: var(--global-color-primary-700);
    color: var(--global-color-gray-50);
    border-radius: var(--global-rounding-large) var(--global-rounding-large) 0
      var(--global-rounding-large);
    padding: var(--global-dimension-size-100) var(--global-dimension-size-150);
    max-width: 75%;
    word-wrap: break-word;
  }

  .chat__assistant-message {
    align-self: flex-start;
    max-width: 90%;
  }

  .chat__empty {
    text-align: center;
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

export function Chat({ chatApiUrl }: { chatApiUrl: string }) {
  const { messages, sendMessage, status, error } = useChat({
    transport: new DefaultChatTransport({ api: chatApiUrl, fetch: authFetch }),
  });

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
          <MessageBar
            onSendMessage={(text) => sendMessage({ text })}
            isSending={status === "submitted" || status === "streaming"}
            placeholder="Send a message…"
          />
        </View>
      </div>
    </div>
  );
}

function EmptyState() {
  return <p className="chat__empty">Send a message to chat with PXI</p>;
}

function Loading() {
  return <p className="chat__loading">...</p>;
}

function ErrorMessage({ error }: { error: Error }) {
  return <p className="chat__error">{error.message}</p>;
}
