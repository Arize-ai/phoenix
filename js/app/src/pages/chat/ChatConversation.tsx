import { css, keyframes } from "@emotion/react";
import type { ChatStatus } from "ai";
import type { ReactNode } from "react";

import { Alert, Button, Icon, Icons } from "@phoenix/components";
import {
  Message,
  MessageAction,
  MessageActions,
  MessageContent,
  MessageCopyAction,
  MessageResponse,
  MessageToolbar,
} from "@phoenix/components/ai/message";
import { Shimmer } from "@phoenix/components/ai/shimmer";

import type { DirectChatMessage } from "./useDirectChat";

const chatEmptyFadeUp = keyframes`
  from {
    opacity: 0;
    transform: translateY(16px);
  }

  to {
    opacity: 1;
    transform: translateY(0);
  }
`;

const chatEmptyStateCSS = css`
  width: min(100%, var(--global-dimension-size-8500));
  margin-inline: auto;
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  gap: var(--global-dimension-size-150);
  color: var(--global-text-color-500);

  .chat-empty-state__glyph {
    display: flex;
    align-items: center;
    justify-content: center;
    width: var(--global-dimension-size-600);
    height: var(--global-dimension-size-600);
    border-radius: var(--global-rounding-full);
    border: var(--global-border-size-thin) solid
      var(--global-border-color-default);
    background: linear-gradient(
      135deg,
      rgba(var(--global-color-gray-500-rgb), 0.18),
      rgba(var(--global-color-gray-500-rgb), 0.04)
    );
    color: var(--global-text-color-700);
    font-size: var(--global-font-size-xl);
    opacity: 0;
    animation: ${chatEmptyFadeUp} 500ms ease-out 100ms forwards;
  }

  .chat-empty-state__title {
    margin: 0;
    font-size: var(--global-font-size-xl);
    font-weight: 600;
    color: var(--global-text-color-900);
    opacity: 0;
    animation: ${chatEmptyFadeUp} 500ms ease-out 200ms forwards;
  }

  .chat-empty-state__subtext {
    margin: 0;
    max-width: var(--global-dimension-size-5000);
    font-size: var(--global-font-size-s);
    line-height: var(--global-line-height-s);
    color: var(--global-text-color-500);
    opacity: 0;
    animation: ${chatEmptyFadeUp} 500ms ease-out 300ms forwards;
  }

  @media (prefers-reduced-motion: reduce) {
    .chat-empty-state__glyph,
    .chat-empty-state__title,
    .chat-empty-state__subtext {
      opacity: 1;
      animation: none;
      transform: none;
    }
  }
`;

/**
 * The greeting shown in place of a conversation that has not started
 */
export function ChatEmptyState({
  title,
  headingLevel = 1,
  children,
}: {
  title: string;
  headingLevel?: 1 | 2;
  children: ReactNode;
}) {
  const Title = headingLevel === 1 ? "h1" : "h2";
  return (
    <div css={chatEmptyStateCSS} className="chat-empty-state">
      <div className="chat-empty-state__glyph">
        <Icon svg={<Icons.MessageCircle />} />
      </div>
      <Title className="chat-empty-state__title">{title}</Title>
      <p className="chat-empty-state__subtext">{children}</p>
    </div>
  );
}

const thinkingCSS = css`
  padding-block: var(--global-dimension-size-50);
`;

export function ChatMessages({
  messages,
  status,
  onRegenerate,
}: {
  messages: DirectChatMessage[];
  status: ChatStatus;
  onRegenerate: () => void;
}) {
  const hasChatSettled = status === "ready" || status === "error";
  return messages.map((message, index) => {
    const isLast = index === messages.length - 1;
    if (message.role === "user") {
      return <ChatUserMessage key={message.id} message={message} />;
    }
    return (
      <ChatAssistantMessage
        key={message.id}
        message={message}
        isStreaming={isLast && status === "streaming"}
        showActions={!isLast || hasChatSettled}
        pinToolbar={isLast && hasChatSettled}
        onRegenerate={isLast && hasChatSettled ? onRegenerate : undefined}
      />
    );
  });
}

export function ChatStatusMessage({
  status,
  downloadProgress,
  error,
  canRetry,
  onRetry,
}: {
  status: ChatStatus;
  downloadProgress: number | null;
  error: string | null;
  canRetry: boolean;
  onRetry: () => void;
}) {
  return (
    <>
      {status === "submitted" ? (
        <div css={thinkingCSS}>
          <Shimmer size="S" color="text-500" fontStyle="italic">
            {downloadProgress != null
              ? `Downloading the on-device model… ${Math.round(downloadProgress * 100)}%`
              : "Thinking..."}
          </Shimmer>
        </div>
      ) : null}
      {error != null ? (
        <Alert
          variant="danger"
          extra={
            canRetry ? (
              <Button size="S" onPress={onRetry}>
                Retry
              </Button>
            ) : undefined
          }
        >
          {error}
        </Alert>
      ) : null}
    </>
  );
}

function ChatUserMessage({ message }: { message: DirectChatMessage }) {
  return (
    <Message from="user">
      <MessageContent>{message.content}</MessageContent>
      <MessageToolbar>
        <MessageActions>
          <MessageCopyAction text={message.content} />
        </MessageActions>
      </MessageToolbar>
    </Message>
  );
}

function ChatAssistantMessage({
  message,
  isStreaming,
  showActions,
  pinToolbar,
  onRegenerate,
}: {
  message: DirectChatMessage;
  isStreaming: boolean;
  showActions: boolean;
  pinToolbar: boolean;
  onRegenerate?: () => void;
}) {
  return (
    <Message from="assistant" data-pin-toolbar={pinToolbar || undefined}>
      <MessageContent>
        <MessageResponse renderMode={isStreaming ? "streaming" : "static"}>
          {message.content}
        </MessageResponse>
      </MessageContent>
      {showActions ? (
        <MessageToolbar>
          <MessageActions>
            <MessageCopyAction text={message.content} />
            {onRegenerate ? (
              <MessageAction
                label="Regenerate"
                tooltip="Regenerate response"
                onPress={onRegenerate}
              >
                <Icon svg={<Icons.Refresh />} />
              </MessageAction>
            ) : null}
          </MessageActions>
        </MessageToolbar>
      ) : null}
    </Message>
  );
}
