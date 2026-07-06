import { css } from "@emotion/react";

import { Button } from "@phoenix/components/core/button";

import type { MessageRewindRequest } from "./ChatMessage";

const interruptedChatMessageCSS = css`
  align-self: flex-start;
  display: flex;
  flex-direction: column;
  gap: var(--global-dimension-size-100);
  color: var(--global-text-color-900);
  font-size: var(--global-font-size-s);
  line-height: var(--global-line-height-s);
  border-left: var(--global-border-size-thick) solid
    var(--global-color-warning-500);
  padding-left: var(--global-dimension-size-150);
  max-width: 100%;

  .interrupted-chat-message__title {
    color: var(--global-color-warning-700);
    font-weight: var(--global-font-weight-semibold);
  }

  .interrupted-chat-message__copy {
    margin: 0;
  }

  .interrupted-chat-message__actions {
    display: flex;
    align-items: center;
    flex-wrap: wrap;
    gap: var(--global-dimension-size-100);
  }
`;

/** Recovery affordance for durable transcripts that end on an unanswered user turn. */
export function InterruptedChatMessage({
  latestUserMessageId,
  canFork,
  onRetry,
  onRewind,
}: {
  latestUserMessageId: string;
  canFork: boolean;
  onRetry: () => void;
  onRewind?: MessageRewindRequest;
}) {
  return (
    <div css={interruptedChatMessageCSS} role="status">
      <div className="interrupted-chat-message__title">
        PXI did not respond.
      </div>
      <p className="interrupted-chat-message__copy">
        This message was interrupted before PXI could respond.
      </p>
      {onRewind ? (
        <div className="interrupted-chat-message__actions">
          <Button size="S" variant="primary" onPress={onRetry}>
            Retry
          </Button>
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
            Edit message
          </Button>
          {canFork ? (
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
              Branch before message
            </Button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
