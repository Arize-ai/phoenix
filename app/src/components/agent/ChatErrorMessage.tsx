import { css } from "@emotion/react";

import { Button } from "@phoenix/components/core/button";

import type { MessageRewindRequest } from "./ChatMessage";

const chatErrorMessageCSS = css`
  align-self: flex-start;
  display: flex;
  flex-direction: column;
  gap: var(--global-dimension-size-100);
  color: var(--global-text-color-900);
  font-size: var(--global-font-size-s);
  line-height: var(--global-line-height-s);
  border-left: var(--global-border-size-thick) solid var(--global-color-danger);
  padding-left: var(--global-dimension-size-150);
  max-width: 100%;

  .chat-error-message__title {
    color: var(--global-color-danger);
    font-weight: var(--global-font-weight-semibold);
  }

  .chat-error-message__copy {
    margin: 0;
  }

  .chat-error-message__actions {
    display: flex;
    align-items: center;
    flex-wrap: wrap;
    gap: var(--global-dimension-size-100);
  }

  .chat-error-message__details {
    color: var(--global-text-color-700);
  }

  .chat-error-message__details summary {
    cursor: pointer;
  }

  .chat-error-message__technical-message {
    white-space: pre-wrap;
    overflow-wrap: anywhere;
    margin: var(--global-dimension-size-100) 0 0;
    color: var(--global-color-danger);
  }
`;

/** Inline request error banner for the active chat turn. */
export function ChatErrorMessage({
  error,
  latestAssistantMessageId,
  latestUserMessageId,
  canFork,
  onRetry,
  onRewind,
}: {
  error: Error;
  latestAssistantMessageId?: string;
  latestUserMessageId?: string;
  canFork: boolean;
  onRetry?: (messageId?: string) => void;
  onRewind?: MessageRewindRequest;
}) {
  const canRetry = onRetry != null;
  const canUndoOrFork = latestUserMessageId != null && onRewind != null;

  return (
    <div css={chatErrorMessageCSS} role="alert">
      <div className="chat-error-message__title">
        The assistant response failed.
      </div>
      <p className="chat-error-message__copy">
        You can retry the response, undo this turn, or branch before the error.
      </p>
      {canRetry || canUndoOrFork ? (
        <div className="chat-error-message__actions">
          {canRetry ? (
            <Button
              size="S"
              variant="primary"
              onPress={() => onRetry(latestAssistantMessageId)}
            >
              Retry
            </Button>
          ) : null}
          {canUndoOrFork ? (
            <Button
              size="S"
              onPress={() =>
                onRewind({
                  mode: "rewind",
                  messageId: latestUserMessageId,
                  role: "user",
                })
              }
            >
              Undo failed turn
            </Button>
          ) : null}
          {canUndoOrFork && canFork ? (
            <Button
              size="S"
              variant="quiet"
              onPress={() =>
                onRewind({
                  mode: "fork",
                  messageId: latestUserMessageId,
                  role: "user",
                })
              }
            >
              Branch before error
            </Button>
          ) : null}
        </div>
      ) : null}
      <details className="chat-error-message__details">
        <summary>Show technical details</summary>
        <p className="chat-error-message__technical-message">{error.message}</p>
      </details>
    </div>
  );
}
